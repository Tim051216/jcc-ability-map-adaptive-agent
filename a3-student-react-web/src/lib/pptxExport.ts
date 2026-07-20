export type DeckSlide = {
  kind?: "cover" | "agenda" | "content" | "ending";
  title: string;
  subtitle?: string;
  bullets: string[];
  accent?: string;
  background?: string;
  speakerNote?: string;
  illustration?: {
    title: string;
    caption: string;
    type?: "concept" | "flow" | "scenario" | "summary";
  };
};

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const textEncoder = new TextEncoder();
const SLIDE_WIDTH = 12192000;
const SLIDE_HEIGHT = 6858000;
const PPT_ILLUSTRATION_ASSET_PATH = "/generated-resource-illustrations/ppt/software-engineering-classroom.svg";

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeText(value: string) {
  return textEncoder.encode(value);
}

function toDosDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const dosDate =
    (((year - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosDate, dosTime };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8Arrays(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function createStoredZip(entries: ZipEntry[]) {
  const fileChunks: Uint8Array[] = [];
  const directoryChunks: Uint8Array[] = [];
  let offset = 0;
  const { dosDate, dosTime } = toDosDate();

  for (const entry of entries) {
    const nameBytes = encodeText(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    fileChunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    directoryChunks.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatUint8Arrays(directoryChunks);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...fileChunks, centralDirectory, endRecord], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function buildTextParagraphs(
  lines: string[],
  fontSize: number,
  color = "243042",
  level = 0,
  withBullets = false,
) {
  const safeLines = lines.filter(Boolean).slice(0, 8);
  if (!safeLines.length) {
    return `<a:p><a:endParaRPr lang="zh-CN" sz="${fontSize}"/></a:p>`;
  }
  return safeLines
    .map((line) => {
      const bulletXml = withBullets
        ? `<a:pPr lvl="${level}"><a:buChar char="•"/></a:pPr>`
        : `<a:pPr lvl="${level}"/>`;
      return `
        <a:p>
          ${bulletXml}
          <a:r>
            <a:rPr lang="zh-CN" sz="${fontSize}" dirty="0" smtClean="0">
              <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
            </a:rPr>
            <a:t>${xmlEscape(line)}</a:t>
          </a:r>
          <a:endParaRPr lang="zh-CN" sz="${fontSize}">
            <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          </a:endParaRPr>
        </a:p>`;
    })
    .join("");
}

function buildShapeXml(id: number, name: string, x: number, y: number, cx: number, cy: number, fill: string, radius = 0) {
  const radiusXml = radius
    ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${radius}"/></a:avLst></a:prstGeom>`
    : `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;
  return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${id}" name="${xmlEscape(name)}"/>
        <p:cNvSpPr/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${x}" y="${y}"/>
          <a:ext cx="${cx}" cy="${cy}"/>
        </a:xfrm>
        ${radiusXml}
        <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
        <a:ln><a:noFill/></a:ln>
      </p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
    </p:sp>`;
}

function buildTextBoxXml(
  id: number,
  name: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  paragraphs: string,
  vertical = "horz",
) {
  return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${id}" name="${xmlEscape(name)}"/>
        <p:cNvSpPr txBox="1"/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${x}" y="${y}"/>
          <a:ext cx="${cx}" cy="${cy}"/>
        </a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        <a:noFill/>
        <a:ln><a:noFill/></a:ln>
      </p:spPr>
      <p:txBody>
        <a:bodyPr wrap="square" rtlCol="0" anchor="t" vert="${vertical}"/>
        <a:lstStyle/>
        ${paragraphs}
      </p:txBody>
    </p:sp>`;
}
function buildPictureXml(id: number, name: string, x: number, y: number, cx: number, cy: number) {
  return `
    <p:pic>
      <p:nvPicPr>
        <p:cNvPr id="${id}" name="${xmlEscape(name)}" descr="${xmlEscape(name)}"/>
        <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
        <p:nvPr/>
      </p:nvPicPr>
      <p:blipFill>
        <a:blip r:embed="rId2"/>
        <a:stretch><a:fillRect/></a:stretch>
      </p:blipFill>
      <p:spPr>
        <a:xfrm>
          <a:off x="${x}" y="${y}"/>
          <a:ext cx="${cx}" cy="${cy}"/>
        </a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </p:spPr>
    </p:pic>`;
}

function buildEllipseXml(id: number, name: string, x: number, y: number, cx: number, cy: number, fill: string) {
  return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${id}" name="${xmlEscape(name)}"/>
        <p:cNvSpPr/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${x}" y="${y}"/>
          <a:ext cx="${cx}" cy="${cy}"/>
        </a:xfrm>
        <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
        <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
        <a:ln><a:noFill/></a:ln>
      </p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
    </p:sp>`;
}

function getSlideIllustration(slide: DeckSlide) {
  return (
    slide.illustration || {
      title: slide.kind === "ending" ? "学习闭环图" : slide.kind === "agenda" ? "章节路线图" : "概念结构图",
      caption: slide.subtitle || slide.bullets[0] || "用插画把本页内容转成更容易讲解的视觉线索。",
      type: slide.kind === "ending" ? "summary" : slide.kind === "agenda" ? "flow" : "concept",
    }
  );
}

function getPptTemplateKey(slide: DeckSlide) {
  const value = String(slide.accent || "").toLowerCase();
  if (value === "defense" || value === "warm" || value === "chalkboard" || value === "techgrid" || value === "minimalreport") {
    return value;
  }
  return "academic";
}

function resolvePptAccentColor(slide: DeckSlide, fallback = "FB7299") {
  const value = String(slide.accent || "").trim();
  if (/^[0-9a-f]{6}$/i.test(value)) return value.toUpperCase();
  const templateKey = getPptTemplateKey(slide);
  if (templateKey === "defense") return "2F6BFF";
  if (templateKey === "warm") return "F97316";
  if (templateKey === "chalkboard") return "DFF7EF";
  if (templateKey === "techgrid") return "20D3EE";
  if (templateKey === "minimalreport") return "111827";
  return fallback;
}

function buildIllustrationXml(idStart: number, x: number, y: number, cx: number, cy: number, accent: string, slide: DeckSlide) {
  const illustration = getSlideIllustration(slide);
  const templateKey = getPptTemplateKey(slide);
  const secondary =
    templateKey === "defense"
      ? "D9E6FF"
      : templateKey === "warm"
        ? "FED7AA"
        : templateKey === "chalkboard"
          ? "102A2A"
          : templateKey === "techgrid"
            ? "1E1B4B"
            : templateKey === "minimalreport"
              ? "E2E8F0"
              : "F3E3D8";
  const tertiary =
    templateKey === "defense"
      ? "EAF1FF"
      : templateKey === "warm"
        ? "FFF7ED"
        : templateKey === "chalkboard"
          ? "F8D47A"
          : templateKey === "techgrid"
            ? "7C3AED"
            : templateKey === "minimalreport"
              ? "F8FAFC"
              : "EEF3D8";
  const imageX = x + Math.round(cx * 0.07);
  const imageY = y + Math.round(cy * 0.08);
  const imageCx = Math.round(cx * 0.86);
  const imageCy = Math.round(cy * 0.66);

  return `
      ${buildShapeXml(idStart, "Illustration Card", x, y, cx, cy, "FFFFFF", 18000)}
      ${buildShapeXml(idStart + 1, "Illustration Wash", x + 120000, y + 120000, cx - 240000, cy - 240000, tertiary, 18000)}
      ${buildShapeXml(idStart + 2, "Illustration Back Plate", imageX - 50000, imageY - 50000, imageCx + 100000, imageCy + 100000, secondary, 14000)}
      ${buildPictureXml(idStart + 3, "Software Engineering Classroom Illustration", imageX, imageY, imageCx, imageCy)}
      ${buildTextBoxXml(idStart + 17, "Illustration Title", x + Math.round(cx * 0.09), y + Math.round(cy * 0.81), Math.round(cx * 0.78), Math.round(cy * 0.08), buildTextParagraphs([illustration.title], 1150, "111827"))}
      ${buildTextBoxXml(idStart + 18, "Illustration Caption", x + Math.round(cx * 0.09), y + Math.round(cy * 0.89), Math.round(cx * 0.78), Math.round(cy * 0.09), buildTextParagraphs([illustration.caption], 900, "667085"))}
  `;
}

function buildCoverSlideXml(slide: DeckSlide) {
  const accent = resolvePptAccentColor(slide, "FB7299");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${buildShapeXml(2, "Background", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, "FFF7FB")}
      ${buildShapeXml(3, "Accent Left", 0, 0, 1680000, SLIDE_HEIGHT, accent)}
      ${buildShapeXml(4, "Accent Panel", 1320000, 640000, 8500000, 5100000, "FFFFFF", 12500)}
      ${buildShapeXml(5, "Tag", 1780000, 1180000, 1640000, 420000, accent, 32000)}
      ${buildTextBoxXml(6, "Tag Text", 1900000, 1240000, 1400000, 260000, buildTextParagraphs(["BILILEARN AI COURSEWARE"], 1300, "FFFFFF"))}
      ${buildTextBoxXml(7, "Cover Title", 1780000, 1920000, 7600000, 1180000, buildTextParagraphs([slide.title], 2800, "111827"))}
      ${buildTextBoxXml(
        8,
        "Cover Subtitle",
        1780000,
        3140000,
        7200000,
        980000,
        buildTextParagraphs([slide.subtitle || slide.bullets[0] || "围绕当前课程自动整理的学习课件草案"], 1800, "667085"),
      )}
      ${buildTextBoxXml(9, "Cover Footer", 1780000, 5050000, 5200000, 420000, buildTextParagraphs(["生成方式：多智能体协同整理 · 可继续扩展为讲义、导图、练习"], 1200, accent))}
      ${buildIllustrationXml(20, 8200000, 1240000, 2600000, 4200000, accent, slide)}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
}

function buildAgendaSlideXml(slide: DeckSlide) {
  const accent = resolvePptAccentColor(slide, "5B8FF9");
  const agenda = slide.bullets.slice(0, 6).map((item, index) => `${String(index + 1).padStart(2, "0")}  ${item}`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${buildShapeXml(2, "Background", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, "FFFFFF")}
      ${buildShapeXml(3, "Accent Bar", 0, 0, 220000, SLIDE_HEIGHT, accent)}
      ${buildTextBoxXml(4, "Agenda Title", 960000, 820000, 5000000, 720000, buildTextParagraphs([slide.title], 2500, "111827"))}
      ${buildTextBoxXml(
        5,
        "Agenda Subtitle",
        960000,
        1500000,
        5600000,
        500000,
        buildTextParagraphs([slide.subtitle || "本次课件将围绕以下重点展开"], 1500, "667085"),
      )}
      ${buildShapeXml(6, "Agenda Panel", 850000, 2200000, 6500000, 3300000, "F8FAFC", 16000)}
      ${buildTextBoxXml(7, "Agenda Items", 1240000, 2480000, 6000000, 2700000, buildTextParagraphs(agenda, 1800, "243042"))}
      ${buildShapeXml(8, "Accent Dot", 8700000, 1120000, 1800000, 1800000, "FFE4ED")}
      ${buildShapeXml(9, "Accent Dot 2", 9150000, 1550000, 900000, 900000, accent)}
      ${buildIllustrationXml(20, 7900000, 3180000, 3100000, 2100000, accent, slide)}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
}

function buildContentSlideXml(slide: DeckSlide) {
  const accent = resolvePptAccentColor(slide, "FB7299");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${buildShapeXml(2, "Background", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, "FFFFFF")}
      ${buildShapeXml(3, "Top Bar", 0, 0, SLIDE_WIDTH, 260000, accent)}
      ${buildTextBoxXml(4, "Content Title", 900000, 780000, 7200000, 720000, buildTextParagraphs([slide.title], 2400, "111827"))}
      ${buildTextBoxXml(
        5,
        "Content Subtitle",
        900000,
        1450000,
        7200000,
        420000,
        buildTextParagraphs([slide.subtitle || "围绕知识点拆解出的课堂重点"], 1400, "667085"),
      )}
      ${buildShapeXml(6, "Content Panel", 780000, 2060000, 7200000, 3700000, "FFF8FB", 16000)}
      ${buildTextBoxXml(7, "Content Bullets", 1120000, 2380000, 6500000, 3000000, buildTextParagraphs(slide.bullets, 1800, "243042", 0, true))}
      ${buildIllustrationXml(20, 8640000, 1320000, 2600000, 4100000, accent, slide)}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
}

function buildEndingSlideXml(slide: DeckSlide) {
  const accent = resolvePptAccentColor(slide, "FB7299");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${buildShapeXml(2, "Background", 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, "FFF7FB")}
      ${buildShapeXml(3, "Center Panel", 1760000, 1160000, 8700000, 4300000, "FFFFFF", 18000)}
      ${buildTextBoxXml(4, "Ending Title", 2560000, 2060000, 7000000, 760000, buildTextParagraphs([slide.title], 2600, "111827"))}
      ${buildTextBoxXml(
        5,
        "Ending Subtitle",
        2560000,
        2860000,
        6800000,
        820000,
        buildTextParagraphs([slide.subtitle || "可以继续让 AI 导师扩展为讲义、导图、练习或资料包"], 1600, "667085"),
      )}
      ${buildTextBoxXml(6, "Ending Bullets", 2560000, 3840000, 6200000, 900000, buildTextParagraphs(slide.bullets, 1300, accent))}
      ${buildIllustrationXml(20, 8120000, 1780000, 2100000, 2800000, accent, slide)}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
}

function buildSlideXml(slide: DeckSlide) {
  switch (slide.kind) {
    case "cover":
      return buildCoverSlideXml(slide);
    case "agenda":
      return buildAgendaSlideXml(slide);
    case "ending":
      return buildEndingSlideXml(slide);
    default:
      return buildContentSlideXml(slide);
  }
}

function buildPresentationXml(slideCount: number) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => {
    const relId = `rId${index + 7}`;
    return `<p:sldId id="${256 + index}" r:id="${relId}"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1" autoCompressPictures="0">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>`;
}

function buildPresentationRels(slideCount: number) {
  const slideRels = Array.from({ length: slideCount }, (_, index) => {
    return `<Relationship Id="rId${index + 7}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings" Target="printerSettings/printerSettings1.bin"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>
  ${slideRels}
</Relationships>`;
}

const staticPptxParts = {
  rootRels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
  appXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office PowerPoint</Application>
</Properties>`,
  coreXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>BiliLearn AI Tutor Deck</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-06-10T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-06-10T00:00:00Z</dcterms:modified>
</cp:coreProperties>`,
  slideRels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/software-engineering-classroom.svg"/>
</Relationships>`,
  slideLayout: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="titleAndObj" preserve="1">
  <p:cSld name="Title and Content">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`,
  slideLayoutRels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  slideMaster: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Office Theme">
    <p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`,
  slideMasterRels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  themeXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F2937"/></a:dk2>
      <a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="FB7299"/></a:accent1>
      <a:accent2><a:srgbClr val="38BDF8"/></a:accent2>
      <a:accent3><a:srgbClr val="F59E0B"/></a:accent3>
      <a:accent4><a:srgbClr val="34D399"/></a:accent4>
      <a:accent5><a:srgbClr val="818CF8"/></a:accent5>
      <a:accent6><a:srgbClr val="F472B6"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink>
      <a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Aptos"/><a:ea typeface="等线"/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="等线"/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`,
  presProps: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
  viewProps: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
  tableStyles: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`,
  printerSettings: new Uint8Array([0]),
};

function buildContentTypesXml(slideCount: number) {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => {
    return `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="svg" ContentType="image/svg+xml"/>
  <Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.presentationml.printerSettings"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${slideOverrides}
</Types>`;
}

async function loadPptIllustrationAsset() {
  const response = await fetch(PPT_ILLUSTRATION_ASSET_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load PPT illustration asset: ${PPT_ILLUSTRATION_ASSET_PATH}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function exportDeckAsPptx(fileName: string, slides: DeckSlide[]) {
  const safeSlides = slides.length
    ? slides
    : [{ kind: "content" as const, title: "课件提纲", subtitle: "暂无生成内容", bullets: ["当前没有可导出的内容。"] }];
  const illustrationAsset = await loadPptIllustrationAsset();

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: encodeText(buildContentTypesXml(safeSlides.length)) },
    { name: "_rels/.rels", data: encodeText(staticPptxParts.rootRels) },
    { name: "docProps/app.xml", data: encodeText(staticPptxParts.appXml) },
    { name: "docProps/core.xml", data: encodeText(staticPptxParts.coreXml) },
    { name: "ppt/presentation.xml", data: encodeText(buildPresentationXml(safeSlides.length)) },
    { name: "ppt/_rels/presentation.xml.rels", data: encodeText(buildPresentationRels(safeSlides.length)) },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: encodeText(staticPptxParts.slideLayout) },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: encodeText(staticPptxParts.slideLayoutRels) },
    { name: "ppt/slideMasters/slideMaster1.xml", data: encodeText(staticPptxParts.slideMaster) },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: encodeText(staticPptxParts.slideMasterRels) },
    { name: "ppt/theme/theme1.xml", data: encodeText(staticPptxParts.themeXml) },
    { name: "ppt/presProps.xml", data: encodeText(staticPptxParts.presProps) },
    { name: "ppt/viewProps.xml", data: encodeText(staticPptxParts.viewProps) },
    { name: "ppt/tableStyles.xml", data: encodeText(staticPptxParts.tableStyles) },
    { name: "ppt/printerSettings/printerSettings1.bin", data: staticPptxParts.printerSettings },
    { name: "ppt/media/software-engineering-classroom.svg", data: illustrationAsset },
  ];

  safeSlides.forEach((slide, index) => {
    entries.push({
      name: `ppt/slides/slide${index + 1}.xml`,
      data: encodeText(buildSlideXml(slide)),
    });
    entries.push({
      name: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
      data: encodeText(staticPptxParts.slideRels),
    });
  });

  const blob = createStoredZip(entries);
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
}

