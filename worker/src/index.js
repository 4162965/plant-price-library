const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: jsonHeaders });
    const url = new URL(request.url);

    try {
      const route = `${request.method} ${url.pathname}`;

      if (route === "POST /api/auth/login") return login(request, env);
      if (route === "GET /api/categories") return listCategories(env);
      if (route === "POST /api/categories") return withUser(request, env, (user) => createCategory(request, env, user));
      if (route === "GET /api/plants") return listPlants(request, env);
      if (route === "POST /api/plants") return withUser(request, env, (user) => createPlant(request, env, user));
      if (route === "POST /api/uploads") return withUser(request, env, (user) => uploadImage(request, env, user));
      if (url.pathname.startsWith("/images/") && request.method === "GET") return getImage(request, env);

      const plantSpecs = url.pathname.match(/^\/api\/plants\/([^/]+)\/specs$/);
      if (plantSpecs && request.method === "GET") return listSpecs(env, plantSpecs[1]);
      if (plantSpecs && request.method === "POST") return withUser(request, env, (user) => createSpec(request, env, user, plantSpecs[1]));

      const specRecords = url.pathname.match(/^\/api\/specs\/([^/]+)\/records$/);
      if (specRecords && request.method === "GET") return listRecords(env, specRecords[1]);
      if (specRecords && request.method === "POST") return withUser(request, env, (user) => createRecord(request, env, user, specRecords[1]));

      return send({ error: "Not found" }, 404);
    } catch (error) {
      return send({ error: error.message || "Server error" }, 500);
    }
  },
};

async function login(request, env) {
  const body = await request.json();
  assert(body.phone, "请输入手机号");
  assert(body.name, "请输入姓名");
  assert(body.code && body.code === env.MAINTAINER_SETUP_CODE, "登录码不正确");

  let user = await env.DB.prepare("SELECT * FROM users WHERE phone = ?").bind(body.phone).first();
  if (!user) {
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
    user = {
      id: crypto.randomUUID(),
      name: body.name,
      phone: body.phone,
      role: count.total === 0 ? "admin" : "maintainer",
    };
    await env.DB.prepare("INSERT INTO users (id, name, phone, role) VALUES (?, ?, ?, ?)")
      .bind(user.id, user.name, user.phone, user.role)
      .run();
  }

  const token = crypto.randomUUID() + "." + crypto.randomUUID();
  const tokenHash = await sha256(token);
  const days = Number(env.SESSION_DAYS || 365);
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  await env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, device_label, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), user.id, tokenHash, request.headers.get("User-Agent")?.slice(0, 120) || "unknown", expiresAt)
    .run();

  return send({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
}

async function listCategories(env) {
  const result = await env.DB.prepare("SELECT id, name FROM categories WHERE active = 1 ORDER BY sort_order, created_at").all();
  return send({ items: result.results });
}

async function createCategory(request, env, user) {
  const body = await request.json();
  assert(body.name, "请输入分类名称");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO categories (id, name) VALUES (?, ?)").bind(id, body.name).run();
  await log(env, user, "create", "category", id);
  return send({ id });
}

async function listPlants(request, env) {
  const url = new URL(request.url);
  const query = `%${url.searchParams.get("query") || ""}%`;
  const categoryId = url.searchParams.get("categoryId") || "";
  const sql = `
    SELECT plants.id, plants.name, plants.cover_url, categories.name AS category_name
    FROM plants
    LEFT JOIN categories ON plants.category_id = categories.id
    WHERE plants.active = 1
      AND plants.name LIKE ?
      AND (? = '' OR plants.category_id = ?)
    ORDER BY plants.created_at DESC
    LIMIT 200
  `;
  const result = await env.DB.prepare(sql).bind(query, categoryId, categoryId).all();
  return send({ items: result.results });
}

async function createPlant(request, env, user) {
  const body = await request.json();
  assert(body.name, "请输入名称");
  const existing = await env.DB.prepare(
    "SELECT id FROM plants WHERE name = ? AND COALESCE(category_id, '') = COALESCE(?, '') AND active = 1 LIMIT 1",
  )
    .bind(body.name, body.category_id || null)
    .first();
  if (existing) return send({ id: existing.id, existed: true });

  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO plants (id, name, category_id, cover_url) VALUES (?, ?, ?, ?)")
    .bind(id, body.name, body.category_id || null, body.cover_url || "")
    .run();
  await log(env, user, "create", "plant", id);
  return send({ id });
}

async function listSpecs(env, plantId) {
  const sql = `
    SELECT specs.id, specs.label,
      (SELECT price FROM price_records WHERE price_records.spec_id = specs.id ORDER BY uploaded_date DESC, created_at DESC LIMIT 1) AS latest_price,
      (SELECT COUNT(*) FROM price_records WHERE price_records.spec_id = specs.id) AS record_count
    FROM specs
    WHERE specs.plant_id = ? AND specs.active = 1
    ORDER BY specs.sort_order, specs.created_at
  `;
  const result = await env.DB.prepare(sql).bind(plantId).all();
  return send({ items: result.results });
}

async function createSpec(request, env, user, plantId) {
  const body = await request.json();
  assert(body.label, "请输入规格");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO specs (id, plant_id, label) VALUES (?, ?, ?)").bind(id, plantId, body.label).run();
  await log(env, user, "create", "spec", id);
  return send({ id });
}

async function listRecords(env, specId) {
  const sql = `
    SELECT price_records.id, price_records.image_url, price_records.uploaded_date, price_records.price, specs.label AS spec_label
    FROM price_records
    JOIN specs ON price_records.spec_id = specs.id
    WHERE price_records.spec_id = ?
    ORDER BY price_records.uploaded_date DESC, price_records.created_at DESC
    LIMIT 200
  `;
  const result = await env.DB.prepare(sql).bind(specId).all();
  return send({ items: result.results });
}

async function createRecord(request, env, user, specId) {
  const body = await request.json();
  assert(body.image_url, "请上传图片");
  assert(body.uploaded_date, "请选择日期");
  assert(body.price, "请输入价格");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO price_records (id, spec_id, image_url, uploaded_date, price, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, specId, body.image_url, body.uploaded_date, body.price, user.id)
    .run();
  await log(env, user, "create", "price_record", id);
  return send({ id });
}

async function uploadImage(request, env, user) {
  const form = await request.formData();
  const file = form.get("file");
  assert(file && file.size, "请选择图片");
  assert(file.size <= 3 * 1024 * 1024, "图片不能超过 3MB");

  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
  await env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
    customMetadata: { userId: user.id },
  });

  const base = env.PUBLIC_IMAGE_BASE_URL || new URL(request.url).origin;
  return send({ url: `${base}/images/${key}`, key });
}

async function getImage(request, env) {
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/images\//, ""));
  const object = await env.IMAGES.get(key);
  if (!object) return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(object.body, { headers });
}

async function withUser(request, env, handler) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  assert(token, "请先登录");
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    `SELECT users.* FROM sessions
     JOIN users ON sessions.user_id = users.id
     WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > datetime('now')`,
  )
    .bind(tokenHash)
    .first();
  assert(session, "登录已失效，请重新登录");
  return handler(session);
}

async function log(env, user, action, entityType, entityId) {
  await env.DB.prepare("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), user.id, action, entityType, entityId)
    .run();
}

async function sha256(value) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function send(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}
