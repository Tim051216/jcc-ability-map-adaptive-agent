from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "XA-202603岗位自适应学习智能体项目文档.docx"


def set_run_font(run, name="宋体", size=12, bold=False, color=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)


def set_paragraph(paragraph, *, first_line_chars=2, line=1.5, before=0, after=6, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    fmt = paragraph.paragraph_format
    fmt.line_spacing = line
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.first_line_indent = Pt(24 * first_line_chars / 2) if first_line_chars else Pt(0)
    paragraph.alignment = align


def add_text(doc, text):
    p = doc.add_paragraph()
    set_paragraph(p)
    r = p.add_run(text)
    set_run_font(r, size=12)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.line_spacing = 1.35
    p.paragraph_format.space_after = Pt(4)
    for run in p.runs:
        set_run_font(run, size=12)
    r = p.add_run(text) if not p.runs else None
    if r:
        set_run_font(r, size=12)
    return p


def add_heading(doc, text, level):
    p = doc.add_paragraph()
    style_map = {1: ("黑体", 16), 2: ("黑体", 14), 3: ("黑体", 12), 4: ("黑体", 12)}
    name, size = style_map[level]
    p.paragraph_format.space_before = Pt(10 if level <= 2 else 6)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.25
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = p.add_run(text)
    set_run_font(r, name=name, size=size, bold=True)
    if level in (1, 2):
        r.font.color.rgb = RGBColor(31, 78, 121)
    return p


def set_cell_text(cell, text, *, bold=False, center=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.line_spacing = 1.2
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    r = p.add_run(text)
    set_run_font(r, size=10.5, bold=bold)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER


def shade_cell(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_table_borders(table):
    tbl = table._tbl
    tbl_pr = tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "6")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "BFBFBF")
        borders.append(el)
    tbl_pr.append(borders)


def add_table(doc, headers, rows, widths):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    hdr = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr[i].width = Inches(widths[i])
        set_cell_text(hdr[i], header, bold=True, center=True)
        shade_cell(hdr[i], "D9EAF7")
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].width = Inches(widths[i])
            set_cell_text(cells[i], str(value), center=i == 0)
    doc.add_paragraph()
    return table


def add_cover(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(90)
    p.paragraph_format.space_after = Pt(18)
    r = p.add_run("岗课赛一体化软件开发岗位能力自适应学习智能体")
    set_run_font(r, name="黑体", size=22, bold=True, color=(31, 78, 121))

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_after = Pt(30)
    r2 = p2.add_run("项目设计与实现文档")
    set_run_font(r2, name="黑体", size=18, bold=True)

    info = [
        "项目类型：基于微服务与多智能体的个性化智能教学平台",
        "技术路线：Spring Cloud Alibaba + FastAPI/LangGraph + React/Vite",
        "文档用途：课程设计 / 比赛答辩 / 项目交付说明",
        "生成时间：2026年6月18日",
    ]
    for line in info:
        p3 = doc.add_paragraph()
        p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p3.paragraph_format.space_after = Pt(8)
        r3 = p3.add_run(line)
        set_run_font(r3, size=12)

    doc.add_page_break()


def add_toc_placeholder(doc):
    add_heading(doc, "目录", 1)
    for line in [
        "1. 项目概述和需求分析",
        "2. 系统架构设计",
        "3. 功能模块详述",
        "4. 系统部署和运行维护",
        "5. 用户界面和操作说明",
        "6. 项目特色与总结",
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(line)
        set_run_font(r, size=12)
    doc.add_page_break()


def build():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)

    normal = doc.styles["Normal"]
    normal.font.name = "宋体"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    normal.font.size = Pt(12)

    add_cover(doc)
    add_toc_placeholder(doc)

    add_heading(doc, "1. 项目概述和需求分析", 1)
    add_heading(doc, "1.1 项目背景", 3)
    add_text(doc, "本项目面向 XA-202603 职业教育赛题，固定软件技术专业群与软件开发工程师岗位，贯通岗位任务、课程知识和竞赛/实训产出，将能力诊断、任务生成、资源推荐、智能辅导和评价反馈整合到岗课赛自适应训练闭环中。")
    add_text(doc, "从当前仓库结构来看，项目已经形成“Java 微服务业务底座 + Python AI 中台 + 学生端 React 前端 + 管理端 React 前端”的完整方案，具备课程浏览、学习计划、资源生成、智能问答、测评分析、运营总览等可答辩的核心能力。")

    add_heading(doc, "1.2 系统目标", 3)
    add_bullet(doc, "为学生提供个性化学习路径、智能问答、学习资源生成与评估反馈。")
    add_bullet(doc, "为教师和运营人员提供学习过程跟踪、画像分析、资源管理和后台总览。")
    add_bullet(doc, "通过多智能体协同和知识库检索增强 AI 输出质量，减少纯大模型幻觉风险。")
    add_bullet(doc, "通过网关、认证、日志、缓存、消息队列和调度体系保证系统具备可扩展和可运维能力。")

    add_heading(doc, "1.3 目标用户群体", 3)
    add_heading(doc, "1.3.1 主要用户", 4)
    add_bullet(doc, "学生用户：使用课程学习、AI 辅导、资源中心、学习路径和测评能力。")
    add_bullet(doc, "教师用户：关注学生学习表现、资源组织、知识点辅导和结果反馈。")
    add_bullet(doc, "管理员与运营人员：负责用户管理、审核任务、日志审计、系统配置和运维监控。")
    add_heading(doc, "1.3.2 用户需求分析", 4)
    add_text(doc, "学生侧更关注学习入口统一、资源推荐及时、答疑反馈自然、测评结果可解释；教师和运营侧更关注过程留痕、异常定位、配置可控和数据可视化。因此系统既要具备高频互动体验，也要具备后台闭环和运营视角。")

    add_heading(doc, "1.4 功能需求概述", 3)
    add_heading(doc, "1.4.1 核心功能模块", 4)
    modules = [
        ("1", "认证与网关", "统一登录鉴权、路由转发、跨服务访问控制"),
        ("2", "课程与资源", "课程目录、资源列表、资源详情、收藏、预览与下载"),
        ("3", "学习服务", "学习路径生成、进度跟踪、答疑互动与学习激励"),
        ("4", "测评服务", "题库管理、测评作答、错题追踪、测评报告"),
        ("5", "AI 中台", "多智能体编排、RAG 检索、资源生成、画像构建、评估分析"),
        ("6", "数据分析与运营", "后台总览、统计摘要、日志、审核、配置与告警"),
    ]
    add_table(doc, ["序号", "模块名称", "功能说明"], modules, [0.7, 1.8, 4.0])

    add_heading(doc, "1.4.2 非功能需求", 4)
    add_bullet(doc, "性能要求：支持前后端分离架构下的并发访问与异步任务处理。")
    add_bullet(doc, "安全要求：统一认证、网关鉴权、日志审计、敏感配置脱敏。")
    add_bullet(doc, "可维护性：微服务拆分明确，AI 中台独立部署，SQL 与启动脚本分离。")
    add_bullet(doc, "可扩展性：支持新增模型提供方、知识库课程、统计维度与前端页面。")

    add_heading(doc, "2. 系统架构设计", 1)
    add_heading(doc, "2.1 总体架构", 3)
    add_text(doc, "系统采用前后端分离与微服务架构。Java 侧承载认证、网关、课程、学习、测评、用户、分析等基础业务；Python 侧作为独立 AI 中台承接多智能体协同、学习画像、路径规划、资源生成和知识库检索；学生端与管理端分别使用 React + Vite 构建，统一通过网关入口对外提供服务。")

    add_heading(doc, "2.1.1 技术栈选型", 4)
    tech_rows = [
        ("后端业务服务", "Java 11, Spring Boot 2.7.2, Spring Cloud Alibaba"),
        ("AI 中台", "FastAPI, LangGraph, PostgreSQL, Redis, Celery"),
        ("向量检索与对象存储", "Milvus, MinIO"),
        ("前端", "React 19, Vite 6, TypeScript"),
        ("基础设施", "MySQL 8, Redis, RabbitMQ, Nacos, Seata, XXL-Job"),
    ]
    add_table(doc, ["层级", "主要技术"], tech_rows, [2.0, 4.5])

    add_heading(doc, "2.1.2 系统架构说明", 4)
    add_text(doc, "请求入口默认为 a3-gateway，网关对认证服务、学习服务、课程服务、测评服务等进行路由，同时为 Python AI 服务配置了 /ai/** 和 /ai/api/** 路径。AI 服务通过 HTTP 与 Java 服务协同，并将向量知识、AI 会话、任务状态和生成结果分别存储在 Milvus、PostgreSQL、Redis 与 MinIO 等组件中。")

    add_heading(doc, "2.2 数据库设计", 3)
    add_heading(doc, "2.2.1 数据库组成", 4)
    db_rows = [
        ("认证库", "auth.sql", "用户登录、令牌与权限相关基础数据"),
        ("课程库", "course.sql", "课程、章节、资源及教学内容"),
        ("学习库", "learning.sql / learning_path.sql", "学习记录、学习路径、打卡与进度"),
        ("测评库", "exam.sql / evaluation.sql", "题库、试卷、作答、测评结果"),
        ("画像与资源扩展", "learning_profile.sql / learning_resource.sql", "学习画像、生成资源、资源行为"),
        ("辅导与消息", "tutoring.sql / message.sql", "智能辅导、消息记录与提醒"),
    ]
    add_table(doc, ["数据库主题", "脚本文件", "主要用途"], db_rows, [1.4, 2.2, 2.9])

    add_heading(doc, "2.2.2 数据特点", 4)
    add_text(doc, "当前项目的 SQL 目录同时包含基础业务初始化脚本与岗位自适应学习演示数据脚本。基础脚本服务于 Java 微服务正常启动，扩展脚本主要服务于学习路径、测评演示、画像生成和资源生成等比赛场景。这样既保留了原业务底座，又补齐了 XA-202603 需要展示的 AI 能力数据。")

    add_heading(doc, "2.3 系统模块架构", 3)
    add_heading(doc, "2.3.1 后端模块结构", 4)
    backend_rows = [
        ("a3-auth", "认证服务", "登录认证、资源权限、令牌管理"),
        ("a3-gateway", "网关服务", "统一路由、跨域与 AI 路径代理"),
        ("a3-learning", "学习服务", "学习路径、过程追踪、答疑互动"),
        ("a3-resource", "课程资源服务", "课程、目录、资源管理"),
        ("a3-assessment", "测评服务", "题库、试卷、测评报告"),
        ("a3-analytics", "数据分析服务", "活跃度统计、数据看板"),
        ("a3-ai-python", "AI 中台", "多智能体、RAG、画像、评估、资源生成"),
    ]
    add_table(doc, ["模块", "角色", "说明"], backend_rows, [1.5, 1.4, 3.6])

    add_heading(doc, "2.3.2 前端模块结构", 4)
    add_text(doc, "当前默认学生端前端为 a3-student-react-web，默认开发端口 3002；默认管理端前端为 a3-admin-web，默认开发端口 3004。学生端侧重课程学习、AI 工作台、资源中心、实时辅导和测评结果展示；管理端侧重用户、审核、配置、统计和后台运营视角。")

    add_heading(doc, "2.4 安全与治理设计", 3)
    add_bullet(doc, "统一登录鉴权由 a3-auth 提供，并在网关层完成资源访问控制。")
    add_bullet(doc, "AI 中台与业务服务分层部署，减少大模型能力对主业务链路的侵入。")
    add_bullet(doc, "系统具备审计日志、配置历史、智能体运行日志与异常统计摘要接口。")
    add_bullet(doc, "网关已配置跨域、前缀转发和服务分流，便于前后端联调与统一入口收口。")

    add_heading(doc, "3. 功能模块详述", 1)
    add_heading(doc, "3.1 用户与认证模块", 2)
    add_text(doc, "认证服务负责登录、令牌管理和受保护资源访问控制，是整个平台的安全入口。通过网关统一接入后，学生端、管理端和 AI 能力都可以走一致的鉴权体系，避免各模块重复处理登录逻辑。")

    add_heading(doc, "3.2 学习服务与个性化路径模块", 2)
    add_text(doc, "学习服务是系统的主业务链路之一，覆盖学习路径生成、学习进度跟踪、学习激励和答疑互动。根据当前任务收口文档，系统已经打通生成计划、查询详情、打卡、暂停、继续和进度查询等路径闭环，并且补齐了学习路径统计摘要等运营维度接口。")

    add_heading(doc, "3.3 课程资源与资源中心模块", 2)
    add_text(doc, "课程资源模块负责课程、目录、资源内容和资源行为管理。学生可以进行资源浏览、详情查看、全文检索、收藏、预览和下载；后台则可以追踪归档、收藏回溯和下载记账。该模块既承接普通课程内容，也承接 AI 生成后的学习资源展示。")

    add_heading(doc, "3.4 智能测评与评估模块", 2)
    add_text(doc, "测评模块围绕题库、试卷、在线测评、错题统计和结果报告展开。项目中已补齐测评报告导出、测评历史查询、趋势摘要、错题统计摘要和试卷统计摘要等接口，使学生端可以展示学习结果，管理端可以做运营分析。")

    add_heading(doc, "3.5 AI 中台与多智能体协同模块", 2)
    add_text(doc, "a3-ai-python 是本项目的智能能力核心，使用 FastAPI 作为接口层，LangGraph 作为多智能体编排框架，支持聊天助手、学习画像构建、路径规划、资源生成、RAG 检索和学习效果评估等能力。系统将 ProfileAgent、RetrieverAgent、PlannerAgent、ResourceAgent、EvaluatorAgent 和 SafetyAgent 分层组织，用于生成结构化、可追踪、可回显的智能结果。")
    add_text(doc, "在数据侧，AI 中台配合 PostgreSQL、Redis、Celery、Milvus 和 MinIO 工作，实现会话状态持久化、异步任务执行、知识库向量检索与生成文件存储。通过网关访问时，主要接口包括 /ai/v1/chat、/ai/v1/profile/build、/ai/v1/plan/generate、/ai/v1/resource/generate 和 /ai/v1/rag/search。")

    add_heading(doc, "3.6 数据分析与后台运营模块", 2)
    add_text(doc, "后台运营部分已经从单纯演示页演进到可运营闭环，包含聊天工单统计、审核任务统计、审计日志摘要、智能体运行日志摘要、配置统计摘要、学习路径摘要、资源收藏摘要等一系列聚合接口。管理端可以利用这些摘要快速展示系统状态、待处理事项和核心指标，形成完整答辩链路。")

    add_heading(doc, "4. 系统部署和运行维护", 1)
    add_heading(doc, "4.1 部署环境要求", 3)
    add_bullet(doc, "Java 侧：JDK 11、Maven、MySQL、Redis、Nacos、RabbitMQ。")
    add_bullet(doc, "Python 侧：项目 .venv、PostgreSQL、Milvus、MinIO、Redis、Celery。")
    add_bullet(doc, "前端：Node.js 18+，Vite 开发环境。")

    add_heading(doc, "4.2 本地端口与服务规划", 3)
    port_rows = [
        ("10010", "a3-gateway", "统一网关入口"),
        ("8081", "a3-auth", "认证服务"),
        ("8086", "a3-resource", "课程资源服务"),
        ("8089", "a3-assessment", "测评服务"),
        ("8090", "a3-learning", "学习服务"),
        ("8093", "a3-analytics", "数据分析服务"),
        ("18080", "a3-ai-python", "AI 中台"),
        ("3002", "a3-student-react-web", "学生端前端"),
        ("3004", "a3-admin-web", "管理端前端"),
    ]
    add_table(doc, ["端口", "服务", "说明"], port_rows, [0.9, 2.1, 3.9])

    add_heading(doc, "4.3 启动流程", 3)
    add_text(doc, "本地联调时，推荐先启动数据库和基础中间件，再初始化 MySQL 脚本与 Python 迁移，随后按“网关 -> Java 业务服务 -> AI 服务 -> 学生端/管理端前端”的顺序启动。AI 中台本地脚本已经明确要求使用项目虚拟环境中的 Python，避免系统 Python 或 Anaconda 抢占 18080 端口。")
    add_bullet(doc, "基础依赖可通过 docker-compose.local.yml 启动 PostgreSQL、Redis、RabbitMQ、MinIO、Milvus 和 MySQL。")
    add_bullet(doc, "MySQL 初始化使用 scripts/init-mysql.ps1，AI 数据库迁移使用 alembic upgrade head。")
    add_bullet(doc, "AI 服务可使用 scripts/start-ai-local.ps1 启动，网关可使用 scripts/start-gateway-local.ps1 启动。")
    add_bullet(doc, "学生端默认 npm run dev 运行在 3002，管理端默认 npm run dev 运行在 3004。")

    add_heading(doc, "4.4 运维与监控", 3)
    add_text(doc, "系统已具备基础运维与监控抓手，包括智能体运行日志、审计日志、配置历史、后台总览摘要与异常统计。对于答辩和演示场景，这些能力能够快速展示系统不仅能“用”，而且可观察、可排障、可管理。")

    add_heading(doc, "5. 用户界面和操作说明", 1)
    add_heading(doc, "5.1 学生端界面", 2)
    add_text(doc, "学生端以 React + Vite 构建，围绕首页工作台、课程学习、个性化路径、资源中心、智能辅导和测评报告组织页面。现有脚本中包含多项 smoke 测试，例如资源中心、个性化学习、实时 IM 与 AI 辅导场景，用于验证主链路的稳定性。")

    add_heading(doc, "5.2 管理端界面", 2)
    add_text(doc, "管理端承接后台总览、用户管理、审核、配置与统计摘要展示。它既是运维视角，也是答辩时展示“闭环”能力的重要入口，可以向评审说明平台具备运营、监控和质量治理能力，而不仅仅是单点 AI 功能演示。")

    add_heading(doc, "5.3 典型操作流程", 2)
    add_bullet(doc, "学生登录后进入首页工作台，查看画像、学习路径和推荐资源。")
    add_bullet(doc, "学生在智能辅导场景中提出问题，系统经网关转发至 AI 中台完成意图识别、检索和回答生成。")
    add_bullet(doc, "学生触发资源生成或测评后，可在前端查看进度、结果和历史记录。")
    add_bullet(doc, "管理员在后台总览页查看异常任务、待审核项、日志统计和系统配置。")

    add_heading(doc, "6. 项目特色与总结", 1)
    add_heading(doc, "6.1 项目特色", 3)
    add_bullet(doc, "采用 Java 微服务与 Python AI 中台协同架构，业务与智能能力边界清晰。")
    add_bullet(doc, "以学习画像、学习路径、资源生成、智能辅导和测评反馈形成较完整的学习闭环。")
    add_bullet(doc, "前端不仅有学生主链路，还有后台运营与统计摘要支撑答辩展示。")
    add_bullet(doc, "项目文档、SQL 脚本、启动脚本和演示总结已逐步收口，便于交付和复现。")

    add_heading(doc, "6.2 总结", 3)
    add_text(doc, "综合当前代码仓库与说明文档，BiliLearn 岗学智练已经具备面向软件开发岗位的个性化自适应学习智能体雏形。它保留课程、学习、测评和管理业务基础，并通过独立 AI 中台补充多智能体协同、知识库检索、资源生成和学习评估能力，可支撑 XA-202603 比赛演示与项目交付。")

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
