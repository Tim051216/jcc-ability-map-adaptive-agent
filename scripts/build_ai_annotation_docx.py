from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "deliverables" / "03-作品说明" / "AI数据标注实训智能体-项目说明.docx"
SCREENSHOT = ROOT / "output" / "playwright" / "ai-annotation-agent-with-sketch-20260913.png"


def set_run_font(run, name="Microsoft YaHei", size=10.5, bold=False, color="000000"):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color="D9E2EC"):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "5")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def style_paragraph(paragraph, *, size=10.5, bold=False, color="000000", align=None, before=0, after=5, line=1.25):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing = line
    if align is not None:
        paragraph.alignment = align
    for run in paragraph.runs:
        set_run_font(run, size=size, bold=bold, color=color)


def add_paragraph(doc, text, *, size=10.5, bold=False, color="000000", before=0, after=6, align=None):
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text)
    set_run_font(run, size=size, bold=bold, color=color)
    style_paragraph(paragraph, size=size, bold=bold, color=color, before=before, after=after, align=align)
    return paragraph


def add_heading(doc, text, level=1):
    sizes = {1: 16, 2: 13, 3: 11.5}
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.keep_with_next = True
    paragraph.paragraph_format.space_before = Pt(12 if level == 1 else 8)
    paragraph.paragraph_format.space_after = Pt(5)
    run = paragraph.add_run(text)
    set_run_font(run, size=sizes[level], bold=True, color="163A5F")
    return paragraph


def add_bullet(doc, text):
    paragraph = doc.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.left_indent = Inches(0.25)
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.paragraph_format.line_spacing = 1.2
    run = paragraph.add_run(text)
    set_run_font(run, size=10.5)
    return paragraph


def add_table(doc, headers, rows, widths):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    for index, header in enumerate(headers):
        cell = table.rows[0].cells[index]
        cell.width = Inches(widths[index])
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_margins(cell)
        set_cell_shading(cell, "DCEAF7")
        cell.text = ""
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(header)
        set_run_font(r, size=9.5, bold=True, color="163A5F")
    for row_index, row in enumerate(rows):
        cells = table.add_row().cells
        for index, value in enumerate(row):
            cell = cells[index]
            cell.width = Inches(widths[index])
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            set_cell_margins(cell)
            if row_index % 2 == 1:
                set_cell_shading(cell, "F6F9FC")
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(str(value))
            set_run_font(r, size=9.2)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return table


def add_footer(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.text = "AI 数据标注实训智能体 · 项目说明 · 技术 MVP 与外部证据分开核验"
    for run in p.runs:
        set_run_font(run, size=8.5, color="6B7280")


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.55)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)
    section.footer_distance = Inches(0.24)
    add_footer(section)

    normal = doc.styles["Normal"]
    normal.font.name = "Microsoft YaHei"
    normal._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(72)
    title.paragraph_format.space_after = Pt(10)
    title_run = title.add_run("AI 数据标注实训智能体")
    set_run_font(title_run, size=24, bold=True, color="163A5F")
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(32)
    subtitle_run = subtitle.add_run("人工智能技术应用专业群项目说明")
    set_run_font(subtitle_run, size=16, bold=True, color="2E6F95")
    for line in [
        "服务岗位：AI 数据标注工程师",
        "微任务：目标检测中的遮挡、截断与同类实例判定",
        "适用场景：教学实训、质检复核与岗位入门训练",
        "文档状态：技术 MVP 已完成，外部场景与真人试用证据待补",
    ]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(5)
        r = p.add_run(line)
        set_run_font(r, size=10.5, color="465A6B")
    doc.add_page_break()

    add_heading(doc, "1 项目摘要", 1)
    add_paragraph(doc, "本作品面向人工智能技术应用专业群的计算机视觉教学实训，服务 AI 数据标注工程师岗位。作品将目标检测标注中容易引起返工的三个微场景收敛为一个可验证任务：学生输入遮挡、截断或同类实例粘连的现象描述，智能体从 3 条核心执行规则中匹配一条候选规则，并以 60 条候选知识条目补充任务理解、坐标、质检和合规提示，返回框选步骤、属性字段提醒、常见错误、质检检查项和依据，并在同一页面采集试用反馈。页面还提供明确标注为“示意图（非真实样本）”的框选示意，帮助学生把文字规则对应到边界。")
    add_paragraph(doc, "当前技术 MVP 可独立运行。场景来源、学校平台字段和真人试用仍需团队按模板补齐，本文档不把候选内容或 AI 模拟记录写成外部事实。", color="7A4E00")

    add_heading(doc, "2 专业群 岗位与场景", 1)
    add_table(doc, ["项目要素", "当前口径", "核验状态"], [
        ["专业群", "人工智能技术应用专业群（计算机视觉方向）", "已确定"],
        ["核心岗位", "AI 数据标注工程师", "已确定"],
        ["教学环节", "目标检测标注实训的框选与提交质检", "待课程/平台记录核验"],
        ["具体困难", "遮挡、截断和同类实例边界判定不一致，可能造成漏标、误合并或质检返工", "待真实观察/访谈核验"],
    ], [1.25, 4.2, 1.8])
    add_paragraph(doc, "正式提交前，团队应使用《AI数据标注实训智能体-场景来源核验模板》记录课程名称、平台版本、日期、匿名身份、可观察行为和影响，并附经同意的脱敏访谈或实训观察记录。")

    add_heading(doc, "3 微任务闭环", 1)
    add_paragraph(doc, "系统在一个页面内完成输入、规则调用、逻辑处理、结果反馈和反馈记录。3 条核心执行规则负责确定性分支，60 条候选知识条目覆盖岗位词汇、边界案例、质检与合规提示；目录不依赖临时外部接口，适合现场演示和离线回归。")
    add_table(doc, ["环节", "实现", "页面证据"], [
        ["接收输入", "文字输入框、快捷问题、回车发送", "对话消息流"],
        ["调用规则库", "关键词意图识别，命中遮挡/截断/实例中的一条候选规则", "规则 ID 与依据"],
        ["逻辑处理", "按意图分支；无法判断时先询问现象和任务类型", "澄清消息"],
        ["生成结果", "编号步骤、属性提醒、常见错误、质检检查项和来源", "结构化回答"],
        ["反馈闭环", "浏览器本地保存，按记录类型导出 CSV", "反馈弹窗与下载文件"],
    ], [1.35, 3.8, 2.1])
    if SCREENSHOT.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(2)
        p.add_run().add_picture(str(SCREENSHOT), width=Inches(6.45))
        caption = doc.add_paragraph("图 1  AI 数据标注实训智能体页面（技术演示截图）")
        caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
        style_paragraph(caption, size=8.5, color="6B7280", after=8)

    add_heading(doc, "4 功能与交互设计", 1)
    add_table(doc, ["输入示例", "预期输出", "闭环价值"], [
        ["这张图里的人被车挡住了，框怎么画？", "遮挡规则、4 步框选建议、错误提示、属性和候选依据", "减少凭想象补全和把遮挡物并入框"],
        ["这个怎么弄？", "询问遮挡、截断、同类实例及目标检测/实例分割任务类型", "避免在信息不足时给出武断结论"],
        ["目标检测，目标出画面了", "截断规则、边界检查、bbox 字段说明和来源边界", "把平台字段和格式依据分开说明"],
        ["同类目标挨在一起，应该标几个框？", "按可独立辨认实例分别标框，提示不能合并", "支持质检前自查"],
    ], [2.35, 3.65, 1.25])
    add_paragraph(doc, "界面使用图标、编号步骤、警示提示、框选示意和来源行帮助高职学生快速扫描。示意图只用于解释可见区域框与图像边缘，不代表真实采集样本。反馈弹窗要求选择“真实用户试用”或“AI 模拟（内部演示）”，并按类型导出，避免模拟记录混入正式证据。")

    add_heading(doc, "5 专业知识与来源边界", 1)
    add_table(doc, ["来源编号", "来源", "可支持内容", "不能直接支持"], [
        ["S1", "《数据标注职业技能等级标准（2021 年 1.0 版）》", "图像 2D 拉框、标注实施和质量审核能力范围", "学校平台字段名、取值和阈值"],
        ["S2", "《人工智能训练师国家职业技能标准（2021 年版）》", "数据标注工种定位、准确性和完整性审核能力", "具体平台操作细则"],
        ["S3", "Microsoft COCO Dataset Data Format", "bbox、area、iscrowd 和坐标结构", "occluded、truncated 及学校边界政策"],
        ["S4", "学校平台 schema、课程实训手册和教师核验记录", "本校字段名、取值、必填性和质量阈值", "未取得记录前的确定性结论"],
    ], [0.7, 2.65, 2.55, 1.35])
    add_paragraph(doc, "页面将 S1-S3 作为候选依据并显示核验边界。`occluded`、`truncated` 的字段名称、取值和是否必填，只有在学校平台 schema 或教师核验版手册确认后才能升级为本校正式规则。来源文件哈希与页码定位见《AI数据标注实训智能体-来源文件核验清单》。")

    add_heading(doc, "6 技术实现", 1)
    add_bullet(doc, "前端采用 React 19、TypeScript、Vite、Tailwind CSS 和 Lucide 图标，页面入口为 `/annotation-agent`，兼容 `/ai-annotation-agent`。")
    add_bullet(doc, "规则库独立维护在 `src/data/aiAnnotationRules.ts`，包含 ANN-OCC-01、ANN-TRU-01、ANN-INS-01 三条核心稳定规则，以及 K001–K060 共 60 条候选知识条目；条目带来源编号、定位和候选状态。")
    add_bullet(doc, "反馈记录保存在浏览器 localStorage，不上传真实图片或个人敏感信息，CSV 导出时保留记录类型、匿名身份、评分、意见和时间。")
    add_bullet(doc, "仓库根目录提供 `scripts/start-ai-annotation.ps1` 启动脚本，默认端口 3002；局域网试用须使用项目电脑 WLAN IPv4。")
    add_bullet(doc, "页面顶部、场景提示和每条助手回答显示‘AI生成内容 · 教学辅助’，并明确提交前需教师核验；该标识不代表真人反馈或已确认的学校平台规则。")

    add_heading(doc, "7 八项要求对应关系", 1)
    add_table(doc, ["要求", "本作品证据", "当前状态"], [
        ["1 场景真实性", "候选场景描述、来源核验模板", "待真实观察/访谈"],
        ["2 功能闭环性", "输入、规则匹配、逻辑分支、结果、反馈导出", "已实现"],
        ["3 内容专业性", "来源映射、文件核验清单、页面依据", "候选来源待教师复核"],
        ["4 交互友好性", "模糊问题澄清、编号步骤、错误提示", "已实现"],
        ["5 专业群与岗位", "人工智能技术应用 / AI 数据标注工程师", "已确定"],
        ["6 可交互 MVP", "React 页面、文本输入、文字与步骤输出", "已实现"],
        ["7 专业知识嵌入", "3 条核心规则 + 60 条候选知识条目和来源字段", "已实现，待 S4 核验"],
        ["8 真实用户测试", "执行清单、反馈窗口、CSV 模板", "待 2 名学生 + 1 名教师实际试用"],
    ], [1.3, 4.15, 1.8])

    add_heading(doc, "8 自动化验收与限制", 1)
    add_paragraph(doc, "在 `a3-student-react-web` 目录执行以下命令：")
    for command in ["npm run lint", "npm run build", "npm run smoke:ai-annotation-agent", "npm run audit:ai-annotation-deliverables"]:
        add_bullet(doc, command)
    add_paragraph(doc, "当前自动化回归结果（2026-09-13）：lint 通过，生产构建通过，AI 标注页面 smoke 27/27 通过，交付材料审计 44/44 通过，预提交包验真结果以最新包验证记录为准。上述结果只能证明代码、构建、浏览器路径、封包完整性和材料边界可复现，不证明场景真实性、教师专业复核或真人试用。", color="7A4E00")

    add_heading(doc, "9 提交前必须补齐的证据", 1)
    add_bullet(doc, "真实课程或实训来源记录，明确“谁、环节、困难、影响、样本范围”，并取得匿名引用同意。")
    add_bullet(doc, "教师核对标准版本、条款页码、学校平台版本以及 occluded/truncated 字段名称、取值和必填性。")
    add_bullet(doc, "两名人工智能专业学生和一名计算机视觉或数据标注教师实际完成统一试用脚本，导出正式 CSV，并附经同意的匿名书面反馈、访谈纪要或视频。")
    add_bullet(doc, "负责人签署安全合规承诺，确认不使用未经授权真实数据、不伪造证据、不上传密钥和未授权整本标准。")
    add_bullet(doc, "负责人和指导教师填写外部证据人工核验声明，逐项核对附件、身份、授权和日期；模板不能替代签署版。")
    add_paragraph(doc, "外部证据未到位前，正式状态应写为“技术 MVP 已完成，外部证据待补”。AI 模拟试用记录只能作为内部演示材料。", color="7A4E00")

    add_heading(doc, "10 适配方法与范围", 1)
    add_paragraph(doc, "规则层与知识目录层分离。适配到新的数据标注岗位或教学任务时，只需替换条目内容、触发词、来源定位和平台字段校验，并为新意图补充核心规则与 smoke 用例；输入、追问、步骤反馈、匿名记录和 CSV 导出接口保持不变。当前设计可迁移到计算机视觉框选或分割、语音切分、文本分类等数据标注教学任务，但生产质量判定和安全关键决策仍须教师或企业专家复核。")

    # Keep the appendix table together.  Without an explicit break Word may
    # split the short path table after its first few rows, leaving a single
    # continuation row at the top of the final page.
    doc.add_page_break()
    add_heading(doc, "11 文件索引", 1)
    add_table(doc, ["材料", "路径"], [
        ["Demo 信息", "deliverables/02-作品Demo/AI数据标注实训智能体-Demo信息.md"],
        ["源码清单", "deliverables/04-作品源码/AI数据标注实训智能体-源码清单.md"],
        ["证据包索引", "deliverables/06-补充材料/AI数据标注实训智能体-证据包索引.md"],
        ["场景来源模板", "deliverables/AI数据标注实训智能体-场景来源核验模板.md"],
        ["真实试用清单", "deliverables/AI数据标注实训智能体-真实试用执行清单.md"],
        ["来源核验审计", "deliverables/AI数据标注实训智能体-知识来源核验审计.md"],
    ], [2.3, 4.95])
    add_paragraph(doc, "提交前建议按“Demo 信息 → 项目说明 → 源码清单 → 安全合规承诺 → 证据包索引”的顺序核对。目录中的模板和 AI 模拟记录仅用于准备与内部演示，不能替代真实签署版或真人试用证据。", color="7A4E00")

    # Word requires a paragraph after the final table. Keep it compact so it
    # does not become a footer-only trailing page when Word paginates the file.
    last_paragraph = doc.paragraphs[-1]
    if not last_paragraph.text.strip():
        last_paragraph.paragraph_format.space_before = Pt(0)
        last_paragraph.paragraph_format.space_after = Pt(0)
        last_paragraph.paragraph_format.line_spacing = Pt(1)
        last_paragraph.paragraph_format.keep_with_next = False
        run = last_paragraph.add_run(" ")
        set_run_font(run, size=1, color="FFFFFF")

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
