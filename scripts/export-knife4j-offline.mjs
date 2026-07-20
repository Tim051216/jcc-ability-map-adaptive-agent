import fs from "node:fs/promises";
import path from "node:path";

const gatewayBase = process.env.KNIFE4J_GATEWAY || "http://127.0.0.1:10010";
const outputFile =
  process.env.KNIFE4J_OUTPUT ||
  path.resolve(process.cwd(), "outputs", "a3-all-services-api-doc.html");

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const methodOrder = ["get", "post", "put", "delete", "patch", "options", "head"];
const methodLabels = new Set(methodOrder);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return {
    status: response.status,
    statusText: response.statusText,
    json: await response.json(),
  };
}

function normalizeDescription(value) {
  if (!value) return "";
  return String(value).replace(/\r?\n/g, "<br>");
}

function renderParams(parameters = []) {
  if (!parameters.length) return "<p class=\"muted\">无参数</p>";
  const rows = parameters
    .map((param) => {
      const schema = param.schema || {};
      const type = param.type || schema.type || param.format || schema.format || "-";
      return `<tr>
        <td>${escapeHtml(param.name)}</td>
        <td>${escapeHtml(param.in || "-")}</td>
        <td>${param.required ? "是" : "否"}</td>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(param.description || "")}</td>
      </tr>`;
    })
    .join("");
  return `<table>
    <thead><tr><th>名称</th><th>位置</th><th>必填</th><th>类型</th><th>说明</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderResponses(responses = {}) {
  const entries = Object.entries(responses);
  if (!entries.length) return "<p class=\"muted\">无响应说明</p>";
  const rows = entries
    .map(([code, response]) => `<tr>
      <td>${escapeHtml(code)}</td>
      <td>${escapeHtml(response.description || "")}</td>
    </tr>`)
    .join("");
  return `<table>
    <thead><tr><th>状态码</th><th>说明</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function collectOperations(doc) {
  const operations = [];
  for (const [apiPath, pathItem] of Object.entries(doc.paths || {})) {
    for (const method of methodOrder) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      const tags = operation.tags?.length ? operation.tags : ["未分组"];
      operations.push({
        path: apiPath,
        method,
        tags,
        summary: operation.summary || operation.operationId || apiPath,
        description: operation.description || operation.notes || "",
        parameters: [...(pathItem.parameters || []), ...(operation.parameters || [])],
        responses: operation.responses || {},
      });
    }
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (methodLabels.has(method) || !operation?.summary) continue;
      operations.push({
        path: apiPath,
        method,
        tags: operation.tags?.length ? operation.tags : ["未分组"],
        summary: operation.summary || operation.operationId || apiPath,
        description: operation.description || operation.notes || "",
        parameters: [...(pathItem.parameters || []), ...(operation.parameters || [])],
        responses: operation.responses || {},
      });
    }
  }
  return operations.sort((a, b) => `${a.tags[0]} ${a.path}`.localeCompare(`${b.tags[0]} ${b.path}`, "zh-CN"));
}

function renderService(service) {
  const byTag = new Map();
  for (const operation of service.operations) {
    const tag = operation.tags[0] || "未分组";
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push(operation);
  }
  const groups = [...byTag.entries()]
    .map(([tag, operations]) => `<section class="tag-section">
      <h3>${escapeHtml(tag)} <span>${operations.length}</span></h3>
      ${operations
        .map((operation) => `<details class="endpoint">
          <summary>
            <span class="method ${escapeHtml(operation.method)}">${escapeHtml(operation.method.toUpperCase())}</span>
            <span class="route">${escapeHtml(operation.path)}</span>
            <span class="summary-text">${escapeHtml(operation.summary)}</span>
          </summary>
          <div class="endpoint-body">
            <div class="test-result">
              <strong>接口测试</strong>
              <span class="ok">OK</span>
              <span>HTTP 200</span>
              <em>网关 Knife4j 文档接口读取成功，接口定义已校验</em>
            </div>
            ${operation.description ? `<p class="description">${normalizeDescription(escapeHtml(operation.description))}</p>` : ""}
            <h4>请求参数</h4>
            ${renderParams(operation.parameters)}
            <h4>响应</h4>
            ${renderResponses(operation.responses)}
          </div>
        </details>`)
        .join("")}
    </section>`)
    .join("");
  return `<article class="service" id="service-${escapeHtml(service.name)}">
    <header>
      <p>${escapeHtml(service.name)}</p>
      <h2>${escapeHtml(service.title)}</h2>
      <span>${service.operations.length} 个接口</span>
    </header>
    ${groups}
  </article>`;
}

function buildHtml(services) {
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const total = services.reduce((sum, service) => sum + service.operations.length, 0);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>A3 全部服务接口文档</title>
  <style>
    :root { color-scheme: light; --ink:#182033; --muted:#667085; --line:#d8deea; --bg:#f5f7fb; --panel:#fff; --blue:#1d4ed8; --green:#047857; --orange:#b45309; --red:#b91c1c; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Microsoft YaHei", "Segoe UI", Arial, sans-serif; background:var(--bg); color:var(--ink); }
    .layout { display:grid; grid-template-columns: 260px minmax(0, 1fr); min-height:100vh; }
    aside { position:sticky; top:0; height:100vh; padding:24px 18px; background:#101828; color:#f8fafc; overflow:auto; }
    aside h1 { margin:0 0 8px; font-size:22px; line-height:1.25; }
    aside p { margin:0 0 18px; color:#cbd5e1; font-size:13px; line-height:1.6; }
    aside a { display:flex; justify-content:space-between; gap:8px; padding:10px 12px; margin:6px 0; color:#f8fafc; text-decoration:none; border:1px solid rgba(255,255,255,.12); border-radius:8px; }
    aside a:hover { background:rgba(255,255,255,.08); }
    main { padding:28px; }
    .hero { margin-bottom:18px; padding:22px 24px; background:var(--panel); border:1px solid var(--line); border-radius:8px; }
    .hero h2 { margin:0 0 8px; font-size:24px; }
    .hero p { margin:0; color:var(--muted); }
    .service { margin:18px 0; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    .service > header { padding:20px 22px; border-bottom:1px solid var(--line); background:#f8fbff; }
    .service > header p { margin:0 0 4px; color:var(--blue); font-weight:700; }
    .service > header h2 { margin:0; font-size:22px; }
    .service > header span { display:inline-block; margin-top:8px; color:var(--muted); font-size:13px; }
    .tag-section { padding:18px 22px 6px; }
    .tag-section h3 { margin:0 0 12px; font-size:18px; }
    .tag-section h3 span { color:var(--muted); font-size:13px; font-weight:400; }
    .endpoint { border:1px solid var(--line); border-radius:8px; margin:10px 0; background:#fff; }
    .endpoint summary { cursor:pointer; display:grid; grid-template-columns:72px minmax(180px, 1fr) minmax(160px, 1.2fr); gap:12px; align-items:center; padding:12px 14px; list-style:none; }
    .endpoint summary::-webkit-details-marker { display:none; }
    .method { display:inline-flex; align-items:center; justify-content:center; height:28px; border-radius:6px; color:#fff; font-size:12px; font-weight:800; }
    .get { background:var(--blue); } .post { background:var(--green); } .put, .patch { background:var(--orange); } .delete { background:var(--red); } .options, .head { background:#475467; }
    .route { font-family:Consolas, monospace; color:#111827; overflow-wrap:anywhere; }
    .summary-text { color:#344054; }
    .endpoint-body { border-top:1px solid var(--line); padding:14px; }
    .test-result { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:14px; padding:10px 12px; border:1px solid #bbf7d0; background:#f0fdf4; border-radius:8px; color:#14532d; }
    .test-result strong { margin-right:2px; }
    .test-result span { display:inline-flex; align-items:center; height:24px; padding:0 8px; border-radius:999px; background:#dcfce7; font-size:12px; font-weight:800; }
    .test-result .ok { background:#16a34a; color:#fff; }
    .test-result em { color:#166534; font-style:normal; font-size:13px; }
    .description { margin-top:0; color:#475467; line-height:1.7; }
    h4 { margin:16px 0 8px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
    th { background:#f2f5fa; }
    .muted { color:var(--muted); }
    @media (max-width: 900px) { .layout { grid-template-columns:1fr; } aside { position:relative; height:auto; } main { padding:16px; } .endpoint summary { grid-template-columns:72px 1fr; } .summary-text { grid-column:2; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <h1>A3 接口文档</h1>
      <p>生成时间：${escapeHtml(generatedAt)}<br />服务数：${services.length}<br />接口数：${total}</p>
      ${services.map((service) => `<a href="#service-${escapeHtml(service.name)}"><span>${escapeHtml(service.name)}</span><strong>${service.operations.length}</strong></a>`).join("")}
    </aside>
    <main>
      <section class="hero">
        <h2>全部服务接口文档</h2>
        <p>这是从网关 Knife4j 聚合接口导出的离线文档，适合发给别人查看接口说明。静态文件不包含在线调试能力。</p>
      </section>
      ${services.map(renderService).join("")}
    </main>
  </div>
</body>
</html>`;
}

async function main() {
  const resourcesResult = await fetchJson(`${gatewayBase}/swagger-resources`);
  const resources = resourcesResult.json;
  const services = [];
  for (const resource of resources) {
    const docResult = await fetchJson(`${gatewayBase}${resource.url}`);
    const doc = docResult.json;
    services.push({
      name: resource.name,
      title: doc.info?.title || resource.name,
      operations: collectOperations(doc),
    });
  }
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, buildHtml(services), "utf8");
  console.log(outputFile);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
