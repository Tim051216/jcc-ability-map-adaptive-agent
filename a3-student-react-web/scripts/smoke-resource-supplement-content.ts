type ContentCase = {
  resourceType: string;
  label: string;
  requiredSnippets: string[];
};

type ContentCheckResult = {
  resourceType: string;
  label: string;
  status?: number;
  title?: string;
  passed?: boolean;
  missingSnippets?: string[];
  error?: string;
};

const API_BASE = "http://127.0.0.1:18080/api/v1";

const CASES: ContentCase[] = [
  {
    resourceType: "extended_reading",
    label: "拓展阅读",
    requiredSnippets: ["## 阅读目标", "## 工程案例视角", "## 延伸追问", "## 阅读后输出"],
  },
  {
    resourceType: "coding_lab",
    label: "代码实操",
    requiredSnippets: ["## 任务目标", "## 前置准备", "## 交付物要求", "## 复盘提示"],
  },
  {
    resourceType: "visual_illustration",
    label: "教学插图",
    requiredSnippets: ["## 插图目标", "## 推荐画面结构", "## 配文建议", "## 使用方式"],
  },
  {
    resourceType: "micro_video",
    label: "讲解动画",
    requiredSnippets: ["## 视频定位", "## 分镜脚本", "### 镜头 1：问题引入", "## 输出建议"],
  },
  {
    resourceType: "subtitle_transcript",
    label: "ASR 字幕",
    requiredSnippets: ["## 分段字幕", "00:00", "## 检索关键词", "## 使用建议"],
  },
  {
    resourceType: "ocr_notes",
    label: "OCR 板书",
    requiredSnippets: ["## 板书主线", "## 课堂速记整理", "## 复习提醒"],
  },
];

async function main() {
  const userId = 99887768;
  const checks: ContentCheckResult[] = [];

  for (const item of CASES) {
    const check: ContentCheckResult = {
      resourceType: item.resourceType,
      label: item.label,
    };
    try {
      const response = await fetch(`${API_BASE}/resource/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          course_id: 302,
          knowledge_points: ["软挑赛题项目实训", "核心知识点"],
          resource_types: [item.resourceType],
        }),
      });
      check.status = response.status;
      const json = await response.json();
      const resource = json.resources?.[0];
      const content = String(resource?.content_markdown || "");
      check.title = resource?.title;
      check.missingSnippets = item.requiredSnippets.filter((snippet) => !content.includes(snippet));
      check.passed = response.status === 200 && check.missingSnippets.length === 0;
    } catch (error) {
      check.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      check.passed = false;
    }
    checks.push(check);
  }

  const passed = checks.filter((item) => item.passed).length;
  const failed = checks.length - passed;

  console.log(
    JSON.stringify(
      {
        summary: {
          total: checks.length,
          passed,
          failed,
        },
        checks,
      },
      null,
      2,
    ),
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
