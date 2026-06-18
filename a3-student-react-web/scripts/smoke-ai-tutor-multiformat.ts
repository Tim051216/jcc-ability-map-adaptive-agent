import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL = process.env.AI_TUTOR_BASE_URL ?? "http://127.0.0.1:3002";
const LOGIN_ID = process.env.AI_TUTOR_LOGIN_ID ?? "demo2024";
const LOGIN_PASSWORD = process.env.AI_TUTOR_LOGIN_PASSWORD ?? "bililearn";

type SampleSpec = {
  fileName: string;
  expectedText: string;
};

const SAMPLE_SPECS: SampleSpec[] = [
  { fileName: "sample.txt", expectedText: "React state management" },
  { fileName: "sample.docx", expectedText: "React state management" },
  { fileName: "sample.xlsx", expectedText: "React state management" },
  { fileName: "sample.pptx", expectedText: "React state management" },
  { fileName: "sample.pdf", expectedText: "React state management" },
];

const PYTHON_SAMPLE_GENERATOR = String.raw`
from __future__ import annotations
from io import BytesIO
from pathlib import Path
import sys
import zipfile

from docx import Document
from openpyxl import Workbook

out_dir = Path(sys.argv[1])
out_dir.mkdir(parents=True, exist_ok=True)

(out_dir / "sample.txt").write_text(
    "React state management\nSplit local and global state\nPrefer one-way data flow",
    encoding="utf-8",
)

doc = Document()
doc.add_paragraph("React state management")
doc.add_paragraph("Context plus reducer helps share state")
doc.save(out_dir / "sample.docx")

workbook = Workbook()
sheet = workbook.active
sheet.title = "Study Plan"
sheet.append(["Topic", "Note"])
sheet.append(["React state management", "Prefer one-way data flow"])
workbook.save(out_dir / "sample.xlsx")

content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>"""
rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""
presentation = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>"""
presentation_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>"""
slide_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:t>React state management</a:t><a:t>Split state intentionally</a:t></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>"""
with zipfile.ZipFile(out_dir / "sample.pptx", "w") as archive:
    archive.writestr("[Content_Types].xml", content_types)
    archive.writestr("_rels/.rels", rels)
    archive.writestr("ppt/presentation.xml", presentation)
    archive.writestr("ppt/_rels/presentation.xml.rels", presentation_rels)
    archive.writestr("ppt/slides/slide1.xml", slide_xml)

lines = ["BT", "/F1 12 Tf", "72 720 Td", "(React state management) Tj", "0 -18 Td", "(Prefer one-way data flow) Tj", "ET"]
stream = "\n".join(lines).encode("latin-1")
objects = [
    b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    b"5 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"\nendstream endobj",
]
pdf = bytearray(b"%PDF-1.4\n")
offsets = [0]
for obj in objects:
    offsets.append(len(pdf))
    pdf.extend(obj)
    pdf.extend(b"\n")
xref_offset = len(pdf)
pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
pdf.extend(b"0000000000 65535 f \n")
for offset in offsets[1:]:
    pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
pdf.extend((f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF").encode("ascii"))
(out_dir / "sample.pdf").write_bytes(bytes(pdf))
`;

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  const idInput = page.locator("#login-id-input");
  if (await idInput.count()) {
    await idInput.fill(LOGIN_ID);
    await page.locator("#login-password-input").fill(LOGIN_PASSWORD);
    await page.locator("#login-submit-btn").click({ force: true });
    await page.waitForURL("**/", { timeout: 20_000 });
    await page.waitForTimeout(1_000);
  }
  await page.evaluate(() => {
    sessionStorage.setItem("hasSeenWelcome", "true");
    localStorage.setItem("a3-student-welcome-seen", "true");
  });
}

async function openTutor(page: Page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('button[aria-label="打开 AI 导师侧栏"]:visible').waitFor({ state: "visible", timeout: 30_000 });
  await page.locator('button[aria-label="打开 AI 导师侧栏"]:visible').click({ force: true });
  await page.waitForTimeout(1_000);
}

async function verifySample(page: Page, filePath: string, expectedText: string) {
  await openTutor(page);
  await page.locator('input[type="file"]').setInputFiles(filePath);

  await page.locator('text="已提取正文"').first().waitFor({ state: "visible", timeout: 20_000 });
  const expandButton = page.locator('button:has-text("展开正文")').first();
  await expandButton.waitFor({ state: "visible", timeout: 20_000 });
  await expandButton.click();
  await page.waitForTimeout(800);

  const sidebarText = await page.locator("aside").last().innerText();
  if (!sidebarText.includes(expectedText)) {
    throw new Error(`Expected extracted text not found for ${path.basename(filePath)}. Sidebar text: ${sidebarText}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bililearn-ai-tutor-multiformat-"));

  try {
    execFileSync("python", ["-c", PYTHON_SAMPLE_GENERATOR, tempDir], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    await login(page);

    const checks: Array<{ fileName: string; ok: boolean }> = [];
    for (const spec of SAMPLE_SPECS) {
      const filePath = path.join(tempDir, spec.fileName);
      await verifySample(page, filePath, spec.expectedText);
      checks.push({ fileName: spec.fileName, ok: true });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks,
          tempDir,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

void main();
