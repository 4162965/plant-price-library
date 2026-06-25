const API_BASE_URL = window.PLANT_PRICE_CONFIG?.API_BASE_URL || "";
const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='180' viewBox='0 0 240 180'%3E%3Crect width='240' height='180' fill='%23dfeadd'/%3E%3Ccircle cx='84' cy='82' r='36' fill='%2377aa72'/%3E%3Ccircle cx='128' cy='66' r='44' fill='%234f8e58'/%3E%3Ccircle cx='160' cy='92' r='34' fill='%236fa866'/%3E%3Crect x='112' y='94' width='16' height='52' rx='7' fill='%23765839'/%3E%3C/svg%3E";

const state = {
  view: "library",
  token: localStorage.getItem("plant_price_token") || "",
  user: JSON.parse(localStorage.getItem("plant_price_user") || "null"),
  categories: [],
  plants: [],
  specs: [],
  records: [],
  selectedCategory: "",
  selectedPlant: null,
  selectedSpec: null,
  query: "",
  modal: null,
  saving: false,
  loading: false,
  demo: false,
};

const demo = {
  categories: [
    { id: "tree", name: "乔木" },
    { id: "shrub", name: "灌木" },
    { id: "ground", name: "地被" },
    { id: "lawn", name: "草皮" },
    { id: "flower", name: "花卉" },
    { id: "indoor", name: "室内植物" },
    { id: "material", name: "资材器材" },
    { id: "pesticide", name: "农药" },
  ],
  plants: [
    { id: "camphor", name: "香樟", category_name: "乔木", cover_url: PLACEHOLDER },
    { id: "osmanthus", name: "桂花", category_name: "乔木", cover_url: PLACEHOLDER },
    { id: "loropetalum", name: "红继木球", category_name: "灌木", cover_url: PLACEHOLDER },
    { id: "ficus", name: "黄金榕", category_name: "灌木", cover_url: PLACEHOLDER },
    { id: "soil", name: "营养土", category_name: "资材器材", cover_url: PLACEHOLDER },
    { id: "fungicide", name: "杀菌剂", category_name: "农药", cover_url: PLACEHOLDER },
  ],
  specs: [
    { id: "12", label: "12分", latest_price: "680", record_count: 3 },
    { id: "10", label: "10分", latest_price: "520", record_count: 2 },
    { id: "8", label: "8分", latest_price: "360", record_count: 4 },
  ],
  records: [
    { id: "r1", image_url: PLACEHOLDER, uploaded_date: "2026-06-25", spec_label: "12分", price: "680" },
    { id: "r2", image_url: PLACEHOLDER, uploaded_date: "2026-06-18", spec_label: "12分", price: "650" },
  ],
};

const app = document.querySelector("#app");

function api(path, options = {}) {
  if (!API_BASE_URL) return Promise.reject(new Error("API 未配置"));
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "请求失败");
    return data;
  });
}

async function loadBase() {
  state.loading = true;
  render();
  try {
    const [categories, plants] = await Promise.all([
      api("/api/categories"),
      api(`/api/plants?query=${encodeURIComponent(state.query)}&categoryId=${state.selectedCategory}`),
    ]);
    state.categories = categories.items;
    state.plants = plants.items;
    state.demo = false;
  } catch {
    state.categories = demo.categories;
    state.plants = demo.plants.filter((plant) => {
      const matchesQuery = !state.query || plant.name.includes(state.query);
      const category = state.categories.find((item) => item.id === state.selectedCategory);
      const matchesCategory = !category || plant.category_name === category.name;
      return matchesQuery && matchesCategory;
    });
    state.demo = true;
  } finally {
    state.loading = false;
    render();
  }
}

async function selectPlant(plant) {
  state.selectedPlant = plant;
  state.selectedSpec = null;
  state.view = "plant";
  try {
    const data = await api(`/api/plants/${plant.id}/specs`);
    state.specs = data.items;
  } catch {
    state.specs = demo.specs;
  }
  render();
}

async function selectSpec(spec) {
  state.selectedSpec = spec;
  state.view = "records";
  try {
    const data = await api(`/api/specs/${spec.id}/records`);
    state.records = data.items;
  } catch {
    state.records = demo.records.map((item) => ({ ...item, spec_label: spec.label }));
  }
  render();
}

function header(title, actions = "") {
  return `<div class="topbar"><h1 class="title">${title}</h1><div>${actions}</div></div>`;
}

function libraryView() {
  return `
    ${header(
      "植物库",
      `<button class="icon-btn" onclick="state.view='profile'; render()" title="账号">⌾</button>
       ${state.token ? `<button class="text-btn" onclick="openModal('plant')">添加植物</button>` : ""}`,
    )}
    <main class="content">
      ${state.demo ? `<div class="empty">当前为示例数据。配置 API 后会显示真实数据。</div>` : ""}
      <input class="search" placeholder="搜索植物名称" value="${escapeHtml(state.query)}" oninput="state.query=this.value; debounceLoad()" />
      <div class="tabs">
        <button class="tab ${state.selectedCategory === "" ? "active" : ""}" onclick="state.selectedCategory=''; loadBase()">全部</button>
        ${state.categories
          .map(
            (cat) =>
              `<button class="tab ${state.selectedCategory === cat.id ? "active" : ""}" onclick="state.selectedCategory='${cat.id}'; loadBase()">${escapeHtml(cat.name)}</button>`,
          )
          .join("")}
      </div>
      <div class="list">
        ${state.plants
          .map(
            (plant) => `
              <button class="row" onclick='selectPlant(${JSON.stringify(plant)})'>
                <img class="thumb" src="${plant.cover_url || PLACEHOLDER}" alt="" />
                <span class="row-main">
                  <span class="row-title">${escapeHtml(plant.name)}</span>
                  <span class="meta">${escapeHtml(plant.category_name || "未分类")}</span>
                </span>
                <span class="meta">›</span>
              </button>`,
          )
          .join("") || `<div class="empty">没有找到，维护端可以添加植物。</div>`}
      </div>
    </main>
    ${bottomNav()}
  `;
}

function plantView() {
  const plant = state.selectedPlant;
  return `
    ${header(
      plant.name,
      `<button class="ghost-btn" onclick="state.view='library'; render()">返回</button>
       ${state.token ? `<button class="text-btn" onclick="openModal('spec')">添加规格</button>` : ""}`,
    )}
    <main class="content">
      <div class="hero">
        <img src="${plant.cover_url || PLACEHOLDER}" alt="" />
        <div>
          <strong class="row-title">${escapeHtml(plant.name)}</strong>
          <span class="meta">${escapeHtml(plant.category_name || "未分类")}</span>
        </div>
      </div>
      <div class="section-head"><h2>规格列表</h2></div>
      <div class="list">
        ${state.specs
          .map(
            (spec) => `
              <button class="row spec-row" onclick='selectSpec(${JSON.stringify(spec)})'>
                <span>
                  <span class="row-title">${escapeHtml(spec.label)}</span>
                  <span class="meta">${spec.record_count || 0}条记录</span>
                </span>
                <span class="price">${spec.latest_price ? `¥${escapeHtml(spec.latest_price)}` : "暂无价格"}</span>
              </button>`,
          )
          .join("") || `<div class="empty">还没有规格。${state.token ? "点击添加规格开始维护。" : ""}</div>`}
      </div>
    </main>
    ${bottomNav()}
  `;
}

function recordsView() {
  const spec = state.selectedSpec;
  return `
    ${header(
      `${state.selectedPlant.name} ${spec.label}`,
      `<button class="ghost-btn" onclick="state.view='plant'; render()">返回</button>
       ${state.token ? `<button class="text-btn" onclick="openModal('record')">添加价格</button>` : ""}`,
    )}
    <main class="content">
      <span class="badge">${escapeHtml(spec.label)}</span>
      <div class="section-head"><h2>价格记录</h2></div>
      <div class="list">
        ${state.records
          .map(
            (record) => `
              <article class="card record">
                <img src="${record.image_url || PLACEHOLDER}" alt="" />
                <dl>
                  <div><dt>日期</dt><dd>${escapeHtml(record.uploaded_date)}</dd></div>
                  <div><dt>规格</dt><dd>${escapeHtml(record.spec_label || spec.label)}</dd></div>
                  <div><dt>价格</dt><dd class="price">¥${escapeHtml(record.price)}</dd></div>
                </dl>
              </article>`,
          )
          .join("") || `<div class="empty">这个规格还没有价格记录。</div>`}
      </div>
    </main>
    ${bottomNav()}
  `;
}

function profileView() {
  if (!state.token) return loginView();
  return `
    ${header("账号", `<button class="ghost-btn" onclick="state.view='library'; render()">返回</button>`)}
    <main class="content">
      <section class="card profile-card">
        <strong class="row-title">${escapeHtml(state.user?.name || "维护人员")}</strong>
        <span class="meta">${escapeHtml(state.user?.role || "维护人员")} · 已绑定本设备</span>
      </section>
      <div class="list">
        <button class="row" onclick="openModal('category')"><span class="row-main"><span class="row-title">分类管理</span><span class="meta">添加室内植物、资材器材、农药等分类</span></span></button>
        <button class="row" onclick="alert('第一版记录添加、修改、删除动作，便于追溯。')"><span class="row-main"><span class="row-title">操作记录</span><span class="meta">查看维护动作</span></span></button>
        <button class="row" onclick="logout()"><span class="row-main"><span class="row-title">退出登录</span><span class="meta">本设备下次需要重新登录</span></span></button>
      </div>
    </main>
    ${bottomNav()}
  `;
}

function loginView() {
  return `
    <main class="shell login">
      <h1>植物价格库</h1>
      <p>维护端登录一次绑定设备。员工查询不需要登录，可直接返回植物库查看价格。</p>
      <label class="field"><span>姓名</span><input id="loginName" placeholder="例如 张三" /></label>
      <label class="field"><span>手机号</span><input id="loginPhone" placeholder="用于识别维护人员" /></label>
      <label class="field"><span>登录码</span><input id="loginCode" placeholder="管理员提供的登录码" type="password" /></label>
      <button class="primary-btn" onclick="login()">登录并绑定设备</button>
      <button class="ghost-btn" style="margin-top:10px" onclick="state.view='library'; render()">免登录查询</button>
    </main>
  `;
}

function bottomNav() {
  return `
    <nav class="bottom-nav">
      <button class="${state.view === "library" ? "active" : ""}" onclick="state.view='library'; loadBase()">植物库</button>
      <button onclick="state.view='library'; state.query=''; loadBase()">查询</button>
      <button class="${state.view === "profile" ? "active" : ""}" onclick="state.view='profile'; render()">我的</button>
    </nav>`;
}

function modal() {
  if (!state.modal) return "";
  const close = `<button type="button" class="ghost-btn" onclick="closeModal()">取消</button>`;
  const saveText = `<button type="submit" class="primary-btn">${state.saving ? "保存中..." : "保存"}</button>`;
  const categories = state.categories.map((cat) => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join("");
  const forms = {
    category: `<h2>添加分类</h2><label class="field"><span>分类名称</span><input id="categoryName" placeholder="例如 室内植物" /></label>`,
    plant: `<h2>添加植物/产品</h2><label class="field"><span>名称</span><input id="plantName" placeholder="例如 香樟" /></label><label class="field"><span>分类</span><select id="plantCategory">${categories}</select></label><label class="field"><span>封面图片</span><input id="plantImage" type="file" accept="image/*" /></label>`,
    spec: `<h2>添加规格</h2><label class="field"><span>规格</span><input id="specLabel" placeholder="例如 12分 / 40L/袋 / 500ml/瓶" /></label>`,
    record: `<h2>新增价格</h2><label class="field"><span>图片</span><input id="recordImage" type="file" accept="image/*" required /></label><label class="field"><span>日期</span><input id="recordDate" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label><label class="field"><span>规格</span><input value="${escapeHtml(state.selectedSpec?.label || "")}" disabled /></label><label class="field"><span>价格</span><input id="recordPrice" placeholder="例如 680/株" /></label>`,
  };
  return `<div class="modal-backdrop"><form class="modal" onsubmit="event.preventDefault(); submitModal()">${forms[state.modal]}<div class="actions">${close}${saveText}</div></form></div>`;
}

function render() {
  const views = {
    library: libraryView,
    plant: plantView,
    records: recordsView,
    profile: profileView,
  };
  app.className = state.view === "profile" && !state.token ? "" : "shell";
  app.innerHTML = (views[state.view] || libraryView)() + modal();
}

function openModal(name) {
  if (!state.token) {
    state.view = "profile";
    render();
    return;
  }
  state.modal = name;
  render();
}

function closeModal() {
  state.modal = null;
  render();
}

async function submitModal() {
  if (state.saving) return;
  state.saving = true;
  try {
    if (state.modal === "category") {
      await api("/api/categories", { method: "POST", body: JSON.stringify({ name: value("categoryName") }) });
      await loadBase();
    }
    if (state.modal === "plant") {
      const imageUrl = await uploadFile("plantImage");
      await api("/api/plants", {
        method: "POST",
        body: JSON.stringify({ name: value("plantName"), category_id: value("plantCategory"), cover_url: imageUrl }),
      });
      await loadBase();
    }
    if (state.modal === "spec") {
      await api(`/api/plants/${state.selectedPlant.id}/specs`, { method: "POST", body: JSON.stringify({ label: value("specLabel") }) });
      await selectPlant(state.selectedPlant);
    }
    if (state.modal === "record") {
      const imageUrl = await uploadFile("recordImage");
      await api(`/api/specs/${state.selectedSpec.id}/records`, {
        method: "POST",
        body: JSON.stringify({ image_url: imageUrl, uploaded_date: value("recordDate"), price: value("recordPrice") }),
      });
      await selectSpec(state.selectedSpec);
    }
    state.modal = null;
    render();
  } catch (error) {
    alert(error.message);
  } finally {
    state.saving = false;
    render();
  }
}

async function uploadFile(inputId) {
  const input = document.querySelector(`#${inputId}`);
  if (!input?.files?.[0]) return "";
  const file = await compressImage(input.files[0]);
  const form = new FormData();
  form.append("file", file, "image.jpg");
  const data = await api("/api/uploads", { method: "POST", body: form });
  return data.url;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("图片压缩失败"))), "image/jpeg", 0.75);
    };
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

async function login() {
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ name: value("loginName"), phone: value("loginPhone"), code: value("loginCode") }),
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("plant_price_token", state.token);
    localStorage.setItem("plant_price_user", JSON.stringify(state.user));
    state.view = "library";
    await loadBase();
  } catch (error) {
    alert(error.message);
  }
}

function logout() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("plant_price_token");
  localStorage.removeItem("plant_price_user");
  state.view = "library";
  render();
}

function value(id) {
  return document.querySelector(`#${id}`)?.value?.trim() || "";
}

function escapeHtml(input) {
  return String(input ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

let searchTimer = null;
function debounceLoad() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadBase, 250);
}

loadBase();
