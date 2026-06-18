from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deliverables" / "a3-defense-materials"
DOCX = OUT / "BiliLearn-defense-speech-7min.docx"
PPTX = OUT / "BiliLearn-defense-presentation.pptx"

TITLE = "BiliLearn"
SUBTITLE = "基于大模型的个性化资源生成与学习多智能体系统"

SPEECH_SECTIONS = [
    (
        "开场",
        "各位评委老师，大家好。我们团队的参赛作品是 BiliLearn。"
        "BiliLearn 面向高校数字化学习场景，聚焦资源很多但不够个性化、答疑存在时滞、学习过程缺少闭环这三个核心问题。"
        "我们希望借助大模型与多智能体技术，让学习平台从展示资源，升级为真正推动学习。",
    ),
    (
        "项目背景与痛点",
        "当前高校学习平台中，课程视频、讲义、练习和资料越来越丰富，但学生真正使用时仍然会遇到明显困难。"
        "第一，资源供给偏静态，难以根据学生的基础、进度和当前问题进行动态适配。"
        "第二，学生在学习过程中遇到问题时，常常缺少即时、连续、结合上下文的答疑支持。"
        "第三，学习、练习、反馈和路径调整之间彼此割裂，平台很难形成持续推进学生学习的闭环。",
    ),
    (
        "总体方案",
        "针对这些问题，我们设计并实现了 BiliLearn，一个基于大模型的个性化资源生成与学习多智能体系统。"
        "系统不是单一问答机器人，而是围绕学生学习全流程，构建学习画像、知识检索与答疑、学习规划、资源生成、测评反馈五个核心智能体。"
        "五个智能体分别处理不同学习任务，并通过课程上下文和学习状态形成协同。",
    ),
    (
        "核心创新",
        "我们的创新主要体现在三个方面。第一，多智能体协同。系统将学习任务拆解为画像、规划、资源、答疑和反馈五类角色，使智能能力更贴近真实学习流程。"
        "第二，动态资源生成。系统可以围绕当前课程主题和学习需求，自动生成讲义、笔记、练习题和知识脑图，让资源从预先准备变成按需生成。"
        "第三，学习闭环。学生可以从资源进入视频学习，在学习中提问，再结合生成资料继续理解，并根据系统建议推进下一步学习。",
    ),
    (
        "系统演示路线",
        "演示时，我们重点展示四条链路。首先是资源中心，学生可以查看已有资料，也可以一键智能补齐当前课程所需的讲义、笔记和练习。"
        "第二是资料预览与视频陪学，系统可以对视频进行总结、知识点时间轴整理、术语解释和分段问答。"
        "第三是 AI 导师，学生可以直接提问，也可以上传图片、PDF、Word、Excel、PPT 等资料，让系统提取正文并结合课程上下文解释。"
        "第四是个性化推进，系统会根据当前学习状态给出下一步建议。",
    ),
    (
        "技术架构",
        "技术上，我们采用前后端分离与 AI 服务协同的架构。前端负责学习场景、资源中心、视频陪学和 AI 导师等交互界面；"
        "后端负责课程、资源、用户学习数据和业务流程管理；AI 服务负责大模型调用、资源生成、视频理解和智能体编排。"
        "这样的设计既保证了功能解耦，也便于后续扩展更多智能体能力。",
    ),
    (
        "应用价值",
        "从应用价值来看，本项目可以为学生、教师和学校三类角色带来提升。对学生来说，系统可以降低理解门槛，提高学习效率和连续性。"
        "对教师来说，系统可以减少重复性资料整理和答疑工作。对学校和教育平台来说，系统提供了一条从数字资源平台升级为智能学习支持平台的可落地路径。",
    ),
    (
        "结束语",
        "总的来说，我们希望解决的不只是有没有资源，而是资源能不能更适合学生，系统能不能真正陪着学生学下去。"
        "未来，我们还可以继续扩展更细粒度的学习诊断、更精准的推荐策略，以及更完整的教师反馈分析能力。以上就是我们的汇报，谢谢各位评委老师。",
    ),
]

SLIDES = [
    ("BiliLearn", ["基于大模型的个性化资源生成与学习多智能体系统", "第十五届中国软件杯 A3 赛题", "团队：请替换为队名 / 学校 / 成员"]),
    ("项目背景", ["高校数字化学习资源持续增长，但学习支持仍然不足", "资源静态：同一套资料难以适配不同学生", "答疑滞后：学生卡住时缺少即时上下文辅导", "过程割裂：学习、练习、反馈、路径调整缺少闭环"]),
    ("项目目标", ["构建面向高等教育场景的智能学习支持系统", "自动生成个性化学习资源", "通过多智能体协作陪伴学习全过程", "让平台从展示资源升级为推动学习"]),
    ("总体方案", ["学生处于系统中心，围绕学习任务调度不同智能体", "学习画像智能体：分析基础、偏好、薄弱点和目标", "知识检索与答疑智能体：RAG 检索、课程问答、上下文解释", "学习规划智能体：生成个性化学习路径和下一步建议", "资源生成与测评反馈智能体：补齐资料并形成学习反馈"]),
    ("核心创新", ["多智能体协同：按画像、规划、资源、答疑和反馈拆分智能角色", "动态资源生成：围绕课程和问题按需补齐资料", "视频理解增强：从播放视频升级为理解视频", "学习闭环：看、问、练、评、调连续联动"]),
    ("功能演示一：资源中心", ["查看当前课程已有讲义、笔记、视频和练习", "一键智能补齐课程资料", "按课程、类型、关键词筛选资源", "演示建议：打开 /resources 页面，展示已有资料与一键生成入口"]),
    ("功能演示二：视频陪学", ["自动生成 1 分钟版、3 分钟版和深度摘要", "支持知识点时间轴和术语解释", "支持围绕当前片段提问", "演示建议：打开视频资料预览页，展示右侧 AI 陪看面板"]),
    ("功能演示三：AI 导师", ["支持直接提问与连续追问", "支持上传图片、PDF、Word、Excel、PPT 等资料", "自动提取正文并插入问题", "结合课程上下文返回解释和建议"]),
    ("技术架构", ["前端层：React 学习端、资源中心、视频预览、AI 导师", "业务服务层：课程、资源、学习记录、用户数据", "AI 服务层：大模型调用、智能体编排、资源生成、视频理解", "数据闭环：学习行为 -> 智能分析 -> 个性化建议"]),
    ("应用价值", ["学生：降低理解门槛，提升学习效率", "教师：减少资料整理和重复答疑成本", "学校：支撑个性化教学与智能教育平台建设", "平台：从资源陈列转向智能学习支持"]),
    ("总结与展望", ["本项目探索大模型与多智能体在教育场景的真实落地", "已实现资源生成、视频陪学、AI 导师和学习推进闭环", "未来扩展：学习诊断、画像演化、推荐优化、教师反馈分析", "谢谢各位评委老师"]),
]


def set_font(run, size: float, bold: bool = False, color: str = "1F2937") -> None:
    run.font.name = "Microsoft YaHei"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_text(cell, text: str, bold: bool = False, color: str = "334155") -> None:
    p = cell.paragraphs[0]
    run = p.add_run(text)
    set_font(run, 10.5, bold, color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def build_docx() -> None:
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.85)
    section.bottom_margin = Inches(0.85)
    section.left_margin = Inches(0.9)
    section.right_margin = Inches(0.9)

    normal = doc.styles["Normal"]
    normal.font.name = "Microsoft YaHei"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(title.add_run(TITLE), 20, True, "171C22")

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(subtitle.add_run("7 分钟答辩演讲稿 | " + SUBTITLE), 11, False, "64748B")

    meta = doc.add_table(rows=4, cols=2)
    meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta.style = "Table Grid"
    meta_rows = [
        ("作品", "BiliLearn"),
        ("赛题", "A3-基于大模型的个性化资源生成与学习多智能体系统开发"),
        ("建议时长", "6 分 40 秒 - 7 分钟"),
        ("演示路线", "资源中心 -> 视频陪学 -> AI 导师 -> 技术架构与价值总结"),
    ]
    for row, (key, value) in zip(meta.rows, meta_rows):
        set_cell_shading(row.cells[0], "EEF2F6")
        set_cell_text(row.cells[0], key, True, "0F172A")
        set_cell_text(row.cells[1], value, False, "334155")

    doc.add_paragraph()
    for idx, (heading, body) in enumerate(SPEECH_SECTIONS, 1):
        h = doc.add_paragraph()
        set_font(h.add_run(f"{idx}. {heading}"), 14, True, "E85D8E")
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.35
        p.paragraph_format.space_after = Pt(8)
        set_font(p.add_run(body), 11, False, "1F2937")

    doc.add_page_break()
    h = doc.add_paragraph()
    set_font(h.add_run("PPT 逐页讲解提示"), 16, True, "171C22")

    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    for cell, text in zip(table.rows[0].cells, ["页码", "页面主题", "讲解重点"]):
        set_cell_shading(cell, "171C22")
        set_cell_text(cell, text, True, "FFFFFF")

    for idx, (title, bullets) in enumerate(SLIDES, 1):
        row = table.add_row().cells
        set_cell_text(row[0], str(idx), True, "E85D8E")
        set_cell_text(row[1], title, True, "0F172A")
        set_cell_text(row[2], "；".join(bullets[:3]), False, "334155")

    doc.save(DOCX)


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def tx_body(lines: list[str], font_size: int = 2400, color: str = "263238", bold_first: bool = False) -> str:
    paras = []
    for i, line in enumerate(lines):
        bullet = "" if i == 0 and bold_first else '<a:buChar char="•"/>'
        bold = "<a:b/>" if i == 0 and bold_first else ""
        paras.append(
            f'<a:p><a:pPr marL="300000" indent="-180000">{bullet}</a:pPr>'
            f'<a:r><a:rPr lang="zh-CN" sz="{font_size}" dirty="0">'
            f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>{bold}'
            f'<a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:rPr>'
            f"<a:t>{escape(line)}</a:t></a:r></a:p>"
        )
    return "<a:txBody><a:bodyPr/><a:lstStyle/>" + "".join(paras) + "</a:txBody>"


def text_shape(idn: int, x: int, y: int, cx: int, cy: int, lines: list[str], font_size: int = 2400, color: str = "263238", bold_first: bool = False) -> str:
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{idn}" name="Text {idn}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
        f'{tx_body(lines, font_size, color, bold_first)}</p:sp>'
    )


def rect_shape(idn: int, x: int, y: int, cx: int, cy: int, fill: str, line: str = "FFFFFF", shape: str = "roundRect") -> str:
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{idn}" name="Box {idn}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="{shape}"><a:avLst/></a:prstGeom>'
        f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill>'
        f'<a:ln><a:solidFill><a:srgbClr val="{line}"/></a:solidFill></a:ln></p:spPr></p:sp>'
    )


def slide_xml(index: int, title: str, bullets: list[str]) -> str:
    bg = "FBFDFF" if index % 2 else "F8FAFC"
    shapes = [rect_shape(2, 0, 0, 12192000, 6858000, bg, bg, "rect")]
    shapes.append(rect_shape(3, 0, 0, 12192000, 220000, "E85D8E", "E85D8E", "rect"))
    shapes.append(text_shape(4, 620000, 520000, 8500000, 850000, [title], 3300, "171C22", True))

    if index == 1:
        shapes.append(text_shape(5, 670000, 1650000, 7600000, 1500000, bullets, 2600, "334155"))
        shapes.append(rect_shape(6, 8700000, 1450000, 2200000, 2200000, "FFF2F7", "F9C8DA"))
        shapes.append(text_shape(7, 9020000, 2080000, 1700000, 900000, ["BiliLearn", "A3"], 2600, "E85D8E", True))
    elif index in (4, 5, 9):
        for n, bullet in enumerate(bullets[:5]):
            col = n % 2
            row = n // 2
            x = 620000 + col * 5500000
            y = 1500000 + row * 1280000
            shapes.append(rect_shape(10 + n, x, y, 5000000, 860000, "FFFFFF", "E7ECF0"))
            shapes.append(text_shape(20 + n, x + 220000, y + 170000, 4480000, 520000, [bullet], 2050, "263238"))
    else:
        shapes.append(rect_shape(6, 620000, 1450000, 10400000, 4300000, "FFFFFF", "E7ECF0"))
        shapes.append(text_shape(7, 980000, 1780000, 9600000, 3400000, bullets, 2450, "334155"))

    shapes.append(text_shape(90, 620000, 6350000, 4000000, 240000, [f"{index:02d} / {len(SLIDES):02d}"], 1200, "94A3B8"))
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<p:sld xmlns:a="{A_NS}" xmlns:r="{R_NS}" xmlns:p="{P_NS}"><p:cSld><p:spTree>'
        '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
        f'{"".join(shapes)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
    )


def build_pptx() -> None:
    n = len(SLIDES)
    content_types = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    ]
    content_types.extend(
        f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for i in range(1, n + 1)
    )
    content_types.append("</Types>")

    rels_root = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
        "</Relationships>"
    )
    sld_ids = "".join(f'<p:sldId id="{255 + i}" r:id="rId{i}"/>' for i in range(1, n + 1))
    presentation = (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<p:presentation xmlns:a="{A_NS}" xmlns:r="{R_NS}" xmlns:p="{P_NS}">'
        f'<p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/>'
        f'<p:sldIdLst>{sld_ids}</p:sldIdLst></p:presentation>'
    )
    pres_rels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
    pres_rels.extend(
        f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
        for i in range(1, n + 1)
    )
    pres_rels.append("</Relationships>")

    with ZipFile(PPTX, "w", ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", "".join(content_types))
        zf.writestr("_rels/.rels", rels_root)
        zf.writestr("ppt/presentation.xml", presentation)
        zf.writestr("ppt/_rels/presentation.xml.rels", "".join(pres_rels))
        for index, (title, bullets) in enumerate(SLIDES, 1):
            zf.writestr(f"ppt/slides/slide{index}.xml", slide_xml(index, title, bullets))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_docx()
    build_pptx()
    print(DOCX)
    print(PPTX)


if __name__ == "__main__":
    main()
