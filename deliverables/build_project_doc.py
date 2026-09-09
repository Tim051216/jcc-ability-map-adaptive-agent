from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(r"F:\A3-cnsoftbei\a3-learning-agent-system")
OUTPUT = ROOT / "deliverables" / "BiliLearn项目说明文档.docx"


def set_font(run, name="宋体", size=12, bold=False, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def style_base(document: Document):
    section = document.sections[0]
    section.top_margin = Cm(2.54)
    section.bottom_margin = Cm(2.54)
    section.left_margin = Cm(2.54)
    section.right_margin = Cm(2.54)

    normal = document.styles["Normal"]
    normal.font.name = "宋体"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    normal.font.size = Pt(12)
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(6)

    for style_name, size, color in [
        ("Title", 24, "000000"),
        ("Heading 1", 16, "000000"),
        ("Heading 2", 14, "000000"),
        ("Heading 3", 12, "333333"),
        ("Heading 4", 12, "333333"),
    ]:
        style = document.styles[style_name]
        style.font.name = "黑体" if style_name != "Title" else "黑体"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "黑体")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)
        style.paragraph_format.space_before = Pt(10 if "Heading 1" in style_name else 8)
        style.paragraph_format.space_after = Pt(6)


def add_page_number(paragraph):
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def add_cover(document: Document):
    p = document.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(80)
    p.paragraph_format.space_after = Pt(24)
    r = p.add_run("岗课赛一体化软件开发岗位能力自适应学习智能体\n项目说明文档")
    set_font(r, "黑体", 22, True)

    for text in [
        "赛题名称：XA-202603 面向职业教育高水平专业群建设的教学实训与岗位技能智能体开发",
        "项目名称：岗课赛一体化软件开发岗位能力自适应学习智能体（BiliLearn）",
        "文档类型：项目总体设计与使用说明",
        "版本：V1.0",
        "日期：2026年6月18日",
    ]:
        p = document.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(10)
        r = p.add_run(text)
        set_font(r, "宋体", 14, False)

    document.add_page_break()


def add_toc_title(document: Document):
    p = document.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run("目录")

    p = document.add_paragraph()
    fld_char = OxmlElement("w:fldChar")
    fld_char.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = r'TOC \o "1-3" \h \z \u'
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "separate")
    fld_char3 = OxmlElement("w:fldChar")
    fld_char3.set(qn("w:fldCharType"), "end")
    p._p.append(fld_char)
    p._p.append(instr_text)
    p._p.append(fld_char2)
    p.add_run("右键更新域以生成目录")
    p._p.append(fld_char3)
    document.add_page_break()


def add_bullets(document: Document, items):
    for item in items:
        p = document.add_paragraph(style="Normal")
        p.paragraph_format.left_indent = Cm(0.74)
        p.paragraph_format.first_line_indent = Cm(-0.74)
        r = p.add_run(f"·{item}")
        set_font(r, "宋体", 12)


def add_paragraph(document: Document, text):
    p = document.add_paragraph(style="Normal")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r = p.add_run(text)
    set_font(r, "宋体", 12)


def add_table(document: Document, headers, rows, widths=None):
    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    hdr_cells = table.rows[0].cells
    for i, head in enumerate(headers):
        hdr_cells[i].text = head
        for p in hdr_cells[i].paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                set_font(run, "黑体", 11, True)

    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = value
            for p in cells[i].paragraphs:
                if i == 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in p.runs:
                    set_font(run, "宋体", 10)
    if widths:
        for row in table.rows:
            for idx, width_cm in enumerate(widths):
                row.cells[idx].width = Cm(width_cm)
    document.add_paragraph("")


def build():
    doc = Document()
    style_base(doc)
    add_cover(doc)
    add_toc_title(doc)

    footer = doc.sections[0].footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_page_number(footer)

    doc.add_heading("1. 项目概述和需求分析", level=1)
    doc.add_heading("1.1 项目背景", level=3)
    add_paragraph(doc, "本项目面向 XA-202603 赛题，固定软件技术专业群与软件开发工程师岗位，以岗—课—赛贯通为主线：将岗位典型任务映射到课程知识，再转化为综合实训与技能竞赛任务，通过诊断、训练、产出和评价形成可验证闭环。")
    add_paragraph(doc, "当前仓库采用“Java 稳定业务链路 + Python AI 中台 + 双前端呈现”的组合式架构，既保留课程、学习路径、测评、报告等核心教学业务的稳定性，也具备 RAG 检索、智能问答、资源生成、AI 导师、运营治理等智能化扩展能力。")

    doc.add_heading("1.2 系统目标", level=3)
    add_bullets(doc, [
        "构建面向高校学习场景的个性化学习支持平台，覆盖画像分析、路径规划、资源生成和学习反馈。",
        "通过多智能体协同实现从“被动看资源”到“系统主动引导学习”的升级。",
        "提供可稳定演示的学生学习闭环，同时保留真实 AI 链路用于答辩展示与后续扩展。",
        "形成兼顾教学业务稳定性、AI 创新能力和工程可维护性的系统方案。"
    ])

    doc.add_heading("1.3 目标用户群体", level=3)
    doc.add_heading("1.3.1 主要用户", level=4)
    add_bullets(doc, [
        "学生用户：需要获得个性化学习路径、资源推荐、AI 答疑和测评反馈的在校学习者。",
        "教师用户：需要组织课程资源、理解学生学习情况并借助 AI 提升教学效率的任课教师。",
        "管理员用户：负责平台内容管理、用户治理、AI 配置管理与系统运维的管理人员。"
    ])
    doc.add_heading("1.3.2 用户需求分析", level=4)
    add_bullets(doc, [
        "学生侧关注系统是否能理解自己的薄弱点、动态推荐学习资源、生成计划并提供答疑支持。",
        "教师侧关注课程资源管理、学习过程观察、测评结果分析以及智能教学工具的可用性。",
        "管理员侧关注平台运行状态、模型连通性、内容审核、配置治理与日志追踪能力。"
    ])

    doc.add_heading("1.4 功能需求概述", level=3)
    doc.add_heading("1.4.1 核心功能模块", level=4)
    add_bullets(doc, [
        "学习画像模块：根据学生对话、课程背景与行为数据构建个性化学习画像。",
        "学习路径模块：生成可执行、可调整、可跟踪的个性化学习计划。",
        "资源生成模块：生成讲义、练习、脑图、笔记等多类型学习资源。",
        "AI 导师模块：支持课程问答、RAG 检索、文件上传解析、OCR 预览与答疑历史。",
        "测评与报告模块：支持测评创建、答题、错题汇总、报告生成与闭环反馈。",
        "管理运营模块：支持模型连通性检测、配置管理、审核、日志与用户状态管理。"
    ])
    doc.add_heading("1.4.2 技术需求", level=4)
    add_bullets(doc, [
        "支持前后端分离与微服务协作，便于业务服务和 AI 服务独立演进。",
        "支持向量检索、对象存储、缓存与消息机制，为 AI 能力落地提供基础设施。",
        "支持本地稳定启动和 Docker 依赖容器化部署，满足开发、联调和答辩演示场景。",
        "支持通过网关、学生端和管理端形成统一访问链路。"
    ])

    doc.add_heading("1.5 非功能性需求", level=3)
    doc.add_heading("1.5.1 安全需求", level=4)
    add_bullets(doc, [
        "基于角色控制用户权限，区分学生、教师与管理员的访问边界。",
        "记录日志、审核与配置变更信息，支持后台治理与问题追踪。",
        "保护模型调用参数、对象存储、数据库连接等敏感配置，避免泄露。"
    ])
    doc.add_heading("1.5.2 兼容性需求", level=4)
    add_bullets(doc, [
        "支持 Windows 本地开发环境和 Docker 容器化依赖部署。",
        "支持 PC 浏览器访问学生端与管理端前端页面。",
        "支持在服务依赖不完全时保留部分兜底链路，保证关键页面与演示流程可用。"
    ])

    doc.add_heading("2. 系统架构设计", level=2)
    doc.add_heading("2.1 总体架构", level=3)
    add_paragraph(doc, "BiliLearn 采用分层组合式架构。Java 学习服务负责学习路径、学习进度、测评、错题、报告等稳定教学主链路；Python AI 中台负责学习画像、学习计划、RAG 检索、资源生成、智能辅导和后台 AI 治理能力；学生端与管理端前端分别承载学习闭环展示和系统运营管理。系统通过网关与前端代理完成统一访问和服务协同。")
    doc.add_heading("2.1.1 技术栈选型", level=4)
    add_table(
        doc,
        ["层次", "技术选型", "说明"],
        [
            ["学生端前端", "React + Vite", "默认开发端口 3002，承载画像、路径、资源、报告、测评与 AI 导师页面。"],
            ["管理端前端", "React + Vite", "默认开发端口 3004，承载运营摘要、审核、日志、配置与用户管理。"],
            ["Java 业务层", "Spring Boot + Maven", "负责学习路径、进度、测评、报告、演示骨架接口等稳定业务能力。"],
            ["Python AI 层", "FastAPI + Python", "负责多智能体编排、RAG、问答、资源生成和智能辅导。"],
            ["网关层", "Java Gateway", "负责统一入口与 AI 路由转发。"],
            ["数据与基础设施", "MySQL、PostgreSQL、Redis、RabbitMQ、Milvus、MinIO", "分别支撑业务数据、AI 结构化数据、缓存消息、向量检索和文件存储。"],
        ],
        widths=[2.8, 4.0, 9.0],
    )
    doc.add_heading("2.1.2 系统架构说明", level=4)
    add_bullets(doc, [
        "学生端通过 `/api/**` 访问 Java 学习服务，通过 `/aigw/**` 访问 Python AI 服务。",
        "管理端通过网关统一访问后端接口，便于集中治理和路由控制。",
        "Python AI 服务内部可结合 PostgreSQL、Redis、Milvus、MinIO 形成知识检索与任务处理链路。",
        "Java 业务链路与 AI 链路解耦，有利于系统稳定运行和独立演进。"
    ])

    doc.add_heading("2.2 数据库设计", level=3)
    doc.add_heading("2.2.1 数据库架构", level=4)
    add_paragraph(doc, "系统采用双数据域设计。MySQL 负责课程、用户、学习路径、测评、资源任务等基础业务数据；PostgreSQL 负责 AI 服务中的会话、任务、配置和运营数据。Redis 提供缓存与临时状态支撑，Milvus 负责向量知识检索，MinIO 负责上传文件与对象资源存储。")
    doc.add_heading("2.2.2 核心数据表设计", level=4)
    add_table(
        doc,
        ["数据域", "代表表/对象", "用途"],
        [
            ["学习业务", "learning_path、path_node、learning_progress", "记录学习路径主表、节点信息和进度轨迹。"],
            ["测评闭环", "evaluation_test、evaluation_test_record、evaluation_report、evaluation_wrong_question", "支撑测评发布、作答、错题与报告生成。"],
            ["画像与资源", "student_profile、resource_generation_task", "记录学生画像和资源生成任务。"],
            ["AI 会话", "chat_session、message、tutoring records", "保存问答、辅导和历史会话。"],
            ["知识检索", "Milvus 向量集合、知识切片元数据", "支撑课程知识入库与 RAG 检索。"],
        ],
        widths=[2.6, 6.5, 6.7],
    )
    doc.add_heading("2.2.3 数据关系说明", level=4)
    add_paragraph(doc, "学生与课程建立学习关系后，可派生出学习路径、阶段节点、学习进度与测评记录；测评记录进一步生成报告和错题分析，并反向影响后续学习建议。AI 服务在此基础上读取课程知识、学生画像和历史上下文，生成学习计划、资源推荐和答疑结果，实现业务数据与智能能力之间的闭环联动。")

    doc.add_heading("2.3 系统模块架构", level=3)
    doc.add_heading("2.3.1 后端模块结构", level=4)
    add_bullets(doc, [
        "a3-learning：学习路径、学习进度、测评、报告、错题与稳定业务接口。",
        "a3-gateway：统一入口、服务转发和 AI 路由代理。",
        "a3-user、a3-resource、a3-assessment、a3-media 等：提供用户、课程资源、题库和媒体支撑。",
        "a3-ai-python：多智能体编排、RAG、问答、资源生成、智能辅导和后台治理。"
    ])
    doc.add_heading("2.3.2 前端模块结构", level=4)
    add_bullets(doc, [
        "a3-student-react-web：学生学习主入口，覆盖画像、路径、资源、报告、测评与 AI 导师。",
        "a3-admin-web：后台管理主入口，覆盖摘要、配置、审核、日志、用户状态和 AI 监控。",
        "legacy 前端仅保留为历史参考代码，不作为当前交付主入口。"
    ])

    doc.add_heading("2.4 安全架构设计", level=3)
    doc.add_heading("2.4.1 身份认证机制", level=4)
    add_paragraph(doc, "系统通过角色化接口访问控制实现学生端、教师端和管理员端的权限隔离。前端根据登录态与用户角色控制页面入口，后端基于服务层与接口层约束用户可访问的数据与操作范围。")
    doc.add_heading("2.4.2 权限控制体系", level=4)
    add_paragraph(doc, "学生端重点访问课程学习和 AI 辅导相关能力，管理端重点访问配置、日志、审核和系统摘要能力。Java 主链路与 Python AI 链路分层部署，也降低了单一服务暴露全部能力的风险。")
    doc.add_heading("2.4.3 数据安全措施", level=4)
    add_bullets(doc, [
        "通过本地 `.env` 和脚本管理模型、数据库与对象存储配置，避免硬编码敏感信息。",
        "通过日志、审核和配置查询接口增强问题定位与系统治理能力。",
        "对上传资料、知识入库和 AI 调用链路进行服务边界隔离，提升系统稳定性。"
    ])

    doc.add_heading("2.5 核心业务流程", level=3)
    doc.add_heading("2.5.1 学习闭环流程", level=4)
    add_bullets(doc, [
        "学生进入系统后先建立或读取学习画像。",
        "系统结合课程与目标生成个性化学习路径。",
        "资源生成模块围绕知识点生成讲义、练习、脑图等学习资料。",
        "AI 导师基于课程知识库与上传资料提供答疑与辅导。",
        "测评模块收集结果并生成报告，反馈下一轮学习建议。"
    ])
    doc.add_heading("2.5.2 AI 问答流程", level=4)
    add_bullets(doc, [
        "课程知识先通过知识入库接口写入向量检索层。",
        "用户提问后系统执行检索、上下文拼接与大模型调用。",
        "问答结果写入会话历史，并可被后续资源生成与辅导复用。"
    ])
    doc.add_heading("2.5.3 测评反馈流程", level=4)
    add_bullets(doc, [
        "系统发布测评后记录答题过程与结果。",
        "报告模块根据测评记录生成总结、趋势和错因分析。",
        "反馈结果反向作用于后续路径调整和学习建议。"
    ])

    doc.add_heading("3. 功能模块详述", level=1)
    doc.add_heading("3.1 学习画像模块", level=2)
    add_paragraph(doc, "学习画像模块是系统理解学生的入口。模块可基于学生对话、课程上下文、兴趣方向与薄弱点信息生成画像标签和学习建议，并为路径规划、资源生成和 AI 导师提供共享上下文。学生端对应页面可展示当前画像状态、学习偏好和后续建议。")
    doc.add_heading("3.2 知识检索与 AI 导师模块", level=2)
    add_paragraph(doc, "AI 导师模块承接系统的实时智能交互能力。其核心包含课程知识入库、RAG 检索、智能问答、OCR 预览、文件上传解析和答疑历史查询。系统既支持基于课程知识点的快速问答，也支持围绕学生上传的图片、PDF、Word、Excel、PPT 等资料进行正文抽取和上下文解读。")
    doc.add_heading("3.3 个性化学习路径模块", level=2)
    add_paragraph(doc, "学习路径模块由 Java 学习服务稳定承载，并可接入 AI 生成建议。模块支持路径创建、激活、暂停、恢复、进度查询等功能，适用于从课程目标拆解到阶段任务安排的全过程管理。它是系统稳定主链路的核心，也是答辩演示中的重点页面。")
    doc.add_heading("3.4 资源生成模块", level=2)
    add_paragraph(doc, "资源生成模块围绕课程知识点和学习薄弱项，生成讲义、练习、脑图、笔记等多类型内容，帮助学生快速获得与当前阶段相匹配的学习资料。该模块体现了系统从“资源展示”向“资源按需生成”的转变，是 BiliLearn 的差异化能力之一。")
    doc.add_heading("3.5 测评与学习报告模块", level=2)
    add_paragraph(doc, "测评模块支持课前、课中、课后和阶段性测试，能够完成试题创建、答题提交、错题聚合和报告导出。报告模块进一步输出成绩概览、薄弱点分析、错因归纳和下一步建议，使学习结果不止停留在分数层面，而是反向驱动后续学习。")
    doc.add_heading("3.6 管理端运营治理模块", level=2)
    add_paragraph(doc, "管理端模块负责展示系统状态与 AI 治理能力，包含模型 ping 检测、配置查询、审核列表、日志管理、用户状态、智能体运行状态等内容。该模块增强了系统的可观测性，也为答辩中的“工程落地能力”提供支撑。")

    doc.add_heading("4. 系统部署和运维", level=1)
    doc.add_heading("4.1 部署环境要求", level=3)
    doc.add_heading("4.1.1 硬件环境要求", level=4)
    add_bullets(doc, [
        "开发环境需要具备可运行 Docker 容器与本地前后端服务的 PC 设备。",
        "若演示完整 AI 链路，建议预留足够内存用于 PostgreSQL、Milvus、MinIO 和 Python AI 服务。"
    ])
    doc.add_heading("4.1.2 软件环境要求", level=4)
    add_bullets(doc, [
        "Windows 开发环境、Docker Desktop、JDK、Maven、Node.js、Python 虚拟环境。",
        "浏览器用于访问学生端 3002 和管理端 3004。"
    ])
    doc.add_heading("4.2 部署架构设计", level=3)
    doc.add_heading("4.2.1 本地单机部署", level=4)
    add_paragraph(doc, "项目支持本地联调与答辩演示部署。依赖容器通过 `docker-compose.local.yml` 启动，Java 学习服务、本地网关、Python AI 服务和双前端分别独立运行，便于按需组合演示。")
    doc.add_heading("4.2.2 可扩展部署", level=4)
    add_paragraph(doc, "仓库中已补充 k8s 与 GitHub Actions 相关配置，可作为后续上线和分布式部署的演进基础。当前核心目标仍是保证本地稳定演示与业务闭环可用。")
    doc.add_heading("4.3 部署步骤详解", level=3)
    doc.add_heading("4.3.1 后端部署流程", level=4)
    add_bullets(doc, [
        "启动依赖容器：MySQL、Redis、RabbitMQ、PostgreSQL、MinIO、Etcd、Milvus。",
        "执行 `scripts/init-mysql.ps1` 初始化基础业务数据。",
        "启动 `a3-learning` 学习服务，默认端口 8090。",
        "启动 `a3-ai-python`，默认端口 18080。",
        "启动 `a3-gateway`，默认端口 10010。"
    ])
    doc.add_heading("4.3.2 前端部署流程", level=4)
    add_bullets(doc, [
        "启动学生端 `a3-student-react-web`，默认端口 3002。",
        "启动管理端 `a3-admin-web`，默认端口 3004。",
        "按演示需求决定是否同时开启 AI 链路和管理端。"
    ])
    doc.add_heading("4.4 系统监控和维护", level=3)
    add_bullets(doc, [
        "通过管理端查看 AI 服务状态、模型连通性、日志与配置。",
        "通过本地日志文件与脚本检查学习服务、网关和 AI 服务运行情况。",
        "通过 `llm/ping`、`embedding/ping` 等接口完成演示前自检。"
    ])
    doc.add_heading("4.5 安全运维", level=3)
    add_bullets(doc, [
        "控制 `.env`、模型密钥与对象存储配置的访问范围。",
        "演示前确保本地只保留单个 18080 AI 进程，避免端口冲突。",
        "对知识入库、上传资料和运营接口进行分层访问。"
    ])
    doc.add_heading("4.6 性能优化", level=3)
    add_bullets(doc, [
        "学习主链路由 Java 服务稳定承载，降低 AI 抖动对核心业务的影响。",
        "Redis、Milvus 与 MinIO 分别用于缓存、检索和对象存储，减轻单点压力。",
        "系统支持最小化演示启动组合，按场景启用服务，降低资源消耗。"
    ])

    doc.add_heading("5. 用户界面和操作说明", level=1)
    doc.add_heading("5.1 系统入口说明", level=2)
    add_table(
        doc,
        ["入口", "地址", "说明"],
        [
            ["学生端", "http://127.0.0.1:3002", "学习画像、学习路径、资源中心、报告、测评、AI 导师。"],
            ["管理端", "http://127.0.0.1:3004", "摘要、审核、日志、配置、用户管理、AI 监控。"],
            ["学习服务", "http://127.0.0.1:8090", "稳定教学业务与路径、测评相关接口。"],
            ["AI 服务", "http://127.0.0.1:18080", "真实 AI 能力接口与后台治理接口。"],
            ["网关", "http://127.0.0.1:10010", "统一访问入口和 AI 转发。"],
        ],
        widths=[2.4, 4.2, 9.2],
    )
    doc.add_heading("5.2 学生端主要页面", level=2)
    add_bullets(doc, [
        "首页：展示课程入口与学习概览。",
        "学习画像页：查看学生画像标签、状态与学习建议。",
        "学习路径页：查看个性化路径、阶段任务与进度安排。",
        "资源中心页：获取讲义、练习、脑图和补充资料。",
        "学习报告页：查看测评结果、趋势与改进建议。",
        "测评页：进行测试、查看错题和闭环反馈。",
        "AI 导师页：进行课程问答、文件答疑和智能辅导。"
    ])
    doc.add_heading("5.3 管理端主要页面", level=2)
    add_bullets(doc, [
        "系统摘要页：展示运行状态、模型连通性与关键数据。",
        "配置管理页：维护 AI 参数、系统参数与功能开关。",
        "审核与日志页：查看系统运行日志、审核记录和治理信息。",
        "用户状态页：查看用户状态和运营侧数据。"
    ])
    doc.add_heading("5.4 推荐演示流程", level=2)
    add_bullets(doc, [
        "先展示学习画像，说明系统能够理解学生。",
        "再展示学习路径和资源中心，说明系统如何组织学习过程。",
        "接着展示 AI 导师和 RAG 检索，体现真实 AI 链路能力。",
        "最后展示测评与学习报告，说明系统如何完成反馈闭环。"
    ])

    doc.add_heading("6. 开发与调试说明", level=1)
    add_paragraph(doc, "项目提供了较完整的本地启动、数据初始化和联调脚本，适合演示前快速恢复环境。常用脚本包括 `init-mysql.ps1`、`init-local-demo-data.ps1`、`start-ai-local.ps1`、`start-gateway-local.ps1` 和 `verify-intelligent-tutoring-local.ps1`。同时，仓库保留了答辩脚本、接口说明、架构说明和交付状态文档，可作为后续完善说明书、PPT 和视频演示的依据。")

    doc.save(OUTPUT)


if __name__ == "__main__":
    build()
