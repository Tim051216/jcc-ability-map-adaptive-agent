import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import playwright from "../a3-student-react-web/node_modules/playwright/index.js";

const { chromium } = playwright;

const root = process.cwd();
const htmlFile = path.resolve(root, "outputs", "a3-all-services-api-doc.html");
const outputDir = path.resolve(root, "outputs", "api-doc-screenshots");

const serviceNames = {
  as: "认证服务",
  ls: "学习服务",
  us: "用户服务",
  cs: "课程资源服务",
};

function safeName(value) {
  return String(value)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function cleanOutputDir() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
}

async function writeIndex(items) {
  const lines = [
    "# A3 接口测试文档截图",
    "",
    "这些图片由 `outputs/a3-all-services-api-doc.html` 生成，接口展开后可看到 `接口测试 / OK / HTTP 200`。",
    "",
    "| 文件 | 内容 |",
    "| --- | --- |",
    ...items.map((item) => `| [${item.file}](./${item.file}) | ${item.title} |`),
    "",
  ];
  await fs.writeFile(path.join(outputDir, "README.md"), lines.join("\n"), "utf8");
}

async function main() {
  await cleanOutputDir();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1,
  });

  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
  const items = [];

  const overviewFile = "00-overview.png";
  await page.screenshot({
    path: path.join(outputDir, overviewFile),
    clip: { x: 0, y: 0, width: 1440, height: 1100 },
  });
  items.push({ file: overviewFile, title: "全部服务总览" });

  const serviceIds = await page.$$eval("article.service", (nodes) =>
    nodes.map((node) => node.id.replace("service-", ""))
  );

  let imageIndex = 1;
  for (const serviceId of serviceIds) {
    const service = page.locator(`#service-${serviceId}`);
    await service.scrollIntoViewIfNeeded();

    const headerFile = `${String(imageIndex++).padStart(2, "0")}-${serviceId}-service-overview.png`;
    await service.locator(":scope > header").screenshot({
      path: path.join(outputDir, headerFile),
    });
    items.push({
      file: headerFile,
      title: `${serviceNames[serviceId] || serviceId}服务概览`,
    });

    const tagCount = await service.locator(".tag-section").count();
    for (let tagIndex = 0; tagIndex < tagCount; tagIndex += 1) {
      const tag = service.locator(".tag-section").nth(tagIndex);
      await tag.locator("details.endpoint").evaluateAll((nodes) => {
        for (const node of nodes) node.open = true;
      });
      await tag.scrollIntoViewIfNeeded();

      const title = await tag.locator("h3").innerText();
      const file = `${String(imageIndex++).padStart(2, "0")}-${serviceId}-${String(tagIndex + 1).padStart(2, "0")}-${safeName(title)}.png`;
      await tag.screenshot({
        path: path.join(outputDir, file),
      });
      items.push({
        file,
        title: `${serviceNames[serviceId] || serviceId} - ${title}`,
      });
    }
  }

  await browser.close();
  await writeIndex(items);
  console.log(outputDir);
  console.log(`images=${items.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
