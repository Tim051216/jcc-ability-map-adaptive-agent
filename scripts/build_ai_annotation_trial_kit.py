from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "deliverables" / "06-补充材料" / "AI数据标注实训智能体-真人试用与教师核验采集表.docx"


def set_run_font(run, size=10.5, bold=False, color="000000"):
    run.font.name = "Microsoft YaHei"
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), "Microsoft YaHei")
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), "Microsoft YaHei")
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def margins(cell, top=110, start=140, bottom=110, end=140):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for name, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{name}"))
        if node is None:
            node = OxmlElement(f"w:{name}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def borders(table, color="D9E2EC"):
    tbl_pr = table._tbl.tblPr
    border = tbl_pr.first_child_found_in("w:tblBorders")
    if border is None:
        border = OxmlElement("w:tblBorders")
        tbl_pr.append(border)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = border.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            border.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), "5")
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), color)


def paragraph(doc, text="", size=10.5, bold=False, color="000000", align=None, before=0, after=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.22
    if align is not None:
        p.alignment = align
    if text:
        set_run_font(p.add_run(text), size=size, bold=bold, color=color)
    return p


def heading(doc, text, level=1):
    size = 15 if level == 1 else 12
    p = paragraph(doc, text, size=size, bold=True, color="163A5F", before=12 if level == 1 else 8, after=5)
    p.paragraph_format.keep_with_next = True
    return p


def fill_cell(cell, value, *, header=False, center=False, size=9.5):
    cell.text = ""
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    margins(cell)
    if header:
        shade(cell, "DCEAF7")
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.18
    set_run_font(p.add_run(str(value)), size=size, bold=header, color="163A5F" if header else "000000")


def table(doc, headers, rows, widths, *, size=9.3):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    borders(t)
    for i, value in enumerate(headers):
        t.rows[0].cells[i].width = Inches(widths[i])
        fill_cell(t.rows[0].cells[i], value, header=True, center=True, size=size)
    for row_index, row in enumerate(rows):
        cells = t.add_row().cells
        for i, value in enumerate(row):
            cells[i].width = Inches(widths[i])
            fill_cell(cells[i], value, center=(i == 0 and len(row) > 2), size=size)
            if row_index % 2 == 1:
                shade(cells[i], "F7FAFC")
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(2)
    return t


def field_table(doc, rows):
    return table(doc, ["填写项", "记录"], rows, [1.65, 5.15], size=9.7)


def footer(section):
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.text = "AI 数据标注实训智能体 · 真人试用与教师核验采集表 · 仅填写真实发生的记录"
    for run in p.runs:
        set_run_font(run, size=8.5, color="6B7280")


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Inches(0.65)
    sec.bottom_margin = Inches(0.58)
    sec.left_margin = Inches(0.72)
    sec.right_margin = Inches(0.72)
    sec.footer_distance = Inches(0.22)
    footer(sec)

    normal = doc.styles["Normal"]
    normal.font.name = "Microsoft YaHei"
    normal._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)

    title = paragraph(doc, "AI 数据标注实训智能体真人试用与教师核验采集表", size=21, bold=True, color="163A5F", align=WD_ALIGN_PARAGRAPH.CENTER, before=24, after=10)
    title.paragraph_format.keep_with_next = True
    paragraph(doc, "人工智能技术应用专业群  ·  AI 数据标注工程师岗位", size=11.5, bold=True, color="2E6F95", align=WD_ALIGN_PARAGRAPH.CENTER, after=16)
    paragraph(doc, "用途：现场采集真实场景来源、教师标准与平台字段核验、2 名学生和 1 名教师的试用反馈。只有实际发生并经本人确认的内容才能进入正式提交材料。AI 模拟记录、开发者自测和空白模板不能替代真人证据。", size=10.5, color="7A4E00", after=10)
    field_table(doc, [
        ["作品名称", "AI 数据标注实训智能体"],
        ["MVP 入口", "http://127.0.0.1:3002/annotation-agent（现场电脑启动后填写实际地址）"],
        ["采集日期 / 地点", "____________________________ / ____________________________"],
        ["记录人", "____________________________（不填写参与者真实姓名）"],
    ])

    heading(doc, "一 场景来源核验", 1)
    paragraph(doc, "请由真实课程教师、实训负责人或经授权的记录人填写。描述要能回答“谁、在什么环节、遇到什么困难”，并附脱敏的访谈纪要、实训观察记录或平台质检记录。", color="374151", after=6)
    field_table(doc, [
        ["来源类型", "□ 课程实训观察   □ 教师访谈   □ 学生访谈   □ 企业岗位任务材料   □ 其他：________________"],
        ["课程 / 实训名称", "________________________________________________________________________________"],
        ["标注平台及版本", "________________________________________________________________________________"],
        ["任务数据类型", "________________________________________________________________________________（不得附未授权原图）"],
        ["匿名引用同意", "□ 同意匿名引用   □ 不同意；同意日期：________________；授权说明文件：________________"],
    ])
    table(doc, ["必须记录的事实", "脱敏记录"], [
        ["谁（身份与学习 / 岗位背景）", "________________________________________________________________________________\n________________________________________________________________________________"],
        ["什么环节（具体任务、工具、阶段）", "________________________________________________________________________________\n________________________________________________________________________________"],
        ["什么困难（可观察行为或结果）", "________________________________________________________________________________\n________________________________________________________________________________"],
        ["影响（返工、漏标、误合并、质检不通过等）", "________________________________________________________________________________\n________________________________________________________________________________"],
        ["频次或样本范围（如可提供）", "________________________________________________________________________________\n________________________________________________________________________________"],
        ["与本智能体微任务的对应关系", "□ 遮挡   □ 截断   □ 同类实例粘连   □ 其他：________________"],
    ], [2.35, 4.45], size=9.4)
    paragraph(doc, "来源附件清单", bold=True, color="163A5F", before=4, after=3)
    table(doc, ["附件", "文件名 / 编号", "已脱敏", "已获授权"], [
        ["访谈纪要或录音转写", "____________________________", "□ 是 □ 否", "□ 是 □ 否"],
        ["实训观察记录", "____________________________", "□ 是 □ 否", "□ 是 □ 否"],
        ["平台任务 / 质检记录", "____________________________", "□ 是 □ 否", "□ 是 □ 否"],
        ["其他", "____________________________", "□ 是 □ 否", "□ 是 □ 否"],
    ], [2.0, 2.55, 1.1, 1.15], size=9.2)
    field_table(doc, [
        ["核验结论", "□ 通过   □ 需补证；说明：____________________________________________________________"],
        ["核验人 / 日期", "____________________________ / ____________________________"],
    ])

    doc.add_page_break()
    heading(doc, "二 教师标准与平台字段核验", 1)
    paragraph(doc, "请专业教师根据团队实际持有的标准、课程实训手册和学校标注平台逐项核对。若字段名、取值或阈值未确认，页面和材料应继续标注“待教师核验”。", color="374151", after=6)
    field_table(doc, [
        ["教师身份（匿名）", "____________________________；任教课程 / 岗位：____________________________"],
        ["核验日期", "____________________________"],
        ["实际持有来源", "标题：________________________________ 版本 / 发布信息：____________________________"],
        ["标准条款 / 页码", "________________________________________________________________________________"],
        ["学校平台名称 / 版本", "________________________________________________________________________________"],
    ])
    table(doc, ["核验字段", "实际字段名", "取值 / 必填性 / 边界", "结论或修改"], [
        ["遮挡属性", "________________", "________________________________", "□ 通过 □ 修改：________________"],
        ["截断属性", "________________", "________________________________", "□ 通过 □ 修改：________________"],
        ["bbox 坐标", "________________", "坐标起点、单位、越界处理：________________", "□ 通过 □ 修改：________________"],
        ["同类实例数量", "________________", "独立实例判断与合并限制：________________", "□ 通过 □ 修改：________________"],
        ["质检阈值 / 抽检规则", "________________", "________________________________", "□ 通过 □ 修改：________________"],
    ], [1.35, 1.3, 2.55, 1.6], size=8.9)
    paragraph(doc, "需要修订的规则或页面文字", bold=True, color="163A5F", before=8, after=3)
    table(doc, ["规则 ID / 页面位置", "教师确认的改写内容", "复核人"], [
        ["________________________________", "________________________________________________________________________________\n________________________________________________________________________________", "____________"],
        ["________________________________", "________________________________________________________________________________\n________________________________________________________________________________", "____________"],
        ["________________________________", "________________________________________________________________________________\n________________________________________________________________________________", "____________"],
    ], [1.65, 4.25, 0.9], size=9.0)
    field_table(doc, [
        ["教师核验结论", "□ 可按本校规则使用   □ 需修订后再使用   □ 仅可作为候选教学提示"],
        ["教师签名 / 日期", "____________________________ / ____________________________"],
    ])

    heading(doc, "三 统一真人试用脚本", 1)
    paragraph(doc, "让参与者在不观看开发者讲解的情况下独立操作。项目成员只负责打开页面、分配匿名身份和导出记录，不代填评分或意见。每位参与者完成以下四个输入：", after=4)
    table(doc, ["序号", "输入场景", "参与者应观察的结果"], [
        ["1", "这张图里的人被车挡住了，框怎么画？", "遮挡规则、可见区域框、属性提醒和错误提示"],
        ["2", "同类目标挨在一起，应该标几个框？", "按独立实例分别标框，不能合并"],
        ["3", "这个怎么弄？", "先询问遮挡、截断、粘连和任务类型"],
        ["4", "目标检测，目标出画面了。", "截断规则、图像边界和 bbox 检查"],
    ], [0.55, 3.35, 2.9], size=9.2)
    paragraph(doc, "完成后，参与者本人在页面反馈窗口选择“真实用户试用”、选择对应匿名身份、填写 1–5 分和具体意见，阅读并勾选匿名确认。页面导出的正式文件名应为 AI数据标注真实用户反馈.csv。", color="7A4E00", after=4)

    doc.add_page_break()
    heading(doc, "四 参与者 A 试用记录", 1)
    participant_form(doc, "A", "人工智能专业在校生")
    doc.add_page_break()
    heading(doc, "五 参与者 B 试用记录", 1)
    participant_form(doc, "B", "人工智能专业在校生")
    doc.add_page_break()
    heading(doc, "六 参与者 C 试用记录", 1)
    participant_form(doc, "C", "人工智能专业教师 / 计算机视觉或数据标注教师")

    doc.add_page_break()
    heading(doc, "七 封包前核对", 1)
    paragraph(doc, "以下项目全部基于实际发生的材料核对。未完成的项目保持未勾选，不得用 AI 模拟记录、开发者自测或空白模板替代。", color="374151", after=7)
    table(doc, ["检查项", "状态", "对应文件或说明"], [
        ["场景来源记录已填写，并附脱敏附件和匿名授权", "□ 完成 □ 待补", "____________________________________________"],
        ["教师已核对标准版本、条款 / 页码和平台 schema", "□ 完成 □ 待补", "____________________________________________"],
        ["A、B、C 均本人完成统一脚本并确认匿名记录", "□ 完成 □ 待补", "____________________________________________"],
        ["已导出 AI数据标注真实用户反馈.csv 并与记录对应", "□ 完成 □ 待补", "____________________________________________"],
        ["已取得书面反馈、访谈纪要或经同意的视频", "□ 完成 □ 待补", "____________________________________________"],
        ["负责人和指导教师完成外部证据人工核验声明", "□ 完成 □ 待补", "____________________________________________"],
        ["安全与合规承诺已真实签署并按要求归档", "□ 完成 □ 待补", "____________________________________________"],
    ], [3.35, 1.15, 2.3], size=9.2)
    field_table(doc, [
        ["技术复核", "____________________________ / 日期：________________"],
        ["专业教师复核", "____________________________ / 日期：________________"],
        ["负责人封包复核", "____________________________ / 日期：________________"],
    ])
    paragraph(doc, "真实性边界：本表是采集工具。填写完成后仍需按主办方要求审查身份、授权、签名和附件；本表本身不证明任何尚未发生的访谈、教师核验或真人试用。", size=9.7, color="7A4E00", before=8, after=0)

    doc.save(OUTPUT)
    print(OUTPUT)


def participant_form(doc, identity, role):
    field_table(doc, [
        ["匿名身份", f"{identity}｜{role}"],
        ["专业 / 年级或任教课程", "________________________________________________________________________________"],
        ["目标检测实训经历", "________________________________________________________________________________"],
        ["试用时间", "开始：________________  结束：________________  地点：________________"],
        ["是否独立完成", "□ 是   □ 否；如否，说明项目成员提供的帮助：________________________________________"],
    ])
    table(doc, ["任务", "完成情况", "遇到的困难或观察"], [
        ["遮挡判定", "□ 完成 □ 未完成", "________________________________________________________________"],
        ["同类实例判定", "□ 完成 □ 未完成", "________________________________________________________________"],
        ["模糊问题追问", "□ 完成 □ 未完成", "________________________________________________________________"],
        ["截断目标判定", "□ 完成 □ 未完成", "________________________________________________________________"],
    ], [1.55, 1.45, 3.8], size=9.1)
    table(doc, ["评分维度", "1", "2", "3", "4", "5", "参与者选择"], [
        ["实用性", "□", "□", "□", "□", "□", "____ 分"],
        ["易用性", "□", "□", "□", "□", "□", "____ 分"],
        ["准确性", "□", "□", "□", "□", "□", "____ 分"],
    ], [1.35, 0.45, 0.45, 0.45, 0.45, 0.45, 2.0], size=9.0)
    paragraph(doc, "参与者本人具体意见", bold=True, color="163A5F", before=8, after=3)
    table(doc, ["最有帮助的部分 / 需要改进的地方"], [["________________________________________________________________________________\n________________________________________________________________________________\n________________________________________________________________________________\n________________________________________________________________________________"]], [6.8], size=9.4)
    field_table(doc, [
        ["匿名确认", "□ 我确认以上意见由本人在完成试用后填写，并同意以匿名方式用于项目改进和竞赛材料核验。"],
        ["参与者签名或电子确认", "____________________________ / 确认时间：____________________________"],
        ["项目成员导出记录", "页面记录类型：真实用户试用；CSV 文件名：AI数据标注真实用户反馈.csv；导出时间：________________"],
    ])


if __name__ == "__main__":
    build()
