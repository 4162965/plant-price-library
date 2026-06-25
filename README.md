# 植物价格库

一个适合小团队维护的植物/资材价格查询系统：

- 员工查询端公开访问，不需要登录。
- 管理员/维护人员登录一次后绑定设备，长期免登录。
- 分类、植物/产品、规格都可以添加。
- 价格记录只展示：上传日期、图片、规格、价格。
- Cloudflare D1 存文字数据，R2 存图片。

## 目录

```text
frontend/  静态手机端页面，部署到 Cloudflare Pages
worker/    Cloudflare Worker API，绑定 D1 和 R2
```

## Cloudflare 资源

1. 创建 D1 数据库：

```bash
npx wrangler d1 create plant-price-db
```

把输出里的 `database_id` 填入 `worker/wrangler.toml`。

2. 创建 R2 bucket：

```bash
npx wrangler r2 bucket create plant-price-images
```

3. 初始化数据库：

```bash
cd worker
npx wrangler d1 execute plant-price-db --remote --file ./schema.sql
```

4. 设置维护端登录码：

```bash
npx wrangler secret put MAINTAINER_SETUP_CODE
```

第一次登录时输入这个登录码即可创建或进入维护账号。

## 部署 Worker API

```bash
cd worker
npm install
npx wrangler deploy
```

部署完成后会得到一个 API 地址，例如：

```text
https://plant-price-api.your-name.workers.dev
```

## 部署前端到 Cloudflare Pages

1. 把本目录上传到 GitHub。
2. Cloudflare Pages 连接 GitHub 仓库。
3. 构建设置：

```text
Root directory: frontend
Build command: 留空
Build output directory: .
```

4. 编辑 `frontend/config.js`，填入 Worker API 地址：

```js
window.PLANT_PRICE_CONFIG = {
  API_BASE_URL: "https://plant-price-api.your-name.workers.dev",
};
```

## 本地预览前端

直接打开：

```text
frontend/index.html
```

如果没有配置 API，页面会使用内置示例数据展示界面。

## 建议

- 图片上传前已在浏览器压缩，建议宽度限制 1280px，质量 0.75。
- 绿联 NAS 定期备份 D1 导出和 R2 图片。
- 查询端保持公开只读；维护端才需要登录。
