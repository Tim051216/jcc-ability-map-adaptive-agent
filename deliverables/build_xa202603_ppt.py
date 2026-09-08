from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "03-作品说明" / "XA-202603岗位自适应学习智能体说明.pptx"

SLIDES = [
    ("BiliLearn 岗学智练", "面向软件技术专业群的软件开发岗位自适应学习智能体\nXA-202603 作品说明"),
    ("真实场景与痛点", "对象：软件技术专业学生\n环节：综合实训、技能竞赛和岗位实习准备\n痛点：难以识别能力短板，教师难以快速生成差异化学习任务"),
    ("参赛定位", "专业群：软件技术专业群\n核心岗位：软件开发工程师\n核心方向：个性化自适应学习\n闭环：目标 -> 诊断 -> 路径 -> 学习 -> 复测"),
    ("岗位能力模型", "需求理解与分析\n系统设计\n编码实现\n软件测试\n项目协作与交付"),
    ("核心功能闭环", "1. 选择课程、实训、竞赛或实习目标\n2. 完成岗位能力诊断\n3. 生成薄弱项和个性化路径\n4. 推荐带来源的资源和任务\n5. 提交产出并查看复测/报告"),
    ("专业知识与技能任务", "知识目录 K001-K080，共 80 条\n每条包含知识点、技能点、场景、常见错误、学习建议、安全提示和来源\n每条可生成任务提示、提交产出和验收标准"),
    ("AI 导师与知识库", "星辰 Agent 负责目标澄清、知识检索和分步指导\n命中结果展示来源与依据\n未命中时降低确定性并说明限制\n高风险问题提供安全提示并建议人工复核"),
    ("技术架构与验证", "React + Vite 学生端\nFastAPI AI 中台 + Java 业务服务\n知识目录、岗位学习聚合接口和任务记录接口\n后端测试 25 项通过，前端 lint/build 通过，GitHub Actions 全部通过"),
    ("演示主链路", "打开岗位学习 -> 选择目标 -> 能力诊断 -> 查看薄弱项\n进入知识目录 -> 查看来源和技能点 -> 提交任务产出\n查看学习效果 -> 使用星辰 Agent 演示引用、澄清和保守回答"),
    ("交付与合规", "源码、接口、知识目录、测试证据按官方 01-06 目录整理\n演示数据明确标注为本地演示数据\n不使用未经授权真实数据，不伪造教师复核和用户反馈\n谢谢评审老师"),
]


def add_text(slide, text, left, top, width, height, size, color, bold=False):
    box = slide.shapes.add_textbox(left, top, width, height)
    frame = box.text_frame
    frame.word_wrap = True
    frame.clear()
    for index, line in enumerate(text.split("\n")):
        p = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        p.text = line
        p.font.name = "Microsoft YaHei"
        p.font.size = Pt(size)
        p.font.bold = bold
        p.font.color.rgb = color
        p.space_after = Pt(10)
    return box


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]
    navy = RGBColor(15, 35, 66)
    red = RGBColor(228, 0, 43)
    gray = RGBColor(82, 96, 109)
    for number, (title, body) in enumerate(SLIDES, 1):
        slide = prs.slides.add_slide(blank)
        bg = slide.background.fill
        bg.solid()
        bg.fore_color.rgb = RGBColor(250, 251, 253)
        add_text(slide, f"{number:02d} / {len(SLIDES):02d}", Inches(0.75), Inches(0.55), Inches(2), Inches(0.35), 11, red, True)
        add_text(slide, title, Inches(0.75), Inches(1.2), Inches(11.8), Inches(0.8), 28, navy, True)
        add_text(slide, body, Inches(1.0), Inches(2.35), Inches(11.0), Inches(3.8), 22, gray)
        add_text(slide, "BiliLearn 岗学智练 · XA-202603", Inches(0.75), Inches(6.85), Inches(6), Inches(0.25), 10, gray)
    prs.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
