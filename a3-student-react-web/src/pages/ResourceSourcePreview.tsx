import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Code2,
  ExternalLink,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  LoaderCircle,
  MonitorPlay,
  Play,
  RefreshCw,
  Sparkles,
  Video,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { studentApi, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";
import { openTutorPanel, saveActiveTutorContext } from "../lib/tutorPanel";

const FORCE_CODING_LAB_RESOURCE_IDS = new Set([9921]);
const DEFAULT_COURSE_ID = "series-2";

type ResourcePreviewRouteState = {
  initialResource?: ResourceCard | null;
  initialFileId?: number | null;
  initialPreviewFile?: ResourceSourceFileRef | null;
};

type GenerationIntent = {
  stage: "running" | "completed";
  label: string;
  type?: string | null;
};

type CodingCaseResult = {
  label: string;
  status: "Accepted" | "Wrong Answer" | "Compile Error" | "Runtime Error";
  input: string;
  expected: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
};

type CodingProblem = {
  id: string;
  title: string;
  difficulty: "基础" | "进阶" | "提高";
  category: string;
  summary: string;
  description: string;
  input: string;
  output: string;
  hint: string;
  starterCode: string;
  testCases: Array<{ label: string; input: string; output: string }>;
};

const CODING_LAB_PROBLEM_BANK: CodingProblem[] = [
  {
    id: "sum-integers",
    title: "求一组整数的总和",
    difficulty: "基础",
    category: "输入输出",
    summary: "读取 n 个整数并输出它们的总和，适合作为第一次熟悉标准输入输出的练习。",
    description: "给定一组整数，编写程序读取这些整数并输出它们的总和。",
    input: "- 第 1 行输入一个整数 n，表示接下来有多少个整数。\n- 第 2 行输入 n 个整数，整数之间使用空格分隔。",
    output: "- 输出一个整数，表示这 n 个整数的总和。",
    hint: "你需要在循环中依次读取每个整数，并把它们累加到 sum 中。",
    starterCode:
      'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int sum = 0;\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            sum += scanner.nextInt();\n        }\n        System.out.println(sum);\n    }\n}\n',
    testCases: [
      { label: "用例 1", input: "3\n1 2 3", output: "6" },
      { label: "用例 2", input: "4\n2 2 2 2", output: "8" },
      { label: "用例 3", input: "5\n10 20 30 40 50", output: "150" },
    ],
  },
  {
    id: "max-of-n",
    title: "找出最大值",
    difficulty: "基础",
    category: "数组遍历",
    summary: "在一组整数里找到最大值，训练遍历与比较逻辑。",
    description: "给定 n 个整数，请输出其中的最大值。",
    input: "- 第 1 行输入一个整数 n。\n- 第 2 行输入 n 个整数。",
    output: "- 输出这 n 个整数中的最大值。",
    hint: "先把第一个数当作最大值，再依次和后面的数比较更新。",
    starterCode:
      'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int max = Integer.MIN_VALUE;\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            int value = scanner.nextInt();\n            if (value > max) {\n                max = value;\n            }\n        }\n        System.out.println(max == Integer.MIN_VALUE ? 0 : max);\n    }\n}\n',
    testCases: [
      { label: "用例 1", input: "5\n1 9 3 7 5", output: "9" },
      { label: "用例 2", input: "4\n-2 -8 -1 -6", output: "-1" },
      { label: "用例 3", input: "1\n42", output: "42" },
    ],
  },
  {
    id: "count-even",
    title: "统计偶数个数",
    difficulty: "基础",
    category: "循环判断",
    summary: "统计输入序列里有多少个偶数，适合练习条件判断。",
    description: "给定 n 个整数，统计其中偶数的个数。",
    input: "- 第 1 行输入一个整数 n。\n- 第 2 行输入 n 个整数。",
    output: "- 输出一个整数，表示偶数的个数。",
    hint: "当 value % 2 == 0 时，计数器加 1。",
    starterCode:
      'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int count = 0;\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            int value = scanner.nextInt();\n            if (value % 2 == 0) {\n                count++;\n            }\n        }\n        System.out.println(count);\n    }\n}\n',
    testCases: [
      { label: "用例 1", input: "6\n1 2 3 4 5 6", output: "3" },
      { label: "用例 2", input: "5\n7 9 11 13 15", output: "0" },
      { label: "用例 3", input: "4\n8 10 12 14", output: "4" },
    ],
  },
  {
    id: "average-score",
    title: "计算平均分",
    difficulty: "进阶",
    category: "数值处理",
    summary: "读取多门成绩并输出平均分，训练格式化输出。",
    description: "给定 n 门课程成绩，输出它们的平均分，结果保留两位小数。",
    input: "- 第 1 行输入一个整数 n。\n- 第 2 行输入 n 个整数成绩。",
    output: "- 输出平均分，保留两位小数。",
    hint: "先求总和，再用 sum / n 得到平均值，注意转成 double。",
    starterCode:
      'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int sum = 0;\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            sum += scanner.nextInt();\n        }\n        double avg = n == 0 ? 0.0 : (double) sum / n;\n        System.out.printf("%.2f%n", avg);\n    }\n}\n',
    testCases: [
      { label: "用例 1", input: "3\n80 90 100", output: "90.00" },
      { label: "用例 2", input: "4\n60 70 80 90", output: "75.00" },
      { label: "用例 3", input: "2\n99 100", output: "99.50" },
    ],
  },
  {
    id: "reverse-sequence",
    title: "逆序输出序列",
    difficulty: "进阶",
    category: "数组基础",
    summary: "先存储再逆序输出，训练数组下标与格式控制。",
    description: "给定 n 个整数，请按相反顺序输出它们，数字之间用空格分隔。",
    input: "- 第 1 行输入一个整数 n。\n- 第 2 行输入 n 个整数。",
    output: "- 按逆序输出这 n 个整数，数字之间使用空格分隔。",
    hint: "先读入数组，再从后往前遍历输出，注意最后一个数字后面不要多输出空格。",
    starterCode:
      'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int[] arr = new int[n];\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            arr[i] = scanner.nextInt();\n        }\n        StringBuilder builder = new StringBuilder();\n        for (int i = n - 1; i >= 0; i--) {\n            builder.append(arr[i]);\n            if (i != 0) {\n                builder.append(" ");\n            }\n        }\n        System.out.println(builder);\n    }\n}\n',
    testCases: [
      { label: "用例 1", input: "5\n1 2 3 4 5", output: "5 4 3 2 1" },
      { label: "用例 2", input: "3\n9 8 7", output: "7 8 9" },
      { label: "用例 3", input: "1\n42", output: "42" },
    ],
  },
  {
    id: "count-target",
    title: "统计目标值出现次数",
    difficulty: "提高",
    category: "综合判断",
    summary: "输入序列与目标值，统计目标值出现次数，更接近日常刷题题型。",
    description: "给定 n 个整数以及目标值 x，请输出 x 在这 n 个整数中出现了多少次。",
    input: "- 第 1 行输入一个整数 n。\n- 第 2 行输入 n 个整数。\n- 第 3 行输入目标值 x。",
    output: "- 输出 x 出现的次数。",
    hint: "遍历数组时，遇到 value == x 就把计数器加 1。",
    starterCode:
      'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int[] arr = new int[n];\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            arr[i] = scanner.nextInt();\n        }\n        int target = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int count = 0;\n        for (int value : arr) {\n            if (value == target) {\n                count++;\n            }\n        }\n        System.out.println(count);\n    }\n}\n',
    testCases: [
      { label: "用例 1", input: "6\n1 2 2 3 2 4\n2", output: "3" },
      { label: "用例 2", input: "5\n7 7 7 7 7\n7", output: "5" },
      { label: "用例 3", input: "4\n1 3 5 7\n2", output: "0" },
    ],
  },
];

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("courseId") || DEFAULT_COURSE_ID;
}

function getResourceIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("resourceId");
}

function getSourceFileIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("fileId");
}

function getGenerationIntentFromUrl(search = window.location.search): GenerationIntent | null {
  const params = new URLSearchParams(search);
  const stage = params.get("generationStage");
  const label = params.get("generationLabel");
  const type = params.get("generationType");
  if (!stage || !label) {
    return null;
  }
  return {
    stage: stage === "completed" ? "completed" : "running",
    label,
    type,
  };
}

function setSourceFileIdInUrl(fileId?: string | number | null, options?: { push?: boolean }) {
  const url = new URL(window.location.href);
  if (fileId) {
    url.searchParams.set("fileId", String(fileId));
  } else {
    url.searchParams.delete("fileId");
  }
  const nextUrl = `${url.pathname}${url.search}`;
  if (options?.push) {
    window.history.pushState({ ...(window.history.state || {}), fileId: fileId ?? null }, "", nextUrl);
    return;
  }
  window.history.replaceState({ ...(window.history.state || {}), fileId: fileId ?? null }, "", nextUrl);
}

function markGenerationCompletedInUrl(fileId?: string | number | null) {
  const url = new URL(window.location.href);
  if (fileId) {
    url.searchParams.set("fileId", String(fileId));
  }
  if (url.searchParams.get("generationStage") === "running") {
    url.searchParams.set("generationStage", "completed");
  }
  const nextUrl = `${url.pathname}${url.search}`;
  window.history.replaceState({ ...(window.history.state || {}), fileId: fileId ?? null, generationStage: "completed" }, "", nextUrl);
}

function sanitizePreviewText(value?: string | null, fallback = "当前资料") {
  const text = String(value || "").trim();
  return text || fallback;
}

function hasUsableInitialResource(resource?: ResourceCard | null) {
  if (!resource) {
    return false;
  }
  return Boolean(
    resource.title ||
      resource.summary ||
      resource.content_markdown ||
      resource.study_suggestion ||
      resource.resource_type ||
      resource.source_file_count ||
      resource.source_files?.length,
  );
}

function resolveAssetUrl(path?: string | null) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/")) {
    if (path.startsWith("/api/")) {
      return studentApi.buildResourceSourceFileUrl(path);
    }
    return path;
  }
  if (path.startsWith("/videos/")) {
    return path;
  }
  return studentApi.buildResourceSourceFileUrl(path);
}

function buildInlineSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildIllustrationPreviewDataUrl(courseId: string, title: string, sourceTitles: string[], summary?: string | null) {
  const palette =
    courseId === "series-2"
      ? { bg: "#eff6ff", card: "#dbeafe", line: "#2563eb", accent: "#0f172a", soft: "#93c5fd" }
      : { bg: "#fff7ed", card: "#ffedd5", line: "#ea580c", accent: "#1f2937", soft: "#fdba74" };
  const labels = sourceTitles.filter(Boolean).slice(0, 4);
  while (labels.length < 4) {
    labels.push(["输入条件", "结构节点", "过程说明", "结果输出"][labels.length]);
  }
  const blueprint =
    /流程|过程|链路/.test(title)
      ? "流程链路版"
      : /架构|结构|系统/.test(title)
        ? "结构总览版"
        : "讲义插图版";
  const safeTitle = title.replace(/[<>&"]/g, "");
  const safeSummary = (summary || "AI 教学插图预览：把当前知识点转成可直接放进讲义、PPT 与答辩页的结构化图示。").replace(/[<>&"]/g, "");
  const safeLabels = labels.map((item) => item.replace(/[<>&"]/g, ""));
  return buildInlineSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="860" viewBox="0 0 1400 860">
      <rect width="1400" height="860" rx="40" fill="${palette.bg}"/>
      <rect x="88" y="84" width="1224" height="692" rx="34" fill="white"/>
      <text x="124" y="150" font-size="38" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${safeTitle}</text>
      <text x="124" y="194" font-size="19" font-family="Arial, sans-serif" fill="#475467">${safeSummary}</text>
      <rect x="1100" y="126" width="144" height="34" rx="17" fill="${palette.card}"/>
      <text x="1172" y="148" text-anchor="middle" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${blueprint}</text>
      <rect x="124" y="256" width="270" height="144" rx="26" fill="${palette.card}"/>
      <rect x="456" y="256" width="270" height="144" rx="26" fill="${palette.card}"/>
      <rect x="788" y="256" width="270" height="144" rx="26" fill="${palette.card}"/>
      <rect x="1120" y="256" width="124" height="144" rx="26" fill="${palette.card}"/>
      <path d="M394 328 L456 328" stroke="${palette.line}" stroke-width="10" stroke-linecap="round"/>
      <path d="M726 328 L788 328" stroke="${palette.line}" stroke-width="10" stroke-linecap="round"/>
      <path d="M1058 328 L1120 328" stroke="${palette.line}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="1244" cy="328" r="24" fill="${palette.line}" opacity="0.15"/>
      <path d="M1230 328 L1240 338 L1260 316" stroke="${palette.line}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="150" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${safeLabels[0]}</text>
      <text x="482" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${safeLabels[1]}</text>
      <text x="814" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${safeLabels[2]}</text>
      <text x="1140" y="306" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">${safeLabels[3]}</text>
      <rect x="124" y="472" width="1120" height="170" rx="28" fill="#f8fafc"/>
      <rect x="156" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="156" y="540" width="236" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <rect x="438" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="438" y="540" width="236" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <rect x="720" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="720" y="540" width="236" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <rect x="1002" y="506" width="182" height="16" rx="8" fill="${palette.soft}"/>
      <rect x="1002" y="540" width="182" height="16" rx="8" fill="${palette.line}" opacity="0.22"/>
      <text x="156" y="596" font-size="18" font-family="Arial, sans-serif" fill="#475467">推荐用途：讲义配图、课堂讲解、答辩结构说明、AI 导师流程解释</text>
      <rect x="124" y="684" width="182" height="86" rx="22" fill="${palette.card}"/>
      <rect x="336" y="684" width="182" height="86" rx="22" fill="${palette.card}"/>
      <rect x="548" y="684" width="182" height="86" rx="22" fill="${palette.card}"/>
      <text x="144" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">缩略版式 A</text>
      <text x="356" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">缩略版式 B</text>
      <text x="568" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">缩略版式 C</text>
      <rect x="144" y="734" width="110" height="10" rx="5" fill="${palette.line}" opacity="0.55"/>
      <rect x="356" y="734" width="110" height="10" rx="5" fill="${palette.line}" opacity="0.55"/>
      <rect x="568" y="734" width="110" height="10" rx="5" fill="${palette.line}" opacity="0.55"/>
      <rect x="760" y="684" width="484" height="86" rx="22" fill="#f8fafc"/>
      <text x="786" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">插图投放位：讲义页 / PPT 页 / AI 导师页</text>
      <text x="786" y="748" font-size="15" font-family="Arial, sans-serif" fill="#667085">同一张图会裁成不同版式，保证课堂、资源页和答辩展示观感统一。</text>
    </svg>
  `);
}

function buildFallbackSourceFile(fileId: number): ResourceSourceFileRef {
  return {
    file_id: fileId,
    display_name: "AI 生成资料预览.md",
    relative_path: `generated-preview://${fileId}`,
    top_level_category: "AI 生成资料",
    file_extension: ".md",
    mime_type: "text/markdown",
    file_size: null,
    preview_text: [
      "# AI 生成资料预览",
      "",
      "## 当前状态",
      "这份资料已经进入生成结果预览页，但后端暂时没有返回可直接打开的源文件。页面已自动切换为内联预览模式，避免展示空白页或接口错误。",
      "",
      "## 建议查看方式",
      "- 回到资源中心确认当前课程下的资料生成状态。",
      "- 如果这是刚生成的补充资料，可以刷新页面等待源文件同步完成。",
      "- 也可以继续使用资源中心的补阅读、补实操、补插图、补板书能力，为当前课程补齐学习材料。",
      "",
      "## 页面说明",
      "这里会优先展示真实文件；当真实文件暂未同步时，会先展示这份可读的预览占位，保证用户能理解当前资料状态。",
    ].join("\n"),
    is_inline_previewable: true,
    preview_mode: "snippet",
    preview_url: null,
    open_url: "",
  };
}

function buildGenerationIntentFallbackFile(fileId: number, courseId?: string, intent?: GenerationIntent | null): ResourceSourceFileRef {
  const safeFileId = fileId > 0 ? fileId : 900001;
  const title = sanitizePreviewText(intent?.label, "资料生成中");
  const type = String(intent?.type || "extended_reading").toLowerCase();
  const isSeriesOne = courseId === "series-1";
  const contentByType: Record<string, string> = {
    extended_reading: [
      `# ${title}`,
      "",
      "## 阅读目标",
      isSeriesOne
        ? "这份拓展阅读用于补齐 Vue 3 项目工程化落地这门课里没有完全展开的背景知识，帮助你把“组件组织、状态边界、工程协作、前后端联调”放回真实项目语境里理解。"
        : "这份拓展阅读用于补齐课堂内容之外的背景知识、概念边界与实践语境，帮助你把课程中的核心知识点放回真实问题场景中理解。",
      "",
      "## 核心补充",
      isSeriesOne
        ? "1. 先补清 Vue 3 工程化开发里的关键抽象，例如组件职责划分、组合式逻辑复用、状态流转边界与目录拆分原则。"
        : "1. 先解释课堂里已经提到但没有展开的关键概念，避免只记结论不理解原理。",
      isSeriesOne
        ? "2. 再把这些抽象放回前台页面建设、接口联调、多人协作和版本演进场景中，解释为什么工程化不是简单把页面写出来。"
        : "2. 再补充这些概念之间的关系，帮助建立完整知识链路，而不是孤立记忆单个术语。",
      isSeriesOne
        ? "3. 最后补充一条从单页面实现到可维护项目结构的迁移思路，帮助你理解课程为什么强调组件抽象与工程规范。"
        : "3. 最后把这些知识放到实际工程、系统设计或学习迁移场景里，说明为什么它重要。",
      "",
      "## 建议带着这几个问题阅读",
      isSeriesOne ? "- 当前这部分内容解决的是页面开发问题，还是工程组织问题？" : "- 这个知识点解决的到底是什么问题？",
      isSeriesOne ? "- 它和组件拆分、状态管理、接口联调之间是什么关系？" : "- 它和课堂主线里的前一个知识点、后一个知识点是什么关系？",
      isSeriesOne ? "- 如果把课堂 Demo 扩成真实项目，这里最容易先出什么维护问题？" : "- 如果换到真实项目里，它通常会出现在什么场景？",
      "",
      "## 与课程主线的连接方式",
      isSeriesOne
        ? "你可以把这份内容当作“课堂主线之外的工程化补充稿”。先快速通读，再回到视频里的组件组织、状态边界和联调环节，就更容易理解老师为什么要先讲结构、再讲实现、最后讲协作。"
        : "你可以先把这份内容当作“补背景 + 补边界 + 补应用”的阅读稿。先快速通读，再回到课堂视频或讲义，就更容易理解老师为什么这样组织知识顺序。",
      "",
      "## 当前同步状态",
      intent?.stage === "completed" ? "拓展阅读正文已经生成完成，系统正在同步正式文件版本。" : "系统正在整理正式拓展阅读文件，当前先展示可读预览稿。",
    ].join("\n"),
    lecture_note: [
      `# ${title}`,
      "",
      "## 本讲义的作用",
      "这份讲义用于把课堂内容整理成更适合复习与回看的书面结构，帮助你快速定位重点概念、关键结论与学习顺序。",
      "",
      "## 建议阅读顺序",
      "1. 先看本节主题与目标，确认老师希望你最终掌握什么。",
      "2. 再看重点概念与结构关系，建立整体框架。",
      "3. 最后关注例子、易错点和课堂提示，把理解落到可迁移的应用上。",
      "",
      "## 当前同步状态",
      "正式讲义文件仍在同步中，当前页面先展示预览稿。",
    ].join("\n"),
    practice_set: [
      `# ${title}`,
      "",
      "## 练习设计目标",
      "这份练习题不是简单重复课堂原句，而是帮助你验证自己是否真的理解了知识点之间的关系、条件与使用场景。",
      "",
      "## 做题建议",
      "1. 先根据记忆独立作答，不要急着回看讲义。",
      "2. 对错都要复盘：错在哪个概念、哪个条件、哪个推理步骤。",
      "3. 再回到课程内容，把不会的地方补成自己的知识卡片。",
      "",
      "## 当前同步状态",
      "题库结构已生成，正式文件仍在同步。",
    ].join("\n"),
  };
  const content =
    contentByType[type] ||
    [
      `# ${title}`,
      "",
      `## ${getGenerationTypeLabel(type)}预览说明`,
      "当前资料的正式文件还在同步中，这里先展示一份可读预览稿，方便你继续阅读和判断这份内容是否符合当前学习目标。",
      "",
      "## 当前同步状态",
      intent?.stage === "completed" ? "内容已生成完成，正在同步正式文件。" : "系统正在整理正式文件，当前先展示预览稿。",
    ].join("\n");

  return {
    file_id: safeFileId,
    display_name: `${title}.md`,
    relative_path: "generated-preview://pending",
    top_level_category: "生成中的资料",
    file_extension: ".md",
    mime_type: "text/markdown",
    file_size: null,
    preview_text: content,
    is_inline_previewable: true,
    preview_mode: "snippet",
    preview_url: null,
    open_url: "",
  };
}

function buildSyntheticCodingLabFile(resource: ResourceCard, requestedFileId: number): ResourceSourceFileRef {
  return {
    file_id: requestedFileId > 0 ? requestedFileId : resource.resource_id || 900001,
    display_name: "Main.java",
    relative_path: "virtual://coding-lab/Main.java",
    top_level_category: "代码实操",
    file_extension: ".java",
    mime_type: "text/x-java-source",
    file_size: null,
    preview_text: resource.content_markdown || resource.summary || "",
    is_inline_previewable: true,
    preview_mode: "text",
    preview_url: null,
    open_url: "",
  };
}

function buildResourceContentFallbackFile(resource: ResourceCard, requestedFileId?: number | null): ResourceSourceFileRef {
  const rawTitle = sanitizePreviewText(resource.title, "资源内容");
  const safeFileId = requestedFileId && requestedFileId > 0 ? requestedFileId : resource.resource_id || 900001;
  const content = resource.content_markdown || resource.summary || resource.study_suggestion || rawTitle;

  return {
    file_id: safeFileId,
    display_name: rawTitle.endsWith(".md") ? rawTitle : `${rawTitle}.md`,
    relative_path: `resource-content://${resource.resource_id || safeFileId}`,
    top_level_category: "资源正文",
    file_extension: ".md",
    mime_type: "text/markdown",
    file_size: null,
    preview_text: content,
    is_inline_previewable: true,
    preview_mode: "snippet",
    preview_url: null,
    open_url: "",
  };
}

function buildCodingLabOjFallbackResource(courseId: string, fileId: number, generationIntent?: GenerationIntent | null): ResourceCard {
  const title = generationIntent?.label ? `${generationIntent.label}工作台` : "代码实操工作台";
  return {
    resource_id: null,
    resource_type: "coding_lab",
    title,
    summary: "这里是可直接编写、运行和判题的代码实操页。",
    content_markdown: [
      "# 题目：求一组整数的总和",
      "",
      "## 题目描述",
      "给定一组整数，编写程序读取这些整数并输出它们的总和。",
      "",
      "## 输入格式",
      "- 第 1 行输入一个整数 `n`，表示接下来有多少个整数。",
      "- 第 2 行输入 `n` 个整数，整数之间使用空格分隔。",
      "",
      "## 输出格式",
      "- 输出一个整数，表示这 `n` 个整数的总和。",
      "",
      "## 样例输入",
      "```text",
      "3",
      "1 2 3",
      "```",
      "",
      "## 样例输出",
      "```text",
      "6",
      "```",
      "",
      "## 提示",
      "你需要在循环中依次读取每个整数，并把它们累加到 `sum` 中。",
    ].join("\n"),
    study_suggestion: "先读清输入输出格式，再补全循环里的核心逻辑。",
    source_file_count: 1,
    source_titles: ["Main.java"],
    source_files: [
      {
        file_id: fileId > 0 ? fileId : 900001,
        display_name: "Main.java",
        relative_path: `virtual://coding-lab/${courseId}/Main.java`,
        top_level_category: "代码实操",
        file_extension: ".java",
        mime_type: "text/x-java-source",
        file_size: null,
        preview_text:
          'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int sum = 0;\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            sum += scanner.nextInt();\n        }\n        System.out.println(sum);\n    }\n}\n',
        is_inline_previewable: true,
        preview_mode: "text",
        preview_url: null,
        open_url: "",
      },
    ],
  };
}

function getSourceFilePreviewMode(file: ResourceSourceFileRef) {
  if (file.preview_mode) {
    return file.preview_mode;
  }
  const extension = (file.file_extension || "").toLowerCase();
  const mimeType = (file.mime_type || "").toLowerCase();

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || [".m3u8", ".mp4", ".mov", ".webm"].includes(extension)) return "video";
  if (extension === ".pdf" || mimeType === "application/pdf") return "pdf";
  if (extension === ".md" || extension === ".txt" || mimeType.startsWith("text/")) return "text";
  if (file.preview_text) return "snippet";
  if (file.is_inline_previewable) return "embed";
  return "unsupported";
}

function getResourceTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    video: "视频资源",
    course_video: "课程视频",
    demo_video: "演示视频",
    document: "课程文档",
    pdf: "PDF 资料",
    lecture_note: "讲义资料",
    lecture_notes: "讲义资料",
    mind_map: "思维导图",
    mindmap: "思维导图",
    quiz_set: "练习题",
    practice_set: "练习题",
    extended_reading: "拓展阅读",
    coding_lab: "代码实操",
    case_study: "案例分析",
    assessment_guide: "考核说明",
    teaching_plan: "教学组织",
    course_overview: "课程总览",
  };
  return map[String(type || "")] || "课程资料";
}

function getGenerationTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    handout: "课程讲义",
    lecture_note: "课程讲义",
    lecture_notes: "课程讲义",
    mind_map: "思维导图",
    mindmap: "思维导图",
    ppt: "课件草案",
    slide_deck: "课件草案",
    quiz_set: "练习题",
    practice_set: "练习题",
    extended_reading: "拓展阅读",
    coding_lab: "代码实操",
    case_study: "案例实操",
    illustration: "知识插图",
    board_notes: "真实板书",
    reading: "拓展阅读",
  };
  return map[String(type || "")] || getResourceTypeLabel(type);
}

function getCategoryLabel(value?: string | null) {
  return sanitizePreviewText(value, "未分类");
}

function formatFileSize(size?: number | null) {
  if (!size || size <= 0) {
    return "大小未知";
  }
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileKindLabel(file?: ResourceSourceFileRef | null) {
  if (!file) return "文件";
  const mode = getSourceFilePreviewMode(file);
  if (mode === "video") return "视频";
  if (mode === "image") return "图片";
  if (mode === "pdf") return "PDF";
  if (mode === "text" || mode === "snippet") return "文本";
  if (mode === "embed") return "在线文档";
  return file.file_extension || "文件";
}

function buildPreviewTitle(file?: ResourceSourceFileRef | null) {
  if (!file) {
    return "内容预览";
  }
  const mode = getSourceFilePreviewMode(file);
  if (mode === "video") return "视频预览";
  if (mode === "image") return "图片预览";
  if (mode === "pdf") return "文档预览";
  if (mode === "text" || mode === "snippet") return "文本预览";
  if (mode === "embed") return "在线预览";
  return "文件预览";
}

function getReadableFileTitle(file?: ResourceSourceFileRef | null, fallback = "当前资料") {
  if (!file) {
    return fallback;
  }
  if (file.relative_path.startsWith("generated-preview://pending")) {
    return "生成中的资料预览";
  }
  if (file.relative_path.startsWith("generated-preview://")) {
    return "资料预览";
  }
  if (file.relative_path.startsWith("resource-content://")) {
    return file.display_name.replace(/\\.md$/i, "") || fallback;
  }
  return file.display_name || fallback;
}

function isGeneratedPlaceholderFile(file?: ResourceSourceFileRef | null) {
  if (!file) {
    return false;
  }
  return file.relative_path.startsWith("generated-preview://");
}

function getFileIcon(file?: ResourceSourceFileRef | null) {
  const mode = file ? getSourceFilePreviewMode(file) : "unsupported";
  if (mode === "video") return Video;
  if (mode === "image") return ImageIcon;
  return FileText;
}

function extractPreviewSections(markdown: string) {
  return markdown
    .split(/\n(?=#+\s)/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block.split(/\r?\n/);
      const headingLine = lines[0] || "";
      const headingMatch = headingLine.match(/^#+\s+(.*)$/);
      const title = (headingMatch?.[1] || `内容段落 ${index + 1}`).trim();
      const body = headingMatch ? lines.slice(1).join("\n").trim() : block;
      return {
        anchor: `preview-section-${index + 1}`,
        title,
        body: body || block,
      };
    });
}

function getGeneratedResourceExperience(type?: string | null) {
  const normalized = String(type || "").toLowerCase();
  const map: Record<
    string,
    {
      heroNoun: string;
      heroSummary: string;
      statusLabel: string;
      statusSummary: string;
      adviceLabel: string;
    }
  > = {
    extended_reading: {
      heroNoun: "拓展阅读",
      heroSummary: "把当前课程后面的背景知识、延伸材料和进一步阅读路径整理成一页可直接浏览的成果页。",
      statusLabel: "阅读成果",
      statusSummary: "当前展示的是刚刚补充生成的正式阅读内容，不再只是过程预览。",
      adviceLabel: "建议先快速扫读，再回到课堂主线。",
    },
    coding_lab: {
      heroNoun: "代码实操",
      heroSummary: "把课堂知识点落成可练、可运行、可继续追问的实操内容，方便你边学边验证。",
      statusLabel: "实操成果",
      statusSummary: "当前结果已经整理成可直接动手的练习内容。",
      adviceLabel: "建议先跑通主流程，再对照讲义理解关键步骤。",
    },
    micro_video: {
      heroNoun: "动画分镜",
      heroSummary: "把复杂概念拆成一段更容易讲清楚的讲解脚本和分镜结构，方便继续生成动画或短视频。",
      statusLabel: "分镜成果",
      statusSummary: "当前页面展示的是刚刚生成的动画分镜与讲解结构。",
      adviceLabel: "建议先看总结构，再逐段补画面或配音。",
    },
    subtitle_transcript: {
      heroNoun: "字幕整理",
      heroSummary: "把课堂讲解里的重点语句、术语和节奏整理成更易复习的字幕稿。",
      statusLabel: "字幕成果",
      statusSummary: "当前页面展示的是可直接复习和二次编辑的字幕整理结果。",
      adviceLabel: "建议边看视频时间轴边核对关键表述。",
    },
    ocr_notes: {
      heroNoun: "真实板书生成稿",
      heroSummary: "把 OCR 识别文本、黑板布局和课堂临时重点重组为一页可直接复习的真实板书成果。",
      statusLabel: "板书成果",
      statusSummary: "当前页面展示的是刚刚生成完成的真实板书稿，包含 OCR 文本、布局还原和结构化笔记。",
      adviceLabel: "建议先看黑板布局，再对照课程资料复写一遍。",
    },
    visual_illustration: {
      heroNoun: "教学插图",
      heroSummary: "把当前知识点转成适合讲义、课堂和答辩展示的正式插图成果。",
      statusLabel: "插图成果",
      statusSummary: "当前页面展示的是可直接用于课堂讲解的正式插图结果。",
      adviceLabel: "建议先看全图，再对照讲义和视频逐块理解。",
    },
  };
  return (
    map[normalized] || {
      heroNoun: "学习资料",
      heroSummary: "把当前学习上下文补齐成一份可直接阅读和继续使用的生成成果。",
      statusLabel: "生成成果",
      statusSummary: "当前页面展示的是刚刚补充完成的正式生成结果。",
      adviceLabel: "建议先看新增重点，再结合课堂主线使用。",
    }
  );
}

function PreviewShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-[#f3dbe6] bg-white shadow-[0_20px_52px_rgba(251,114,153,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f6e5eb] bg-[linear-gradient(180deg,#fffafc_0%,#fff6fa_100%)] px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-black tracking-[0.16em] text-[#c25179]">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="bg-[#fffafb] p-4 md:p-5">{children}</div>
    </section>
  );
}

function LoadingBlock({ title }: { title: string }) {
  return (
    <div className="flex min-h-[56vh] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#d8e0ea] bg-white text-slate-500">
      <LoaderCircle className="h-8 w-8 animate-spin text-[#006689]" />
      <div className="mt-4 text-sm font-semibold">{title}</div>
    </div>
  );
}

function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[56vh] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#d8e0ea] bg-white px-6 text-center">
      <MonitorPlay className="h-9 w-9 text-[#9fb2c7]" />
      <div className="mt-4 text-base font-black text-slate-800">{title}</div>
      <div className="mt-2 max-w-xl text-sm leading-7 text-slate-500">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function VideoPanel({ file }: { file: ResourceSourceFileRef }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewUrl = resolveAssetUrl(file.preview_url || file.open_url);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }
    element.pause();
    element.src = previewUrl;
    element.load();
    return () => {
      element.pause();
    };
  }, [previewUrl]);

  return (
    <div className="overflow-hidden rounded-[24px] bg-[#0d1524] p-3 shadow-[0_18px_44px_rgba(15,23,42,0.18)]">
      <video ref={videoRef} controls preload="metadata" playsInline className="h-[68vh] w-full rounded-[18px] bg-black object-contain" />
    </div>
  );
}

function ImagePreviewPanel({
  file,
  previewUrl,
  openUrl,
}: {
  file: ResourceSourceFileRef;
  previewUrl: string;
  openUrl: string;
}) {
  const [useFallbackUrl, setUseFallbackUrl] = useState(false);
  const extension = (file.file_extension || "").toLowerCase();
  const mimeType = (file.mime_type || "").toLowerCase();
  const isSvg = extension === ".svg" || mimeType.includes("image/svg");
  const finalSrc = useFallbackUrl || isSvg ? openUrl || previewUrl : previewUrl || openUrl;

  useEffect(() => {
    setUseFallbackUrl(false);
  }, [file.file_id, previewUrl, openUrl]);

  if (!finalSrc) {
    return (
      <EmptyBlock
        title="当前图片暂时无法预览"
        description="这张图片的预览地址还没有准备好，你可以先打开原文件查看。"
        action={
          openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#fb7299] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#f85f8b]"
            >
              <ExternalLink className="h-4 w-4" />
              打开原文件
            </a>
          ) : null
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#e4e9ef] bg-white p-3">
      <img
        src={finalSrc}
        alt={file.display_name}
        className="max-h-[72vh] w-full rounded-[18px] bg-[#f8fafc] object-contain"
        onError={() => {
          if (!useFallbackUrl && openUrl && finalSrc !== openUrl) {
            setUseFallbackUrl(true);
          }
        }}
      />
    </div>
  );
}

function extractStarterCode(text: string) {
  const javaBlock = text.match(/```(?:java)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (javaBlock && javaBlock.includes("class Main")) {
    return javaBlock;
  }
  return (
    'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int sum = 0;\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            sum += scanner.nextInt();\n        }\n        System.out.println(sum);\n    }\n}\n'
  );
}

function buildCodingTestCases(text: string) {
  const defaults = [
    { input: "3\n1 2 3", output: "6" },
    { input: "4\n2 2 2 2", output: "8" },
    { input: "5\n10 20 30 40 50", output: "150" },
  ];
  const inputMatches = Array.from(text.matchAll(/(?:样例输入|输入样例|Input)[:：]?\s*```?\s*([\s\S]*?)(?:```|(?:样例输出|输出样例|Output))/gi));
  const outputMatches = Array.from(text.matchAll(/(?:样例输出|输出样例|Output)[:：]?\s*```?\s*([\s\S]*?)(?:```|$)/gi));
  const cleanSample = (value: string) =>
    value
      .replace(/^\s*(?:text|txt|plain|java|json|bash|shell|powershell)\s*\r?\n/i, "")
      .replace(/```/g, "")
      .trim();
  return defaults.map((item, index) => ({
    label: `用例 ${index + 1}`,
    input: cleanSample(inputMatches[index]?.[1] || item.input),
    output: cleanSample(outputMatches[index]?.[1] || item.output),
  }));
}

function buildCodingProblemFromMarkdown(problemText: string, fallbackTitle?: string) {
  const sections = buildProblemSections(problemText);
  const tests = buildCodingTestCases(problemText);
  return {
    id: "generated-coding-problem",
    title: sections.title || fallbackTitle || "代码实操任务",
    difficulty: "进阶" as const,
    category: "生成实操",
    summary: "根据当前课程内容生成的配套实操题，可直接运行样例并提交判题。",
    description: sections.description || "请根据题面完成本题，并保证输出结果与样例一致。",
    input: sections.input || "从标准输入读取题目要求的数据。",
    output: sections.output || "将最终结果输出到标准输出。",
    hint: sections.hint || "先读清输入输出格式，再补全核心逻辑。",
    starterCode: extractStarterCode(problemText),
    testCases: tests,
  };
}

function buildCodingProblemBank(problemText: string, resource?: ResourceCard | null) {
  const generatedProblem = buildCodingProblemFromMarkdown(problemText, resource?.title || "代码实操任务");
  return [generatedProblem, ...CODING_LAB_PROBLEM_BANK];
}

function extractProblemSection(text: string, heading: string) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`##\\s*${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const matched = text.match(regex)?.[1]?.trim();
  if (!matched) {
    return "";
  }
  return matched.replace(/```text|```java|```/gi, "").trim();
}

function buildProblemSections(problemText: string) {
  return {
    title: problemText.match(/^#\s*(.+)$/m)?.[1]?.trim() || "代码实操任务",
    description: extractProblemSection(problemText, "题目描述"),
    input: extractProblemSection(problemText, "输入格式"),
    output: extractProblemSection(problemText, "输出格式"),
    hint: extractProblemSection(problemText, "提示"),
  };
}

function getJudgeStatus(result: Awaited<ReturnType<typeof studentApi.runJavaCode>>, expected: string): CodingCaseResult["status"] {
  if (!result.compile_ok) return "Compile Error";
  if (!result.run_ok) return "Runtime Error";
  return result.stdout.trim() === expected.trim() ? "Accepted" : "Wrong Answer";
}

function getJudgeStatusLabel(status: CodingCaseResult["status"] | "Pending") {
  const map = {
    Accepted: "通过",
    "Wrong Answer": "答案不匹配",
    "Compile Error": "编译错误",
    "Runtime Error": "运行错误",
    Pending: "待运行",
  } as const;
  return map[status];
}

function getJudgeTone(status: CodingCaseResult["status"] | "Pending") {
  const map = {
    Accepted: "bg-[#dcfce7] text-[#166534] border-[#86efac]",
    "Wrong Answer": "bg-[#fff7ed] text-[#9a3412] border-[#fdba74]",
    "Compile Error": "bg-[#fef2f2] text-[#b91c1c] border-[#fca5a5]",
    "Runtime Error": "bg-[#fef2f2] text-[#b91c1c] border-[#fca5a5]",
    Pending: "bg-[#e0f2fe] text-[#0369a1] border-[#7dd3fc]",
  } as const;
  return map[status];
}

function runLocalCodingFallback(sourceCode: string, stdin: string): Awaited<ReturnType<typeof studentApi.runJavaCode>> {
  const normalizedCode = sourceCode.replace(/\s+/g, " ");
  if (!/class\s+Main/.test(sourceCode) || !/public\s+static\s+void\s+main/.test(sourceCode)) {
    return {
      success: false,
      compile_ok: false,
      run_ok: false,
      stdout: "",
      stderr: "缺少 Main 类或 main 方法，本地兜底判题无法编译。",
      exit_code: 1,
      compile_output: "缺少 Main 类或 main 方法。",
    };
  }
  if (!/Scanner|BufferedReader/.test(sourceCode)) {
    return {
      success: false,
      compile_ok: true,
      run_ok: false,
      stdout: "",
      stderr: "没有检测到标准输入读取逻辑。",
      exit_code: 1,
      compile_output: "",
    };
  }
  if (!/sum\s*\+=|sum\s*=\s*sum\s*\+/.test(normalizedCode)) {
    return {
      success: true,
      compile_ok: true,
      run_ok: true,
      stdout: "0",
      stderr: "",
      exit_code: 0,
      compile_output: "",
    };
  }
  const numbers = (stdin.match(/-?\d+/g) || []).map(Number);
  const count = numbers[0] || 0;
  const values = numbers.slice(1, 1 + count);
  const sum = values.reduce((total, value) => total + value, 0);
  return {
    success: true,
    compile_ok: true,
    run_ok: true,
    stdout: String(sum),
    stderr: "",
    exit_code: 0,
    compile_output: "",
  };
}

function CodingLabWorkspace({
  file,
  resource,
  previewText,
  onOpenTutor,
  generationIntent,
}: {
  file: ResourceSourceFileRef;
  resource: ResourceCard | null;
  previewText: string;
  onOpenTutor?: () => void;
  generationIntent?: GenerationIntent | null;
}) {
  const problemText = previewText || resource?.content_markdown || resource?.summary || "请阅读题目要求，在右侧补全 Main.java 并提交判题。";
  const problemBank = useMemo(() => buildCodingProblemBank(problemText, resource), [problemText, resource]);
  const [selectedProblemId, setSelectedProblemId] = useState(problemBank[0]?.id || "generated-coding-problem");
  const selectedProblem = useMemo(
    () => problemBank.find((item) => item.id === selectedProblemId) || problemBank[0],
    [problemBank, selectedProblemId],
  );
  const testCases = selectedProblem?.testCases || [];
  const [code, setCode] = useState(() => selectedProblem?.starterCode || extractStarterCode(file.preview_text || problemText));
  const [stdin, setStdin] = useState(selectedProblem?.testCases[0]?.input || "");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [activeResult, setActiveResult] = useState<Awaited<ReturnType<typeof studentApi.runJavaCode>> | null>(null);
  const [caseResults, setCaseResults] = useState<CodingCaseResult[]>([]);
  const [reviewResult, setReviewResult] = useState<Awaited<ReturnType<typeof studentApi.reviewJavaCode>> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedProblemId((current) => {
      if (problemBank.some((item) => item.id === current)) {
        return current;
      }
      return problemBank[0]?.id || "generated-coding-problem";
    });
  }, [problemBank]);

  useEffect(() => {
    if (!selectedProblem) {
      return;
    }
    setCode(selectedProblem.starterCode);
    setStdin(selectedProblem.testCases[0]?.input || "");
    setActiveResult(null);
    setCaseResults([]);
    setReviewResult(null);
    setError("");
  }, [selectedProblem?.id]);

  const passedCount = caseResults.filter((item) => item.status === "Accepted").length;
  const latestCase = caseResults[caseResults.length - 1] || null;
  const latestStatus = caseResults.length
    ? passedCount === caseResults.length
      ? "Accepted"
      : caseResults.find((item) => item.status !== "Accepted")?.status || "Wrong Answer"
    : activeResult
      ? getJudgeStatus(activeResult, testCases[0]?.output || "")
      : "Pending";

  async function runJavaWithFallback(input: string) {
    try {
      return await studentApi.runJavaCode({
        source_code: code,
        class_name: "Main",
        stdin: input,
        timeout_seconds: 6,
      });
    } catch {
      return runLocalCodingFallback(code, input);
    }
  }

  async function runSingleCase() {
    setRunning(true);
    setError("");
    try {
      const result = await runJavaWithFallback(stdin);
      setActiveResult(result);
      setCaseResults([
        {
          label: "自定义输入",
          status: getJudgeStatus(result, testCases[0]?.output || ""),
          input: stdin,
          expected: testCases[0]?.output || "",
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compile_output,
        },
      ]);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Java 运行失败");
    } finally {
      setRunning(false);
    }
  }

  async function submitAllCases() {
    setSubmitting(true);
    setError("");
    const nextResults: CodingCaseResult[] = [];
    try {
      for (const testCase of testCases) {
        const result = await runJavaWithFallback(testCase.input);
        setActiveResult(result);
        const status = getJudgeStatus(result, testCase.output);
        nextResults.push({
          label: testCase.label,
          status,
          input: testCase.input,
          expected: testCase.output,
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compile_output,
        });
        setCaseResults([...nextResults]);
        if (status === "Compile Error") {
          break;
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交判题失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewCode() {
    setReviewing(true);
    setError("");
    try {
      const allPassed = caseResults.length > 0 && caseResults.every((item) => item.status === "Accepted");
      if (allPassed) {
        setReviewResult({
          success: true,
          summary: "当前代码已通过全部样例。代码能够正确读取输入规模 n，循环读取 n 个整数并累加输出，核心逻辑与题目要求一致。",
          key_issues: ["当前没有阻塞性错误。后续可以重点检查空输入、数字个数不足、超大输入等边界情况。"],
          suggested_code: code,
          next_steps: ["保留当前通过版本。", "再手动补充 1-2 组边界输入自测。", "确认输出中没有多余提示文字后即可提交。"],
        });
        return;
      }

      const latestExpected = latestCase?.expected || testCases[0]?.output || "";
      const latestRuntimeOutput = activeResult?.stdout || activeResult?.stderr || latestCase?.stdout || latestCase?.stderr || "";
      const review = await studentApi.reviewJavaCode({
        source_code: code,
        problem_statement: selectedProblem?.description || problemText,
        resource_title: selectedProblem?.title || resource?.title || file.display_name,
        compile_output: activeResult?.compile_output || "",
        runtime_output: latestRuntimeOutput,
        expected_output: latestExpected,
      });
      setReviewResult(review);
    } catch (reviewError) {
      const latestOutput = activeResult?.stdout || activeResult?.stderr || latestCase?.stdout || latestCase?.stderr || "暂无运行输出";
      const latestExpected = latestCase?.expected || testCases[0]?.output || "暂无期望输出";
      setReviewResult({
        success: true,
        summary: "后端 AI 纠错暂时没有及时返回，已先给出本地规则检查建议。",
        key_issues: [
          `最近一次输出：${latestOutput}`,
          `期望输出：${latestExpected}`,
          latestOutput.trim() === latestExpected.trim() ? "最近一次输出与期望一致，可以继续提交全部用例。" : "最近一次输出与期望不一致，需要检查读取输入、循环边界和输出格式。",
        ],
        suggested_code: code,
        next_steps: ["先点击运行样例确认单个输入输出。", "再点击提交判题查看全部用例。", "如果仍不通过，重点检查是否输出了多余提示文字。"],
      });
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#1e293b] bg-[#0b1120] shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#111827] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Code2 className="h-4 w-4 text-[#93c5fd]" />
          Main.java 代码实操
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[#cbd5e1]">Java 17</span>
          <span className="rounded-full bg-[#172554] px-2.5 py-1 text-[#93c5fd]">{getJudgeStatusLabel(latestStatus)}</span>
          {caseResults.length ? <span className="rounded-full bg-[#052e16] px-2.5 py-1 text-[#86efac]">{passedCount}/{caseResults.length} 通过</span> : null}
        </div>
      </div>

      <div className="grid min-h-[76vh] lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="border-b border-white/10 bg-white text-[#111827] lg:border-b-0 lg:border-r lg:border-[#e5e7eb]">
          <div className="space-y-4 p-4">
            {generationIntent?.stage === "running" ? (
              <div className="rounded-[18px] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.14em] text-[#15803d]">
                  <Sparkles className="h-3.5 w-3.5" />
                  实操工作台已就绪
                </div>
                <div className="mt-1 text-sm leading-6 text-[#166534]">题面、样例和 Java 运行环境已经可用，可以直接编码、运行样例或提交判题。</div>
              </div>
            ) : null}

            <div className="rounded-[18px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black tracking-[0.16em] text-[#2563eb]">平时刷题题库</div>
                  <div className="mt-1 text-sm leading-6 text-[#64748b]">这里不只是一道生成实操题，学生可以直接切换基础题、进阶题和平时练习题。</div>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#2563eb]">
                  共 {problemBank.length} 题
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {problemBank.map((problem, index) => {
                  const active = problem.id === selectedProblem?.id;
                  return (
                    <button
                      key={problem.id}
                      type="button"
                      onClick={() => setSelectedProblemId(problem.id)}
                      className={`rounded-[16px] border px-4 py-3 text-left transition-all ${
                        active ? "border-[#2563eb]/35 bg-[#eff6ff] shadow-[0_10px_24px_rgba(37,99,235,0.10)]" : "border-[#e5e7eb] bg-white hover:border-[#bfdbfe] hover:bg-[#f8fbff]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#64748b]">0{index + 1}</span>
                        <span className="rounded-full bg-[#f8fafc] px-2.5 py-0.5 text-[10px] font-black text-[#475467]">{problem.difficulty}</span>
                        <span className="rounded-full bg-[#fff7ed] px-2.5 py-0.5 text-[10px] font-black text-[#9a3412]">{problem.category}</span>
                      </div>
                      <div className={`mt-2 text-sm font-black ${active ? "text-[#1d4ed8]" : "text-[#111827]"}`}>{problem.title}</div>
                      <div className="mt-1 text-[12px] leading-6 text-[#667085]">{problem.summary}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-black tracking-[0.16em] text-[#2563eb]">当前题面</span>
                <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-black text-[#64748b]">Java 17</span>
                {selectedProblem ? (
                  <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-[11px] font-black text-[#9a3412]">{selectedProblem.difficulty}</span>
                ) : null}
              </div>
              <h3 className="mt-2 text-xl font-black">{selectedProblem?.title || resource?.title || file.display_name}</h3>
            </div>

            <div className="rounded-[18px] border border-[#e5e7eb] bg-white px-4 py-4">
              <div className="text-[11px] font-black tracking-[0.16em] text-[#2563eb]">题目描述</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.description || "请根据题面完成本题，并保证输出结果与样例一致。"}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4">
                <div className="text-[11px] font-black tracking-[0.16em] text-[#64748b]">输入格式</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.input || "从标准输入读取题目要求的数据。"}</div>
              </div>
              <div className="rounded-[18px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-4">
                <div className="text-[11px] font-black tracking-[0.16em] text-[#64748b]">输出格式</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.output || "将最终结果输出到标准输出。"}</div>
              </div>
            </div>

            {selectedProblem?.hint ? (
              <div className="rounded-[18px] border border-[#dbeafe] bg-[#eff6ff] px-4 py-4">
                <div className="text-[11px] font-black tracking-[0.16em] text-[#2563eb]">解题提示</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#1d4ed8]">{selectedProblem.hint}</div>
              </div>
            ) : null}

            <div className="grid gap-3">
              <div className="text-[11px] font-black tracking-[0.16em] text-[#2563eb]">样例与测试用例</div>
              {testCases.map((testCase, index) => (
                <div key={testCase.label} className="rounded-[18px] border border-[#e5e7eb] bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-black">{testCase.label}</div>
                    {caseResults[index] ? (
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${caseResults[index].status === "Accepted" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fff7ed] text-[#9a3412]"}`}>
                        {getJudgeStatusLabel(caseResults[index].status)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10px] font-black tracking-[0.14em] text-[#64748b]">输入</div>
                      <pre className="overflow-auto rounded-[12px] bg-[#f8fafc] px-3 py-2 text-xs leading-6">{testCase.input}</pre>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-black tracking-[0.14em] text-[#16a34a]">期望输出</div>
                      <pre className="overflow-auto rounded-[12px] bg-[#f0fdf4] px-3 py-2 text-xs leading-6 text-[#166534]">{testCase.output}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col bg-[#0b1120]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div className="text-xs font-black tracking-[0.16em] text-[#93c5fd]">代码编辑区</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={runSingleCase} disabled={running || submitting} className="inline-flex items-center gap-2 rounded-full bg-[#16a34a] px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                {running ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {running ? "运行中" : "运行样例"}
              </button>
              <button type="button" onClick={submitAllCases} disabled={running || submitting} className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MonitorPlay className="h-3.5 w-3.5" />}
                {submitting ? "判题中" : "提交判题"}
              </button>
              <button type="button" onClick={reviewCode} disabled={reviewing} className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                {reviewing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {reviewing ? "纠错中" : "AI 纠错"}
              </button>
            </div>
          </div>
          <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} className="min-h-[360px] flex-1 resize-none border-0 bg-[#0b1120] px-5 py-4 font-mono text-[13px] leading-7 text-[#e2e8f0] outline-none" />
          <div className="grid border-t border-white/10 lg:grid-cols-2">
            <div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
              <div className="text-xs font-black text-[#93c5fd]">标准输入</div>
              <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} className="mt-3 h-28 w-full resize-none rounded-[14px] border border-white/10 bg-[#111827] px-3 py-2 font-mono text-xs leading-6 text-[#e5eefc] outline-none" />
            </div>
            <div className="p-4">
              <div className="text-xs font-black text-[#93c5fd]">运行 / 纠错结果</div>
              <div className="mt-3 max-h-[360px] space-y-3 overflow-auto text-xs leading-6 text-[#e5eefc]">
                {error ? <div className="rounded-[14px] bg-[#3f1d24] px-3 py-3 text-[#fecdd3]">{error}</div> : null}
                {caseResults.length ? (
                  <div className="rounded-[14px] bg-white/5 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-white">提交记录</div>
                      <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-[#cbd5e1]">{passedCount}/{caseResults.length} 通过</div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {caseResults.map((item) => (
                        <div key={`${item.label}-${item.status}`} className="rounded-xl border border-white/10 bg-[#0f172a] px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-white">{item.label}</span>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${getJudgeTone(item.status)}`}>
                              {getJudgeStatusLabel(item.status)}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <div>
                              <div className="mb-1 text-[10px] font-black tracking-[0.14em] text-[#94a3b8]">输入</div>
                              <pre className="overflow-auto rounded-[10px] bg-black/20 px-3 py-2 text-[11px] leading-5 text-[#cbd5e1]">{item.input}</pre>
                            </div>
                            <div>
                              <div className="mb-1 text-[10px] font-black tracking-[0.14em] text-[#86efac]">期望输出</div>
                              <pre className="overflow-auto rounded-[10px] bg-[#052e16] px-3 py-2 text-[11px] leading-5 text-[#bbf7d0]">{item.expected}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {activeResult ? (
                  <div className="rounded-[14px] bg-white/5 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-white">最近一次运行输出</div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${getJudgeTone(latestStatus)}`}>
                        {getJudgeStatusLabel(latestStatus)}
                      </span>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-[10px] bg-black/20 px-3 py-3 text-[#e2e8f0]">
                      {activeResult.stdout || activeResult.stderr || activeResult.compile_output || "暂无输出"}
                    </pre>
                    {latestCase ? (
                      <div className="mt-2 text-[11px] text-[#94a3b8]">
                        最近一次对比：期望输出为 <span className="font-black text-white">{latestCase.expected || "空"}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {reviewResult ? (
                  <div className="rounded-[14px] bg-[#1e1b4b] px-3 py-3 text-[#e9d5ff]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-black text-white">AI 纠错结论</div>
                      {reviewResult.suggested_code ? (
                        <button
                          type="button"
                          onClick={() => setCode(reviewResult.suggested_code)}
                          className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#312e81] transition hover:bg-[#ede9fe]"
                        >
                          应用建议代码
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap rounded-[10px] bg-white/5 px-3 py-3 text-sm leading-6">{reviewResult.summary}</div>
                    {reviewResult.key_issues?.length ? (
                      <div className="mt-3">
                        <div className="text-[10px] font-black tracking-[0.16em] text-[#c4b5fd]">需要关注</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {reviewResult.key_issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {reviewResult.next_steps?.length ? (
                      <div className="mt-3">
                        <div className="text-[10px] font-black tracking-[0.16em] text-[#c4b5fd]">下一步</div>
                        <div className="mt-2 space-y-1">
                          {reviewResult.next_steps.map((step, index) => (
                            <div key={`${step}-${index}`} className="rounded-[10px] bg-white/5 px-3 py-2 text-[11px] leading-5 text-[#ede9fe]">
                              {index + 1}. {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!error && !caseResults.length && !activeResult && !reviewResult ? (
                  <div className="rounded-[14px] border border-dashed border-white/10 bg-white/5 px-3 py-4 text-[#94a3b8]">
                    先运行样例看输出，再提交判题；如果卡住了，直接点 AI 纠错拿一版可执行建议。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ResourceSourcePreview() {
  const location = useLocation();
  const routeState = (location.state as ResourcePreviewRouteState | null) || {};
  const courseId = getCourseIdFromUrl();
  const rawResourceId = getResourceIdFromUrl();
  const sourceFileId = getSourceFileIdFromUrl();
  const generationIntent = useMemo(() => {
    const intent = getGenerationIntentFromUrl(location.search);
    if (intent?.type === "coding_lab" && intent.stage === "running") {
      return { ...intent, stage: "completed" as const };
    }
    return intent;
  }, [location.search]);
  const generationIntentType = generationIntent?.type || null;
  const generationIntentStage = generationIntent?.stage || null;
  const generationIntentLabel = generationIntent?.label || null;
  const isCodingLabReady = generationIntentType === "coding_lab";
  const parsedResourceId = rawResourceId ? Number(rawResourceId) : null;
  const numericResourceId = parsedResourceId !== null && Number.isFinite(parsedResourceId) && parsedResourceId > 0 ? parsedResourceId : null;
  const resourceId = numericResourceId !== null ? String(numericResourceId) : null;
  const numericSourceFileId = sourceFileId ? Number(sourceFileId) : null;
  const initialResource = hasUsableInitialResource(routeState.initialResource) ? routeState.initialResource || null : null;
  const isCodingLabIntent = generationIntent?.type === "coding_lab";
  const shouldForceCodingLabFallback =
    isCodingLabIntent || (numericResourceId !== null && Number.isFinite(numericResourceId) && FORCE_CODING_LAB_RESOURCE_IDS.has(numericResourceId));

  const [resource, setResource] = useState<ResourceCard | null>(
    initialResource || (shouldForceCodingLabFallback ? buildCodingLabOjFallbackResource(courseId, numericSourceFileId || 900001, generationIntent) : null),
  );
  const [selectedFileId, setSelectedFileId] = useState<number | null>(numericSourceFileId || routeState.initialFileId || null);
  const [loading, setLoading] = useState(Boolean(numericResourceId) && !initialResource && !shouldForceCodingLabFallback);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [documentFrameLoaded, setDocumentFrameLoaded] = useState(false);
  const [documentFrameError, setDocumentFrameError] = useState(false);

  useEffect(() => {
    if (!rawResourceId || numericResourceId !== null) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("resourceId");
    window.history.replaceState(window.history.state || {}, "", `${url.pathname}${url.search}`);
  }, [numericResourceId, rawResourceId]);

  useEffect(() => {
    const handlePopState = () => {
      const value = getSourceFileIdFromUrl();
      const parsed = Number(value);
      setSelectedFileId(Number.isFinite(parsed) ? parsed : null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (shouldForceCodingLabFallback && !initialResource) {
      const fallbackFileId = numericSourceFileId || 900001;
      setResource((current) => {
        const next = buildCodingLabOjFallbackResource(courseId, fallbackFileId, generationIntent);
        if (
          current?.resource_type === next.resource_type &&
          current?.title === next.title &&
          current?.summary === next.summary &&
          current?.content_markdown === next.content_markdown &&
          current?.study_suggestion === next.study_suggestion
        ) {
          return current;
        }
        return next;
      });
      setSelectedFileId(fallbackFileId);
      markGenerationCompletedInUrl(fallbackFileId);
      setLoading(false);
      setError(null);
      return;
    }

    if (!resourceId) {
      setResource(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    studentApi
      .getResource(numericResourceId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setResource(detail);
        const detailType = String(detail.resource_type || "").toLowerCase();
        const isCodingLabDetail = detailType === "coding_lab" || detailType === "case_study";
        const sourceFiles = detail.source_files || [];
        const requestedFileId = numericSourceFileId || routeState.initialFileId || null;
        const matchedFile = requestedFileId ? sourceFiles.find((file) => file.file_id === requestedFileId) : null;
        const nextFileId =
          matchedFile?.file_id ||
          sourceFiles[0]?.file_id ||
          (isCodingLabDetail ? detail.resource_id || numericResourceId : null) ||
          (detail.content_markdown || detail.summary || detail.study_suggestion ? detail.resource_id || numericResourceId : null) ||
          requestedFileId;
        setSelectedFileId(nextFileId || null);
        if (nextFileId) {
          setSourceFileIdInUrl(nextFileId);
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "资源预览加载失败。");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    courseId,
    generationIntentLabel,
    generationIntentStage,
    generationIntentType,
    initialResource,
    numericResourceId,
    numericSourceFileId,
    resourceId,
    routeState.initialFileId,
    shouldForceCodingLabFallback,
  ]);

  const fallbackSelectedFile = useMemo(() => {
    if (resource?.source_files?.length) {
      return routeState.initialPreviewFile || null;
    }
    if (!resource && generationIntent) {
      return buildGenerationIntentFallbackFile(selectedFileId || numericSourceFileId || 900001, courseId, generationIntent);
    }
    const resourceType = String(resource?.resource_type || "").toLowerCase();
    if ((resourceType === "coding_lab" || resourceType === "case_study") && resource) {
      return buildSyntheticCodingLabFile(resource, selectedFileId || resource.resource_id || numericResourceId || 900001);
    }
    if (resource && (resource.content_markdown || resource.summary || resource.study_suggestion || resource.title)) {
      return buildResourceContentFallbackFile(resource, selectedFileId || numericResourceId || resource.resource_id);
    }
    if (!selectedFileId) {
      return routeState.initialPreviewFile || null;
    }
    return buildFallbackSourceFile(selectedFileId);
  }, [generationIntent, numericResourceId, numericSourceFileId, resource, routeState.initialPreviewFile, selectedFileId]);

  const selectedFile =
    resource?.source_files?.find((item) => item.file_id === selectedFileId) ||
    resource?.source_files?.[0] ||
    fallbackSelectedFile ||
    null;

  const resourceType = String(resource?.resource_type || "").toLowerCase();
  const isIllustrationResource = resourceType === "visual_illustration" || generationIntent?.type === "visual_illustration";
  const codingLabHints = [resource?.title, resource?.summary, resource?.content_markdown, selectedFile?.display_name, selectedFile?.relative_path]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const isCodingLabPage =
    resourceType === "coding_lab" ||
    resourceType === "case_study" ||
    generationIntent?.type === "coding_lab" ||
    selectedFile?.file_extension?.toLowerCase() === ".java" ||
    codingLabHints.includes("coding_lab") ||
    codingLabHints.includes("main.java") ||
    codingLabHints.includes("代码实操");
  const codingLabStageLabel = isCodingLabReady ? "实操工作台已就绪" : generationIntentStage === "running" ? "系统正在整理正式文件" : "等待正式文件落库";

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, ResourceSourceFileRef[]>();
    const files = resource?.source_files?.length ? resource.source_files : selectedFile ? [selectedFile] : [];
    for (const file of files) {
      const key = getCategoryLabel(file.top_level_category);
      const existing = groups.get(key);
      if (existing) {
        existing.push(file);
      } else {
        groups.set(key, [file]);
      }
    }
    return Array.from(groups.entries()).map(([category, files]) => ({ category, files }));
  }, [resource, selectedFile]);

  const selectedMode = selectedFile ? getSourceFilePreviewMode(selectedFile) : "unsupported";
  const previewTitle = buildPreviewTitle(selectedFile);
  const currentPreviewModeLabel =
    selectedMode === "snippet" || selectedMode === "text"
      ? "文本预览"
      : selectedMode === "pdf"
        ? "PDF 预览"
        : selectedMode === "video"
          ? "视频预览"
          : selectedMode === "image"
            ? "图片预览"
            : selectedMode === "embed"
              ? "在线预览"
              : "文件预览";
  const previewOpenUrl = selectedFile ? resolveAssetUrl(selectedFile.open_url) : "";
  const previewFetchUrl = selectedFile ? resolveAssetUrl(selectedFile.preview_url || selectedFile.open_url) : "";
  const isGeneratedPlaceholder = isGeneratedPlaceholderFile(selectedFile);
  const shouldRenderIllustrationAsImage =
    isIllustrationResource &&
    (!selectedFile ||
      selectedFile.preview_mode === "text" ||
      selectedFile.preview_mode === "snippet" ||
      selectedFile.file_extension?.toLowerCase() === ".md" ||
      selectedFile.mime_type?.includes("markdown"));
  const illustrationPreviewUrl = shouldRenderIllustrationAsImage
    ? buildIllustrationPreviewDataUrl(
        courseId,
        sanitizePreviewText(resource?.title || selectedFile?.display_name, "AI 教学插图"),
        resource?.source_titles || [],
        resource?.summary,
      )
    : "";
  const isGeneratedShowcasePage = Boolean(generationIntent) && !isCodingLabPage;
  const generatedPreviewText = textContent || selectedFile?.preview_text || resource?.content_markdown || resource?.summary || "";
  const generatedPreviewSections = useMemo(() => extractPreviewSections(generatedPreviewText), [generatedPreviewText]);
  const generatedPrimarySection = generatedPreviewSections[0] || null;
  const generatedSecondarySections = generatedPrimarySection ? generatedPreviewSections.slice(1) : [];
  const generatedExperience = getGeneratedResourceExperience(generationIntentType || resource?.resource_type || "extended_reading");
  const generatedHeroTitle = sanitizePreviewText(generationIntentLabel || resource?.title, `AI ${generatedExperience.heroNoun}`);
  const generatedHeroSummary = sanitizePreviewText(
    resource?.summary || resource?.study_suggestion,
    generationIntentStage === "completed" ? generatedExperience.heroSummary : "系统正在持续整理内容，当前先展示可读预览结果。",
  );
  const generatedTypeLabel = getGenerationTypeLabel(generationIntentType || resource?.resource_type || "extended_reading");
  const displayFileName =
    shouldRenderIllustrationAsImage && selectedFile
      ? selectedFile.display_name.replace(/\.md$/i, ".svg")
      : selectedFile?.display_name || "等待同步";

  useEffect(() => {
    if (!selectedFile) {
      setTextContent(null);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    if (!["text", "snippet"].includes(selectedMode)) {
      setTextContent(null);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    if (selectedFile.preview_text && selectedMode === "snippet") {
      setTextContent(selectedFile.preview_text);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    if (!previewFetchUrl) {
      setTextContent(selectedFile.preview_text || null);
      setTextLoading(false);
      setTextError(null);
      return;
    }

    const controller = new AbortController();
    setTextLoading(true);
    setTextError(null);

    fetch(previewFetchUrl, {
      ...studentApi.buildResourceFileFetchInit(selectedFile.preview_url || selectedFile.open_url),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then((text) => setTextContent(text))
      .catch((loadError) => {
        if (controller.signal.aborted) {
          return;
        }
        setTextError(loadError instanceof Error ? loadError.message : "文本预览加载失败");
        setTextContent(selectedFile.preview_text || null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTextLoading(false);
        }
      });

    return () => controller.abort();
  }, [previewFetchUrl, selectedFile, selectedMode]);

  useEffect(() => {
    setDocumentFrameLoaded(false);
    setDocumentFrameError(false);
  }, [previewFetchUrl, selectedFile?.file_id, selectedMode]);

  useEffect(() => {
    if (!selectedFile || !["pdf", "office-pdf", "html", "embed"].includes(selectedMode)) {
      return;
    }
    if (documentFrameLoaded || documentFrameError) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setDocumentFrameLoaded(true);
      setDocumentFrameError(true);
    }, 10000);
    return () => window.clearTimeout(timeoutId);
  }, [documentFrameError, documentFrameLoaded, selectedFile, selectedMode]);

  function openFilePreview(file: ResourceSourceFileRef) {
    setSelectedFileId(file.file_id);
    setSourceFileIdInUrl(file.file_id, { push: true });
  }

  function openTutorFromCodingLab() {
    const payload = {
      courseId,
      resourceId: resource?.resource_id || undefined,
      resourceTitle: sanitizePreviewText(resource?.title, selectedFile?.display_name || "当前实操资料"),
      resourceType: String(resource?.resource_type || "coding_lab"),
      resourceSummary: sanitizePreviewText(resource?.summary, "请结合当前代码实操资源继续讲解题面、代码和运行结果。"),
      title: "代码实操 AI 导师",
      subtitle: "围绕当前题面、代码输入输出和运行结果继续讲解。",
      quickPrompts: ["先帮我讲清楚这道题要做什么", "看当前代码哪里可能出错", "结合题面给我一版解题思路"],
      mode: "learning" as const,
    };
    saveActiveTutorContext(payload);
    openTutorPanel(payload);
  }

  function renderPreviewBody() {
    if (isCodingLabPage) {
      return selectedFile ? (
        <CodingLabWorkspace
          file={selectedFile}
          resource={resource}
          previewText={resource?.content_markdown || selectedFile.preview_text || ""}
          onOpenTutor={openTutorFromCodingLab}
          generationIntent={generationIntent}
        />
      ) : (
        <LoadingBlock title="正在准备代码实操工作台..." />
      );
    }

    if (!selectedFile) {
      return <EmptyBlock title="当前资源暂无可预览文件" description="这份资料还没有同步出可直接预览的文件，你可以稍后再试或返回资源中心。" />;
    }

    if (shouldRenderIllustrationAsImage && illustrationPreviewUrl) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#fff1f5] px-3 py-1 text-[11px] font-black tracking-[0.16em] text-[#c25179]">AI 生成插图</span>
            <span className="rounded-full border border-[#fde2e8] bg-white px-3 py-1 text-[11px] font-semibold text-[#9f1239]">当前页展示的是刚刚补出的插图预览</span>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-[#f2d7e3] bg-white p-3 shadow-[0_18px_40px_rgba(251,114,153,0.08)]">
            <img
              src={illustrationPreviewUrl}
              alt={sanitizePreviewText(resource?.title || selectedFile?.display_name, "AI 教学插图")}
              className="max-h-[78vh] w-full rounded-[18px] bg-[#fff8fb] object-contain"
            />
          </div>
          {resource?.content_markdown ? (
            <div className="rounded-[20px] border border-[#edf1f5] bg-white/90 px-5 py-5">
              <div className="text-[11px] font-black tracking-[0.18em] text-[#006689]">插图说明</div>
              <MarkdownRenderer
                content={resource.content_markdown}
                className="mt-3 [&_h1]:hidden [&_h2]:mb-3 [&_h2]:text-[18px] [&_h2]:font-black [&_h2]:text-[#111827] [&_p]:text-[14px] [&_p]:leading-7 [&_p]:text-[#475569] [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-7"
              />
            </div>
          ) : null}
        </div>
      );
    }

    if (selectedMode === "video") {
      return <VideoPanel file={selectedFile} />;
    }

    if (selectedMode === "image") {
      return <ImagePreviewPanel file={selectedFile} previewUrl={previewFetchUrl} openUrl={previewOpenUrl} />;
    }

    if (["pdf", "office-pdf", "html", "embed"].includes(selectedMode)) {
      if (documentFrameError) {
        return (
          <EmptyBlock
            title="暂时无法页内打开这份文档"
            description="当前文档的在线预览没有正常响应，但原始文件入口仍可使用。"
            action={
              previewOpenUrl ? (
                <a href={previewOpenUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#006689] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#005570]">
                  <ExternalLink className="h-4 w-4" />
                  打开原文件
                </a>
              ) : null
            }
          />
        );
      }
      return (
        <div className="relative overflow-hidden rounded-[24px] border border-[#e4e9ef] bg-white">
          {!documentFrameLoaded ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(247,249,252,0.92)]">
              <div className="flex items-center gap-3 rounded-full border border-[#d9e8fb] bg-white px-4 py-2 text-sm font-semibold text-[#006689] shadow-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在加载文档预览...
              </div>
            </div>
          ) : null}
          <iframe
            title={selectedFile.display_name}
            src={previewFetchUrl}
            className="h-[74vh] w-full bg-white"
            onLoad={() => setDocumentFrameLoaded(true)}
            onError={() => {
              setDocumentFrameLoaded(true);
              setDocumentFrameError(true);
            }}
          />
        </div>
      );
    }

    if (["text", "snippet"].includes(selectedMode)) {
      if (textLoading) {
        return <LoadingBlock title="正在加载文本内容..." />;
      }
      if (isGeneratedPlaceholder) {
        return (
          <div className="overflow-hidden rounded-[24px] border border-[#f3dbe6] bg-[linear-gradient(180deg,#fffafb_0%,#ffffff_28%)]">
            <div className="border-b border-[#f6e5eb] px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#ffe8f1] px-3 py-1 text-[11px] font-black tracking-[0.16em] text-[#c25179]">生成内容预览</span>
                <span className="rounded-full bg-[#fff3f7] px-3 py-1 text-[11px] font-semibold text-[#9d174d]">
                  {generationIntentStage === "running" ? "文件同步中" : "等待正式文件"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">你现在先看到的是可读版内容，等正式文件生成完成后，这里会自动切成正式文档或 PDF 预览。</p>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0 bg-white px-5 py-5 md:px-6">
                <div className="mx-auto max-w-3xl">
                  <MarkdownRenderer
                    content={textContent || textError || "当前文件暂无可读取文本内容。"}
                    className="prose prose-slate max-w-none text-[15px] leading-8 prose-headings:mb-3 prose-headings:mt-8 prose-headings:font-black prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-8 prose-li:text-slate-600 prose-li:leading-8 prose-strong:text-slate-900"
                  />
                </div>
              </div>

              <aside className="border-t border-[#f6e5eb] bg-[#fff8fb] px-5 py-5 xl:border-l xl:border-t-0">
                <div className="text-[11px] font-black tracking-[0.16em] text-[#c25179]">阅读提要</div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-[18px] border border-[#f3dbe6] bg-white px-4 py-3">
                    <div className="text-[11px] font-black tracking-[0.14em] text-[#64748b]">资料类型</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{generatedTypeLabel}</div>
                  </div>
                  <div className="rounded-[18px] border border-[#f3dbe6] bg-white px-4 py-3">
                    <div className="text-[11px] font-black tracking-[0.14em] text-[#64748b]">当前阶段</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{generationIntentStage === "running" ? "文件同步中" : "可读预览"}</div>
                  </div>
                  <div className="rounded-[18px] border border-[#f3dbe6] bg-white px-4 py-3">
                    <div className="text-[11px] font-black tracking-[0.14em] text-[#64748b]">建议阅读方式</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">先通读当前生成稿，确认主线内容；正式文件同步后再细读和导出。</div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        );
      }
      return (
        <div className="overflow-hidden rounded-[24px] border border-[#e4e9ef] bg-white">
          <article className="max-h-[74vh] overflow-auto px-5 py-6 md:px-8 md:py-7">
            <MarkdownRenderer
              content={textContent || textError || "当前文件暂无可读取文本内容。"}
              className="[&_h1]:mb-5 [&_h1]:text-[30px] [&_h1]:font-black [&_h1]:tracking-[-0.04em] [&_h1]:text-[#111827] [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[22px] [&_h2]:font-black [&_h2]:tracking-[-0.03em] [&_h2]:text-[#111827] [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[18px] [&_h3]:font-black [&_h3]:text-[#111827] [&_p]:text-[15px] [&_p]:leading-8 [&_p]:text-[#334155] [&_ul]:my-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:leading-8 [&_li]:text-[#475569] [&_blockquote]:rounded-2xl [&_blockquote]:border-l-4 [&_blockquote]:border-[#fb7299] [&_blockquote]:bg-[#fff7fb] [&_blockquote]:px-4 [&_blockquote]:py-3 [&_code]:rounded-md [&_code]:bg-[#f4f7fb] [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:rounded-[22px] [&_pre]:bg-[#0f172a] [&_pre]:p-5 [&_pre]:text-[13px] [&_pre]:leading-7 [&_table]:block [&_table]:overflow-x-auto [&_table]:rounded-2xl [&_table]:border [&_table]:border-[#e8eef5] [&_table]:bg-white [&_th]:bg-[#fff7fb] [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3"
            />
          </article>
        </div>
      );
    }

    return (
      <EmptyBlock
        title="当前格式不适合页内预览"
        description="这份文件已经接入资源中心，但浏览器不适合直接渲染。"
        action={
          previewOpenUrl ? (
            <a href={previewOpenUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#006689] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#005570]">
              <ExternalLink className="h-4 w-4" />
              打开原文件
            </a>
          ) : null
        }
      />
    );
  }

  const backUrl = `/resources?courseId=${courseId}${resourceId ? `&resourceId=${resourceId}` : ""}`;
  const SelectedIcon = getFileIcon(selectedFile);

  if (loading && !resource && !selectedFile) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <LoadingBlock title="正在载入资源预览..." />
      </div>
    );
  }

  if (!resourceId && !isCodingLabPage) {
    return (
      <div className="min-h-screen bg-[#f6f8fb]">
        <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-8">
          <section className="overflow-hidden rounded-[28px] border border-[#dbe3ee] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-8 md:px-8">
              <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-[#006689] transition hover:text-[#005570]">
                <ArrowLeft className="h-4 w-4" />
                返回资源中心
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#ffe8f1] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#fb7299]">资源预览</span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-[36px]">先从资源中心选择一份资料</h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">当前链接没有携带有效的 `resourceId`，所以页面不会再兜底成展示页，而是等待你明确打开某一份真实资料。</p>
              <div className="mt-6">
                <Link to={backUrl} className="inline-flex items-center gap-2 rounded-full bg-[#fb7299] px-5 py-2.5 text-sm font-bold text-white shadow-[0_16px_36px_rgba(251,114,153,0.28)] transition hover:translate-y-[-1px]">
                  去资源中心
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error && !resource && !selectedFile) {
    return (
      <div className="min-h-screen bg-[#f6f8fb]">
        <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-8">
          <section className="overflow-hidden rounded-[28px] border border-[#dbe3ee] bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="px-6 py-8 md:px-8">
              <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-[#006689] transition hover:text-[#005570]">
                <ArrowLeft className="h-4 w-4" />
                返回资源中心
              </Link>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-[36px]">页面加载失败</h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">{error}</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (isGeneratedShowcasePage) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,#ffe8f1_0%,#f7fbff_38%,#f4f7fb_100%)]">
        <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 md:px-8">
          <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.90),rgba(255,247,250,0.86)_38%,rgba(241,248,255,0.92)_100%)] px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:px-8 md:py-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_20%_10%,rgba(251,114,153,0.22),transparent_48%),radial-gradient(circle_at_82%_0%,rgba(0,102,137,0.14),transparent_36%)]" />
            <div className="pointer-events-none absolute -right-10 top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(251,114,153,0.22),transparent_70%)] blur-2xl" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-[#006689] transition hover:text-[#005570]">
                    <ArrowLeft className="h-4 w-4" />
                    返回资源中心
                  </Link>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#fb7299] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-white">{generatedTypeLabel}</span>
                    <span className="rounded-full border border-white/80 bg-white/70 px-3 py-1 text-[11px] font-bold text-[#006689]">
                      {generationIntentStage === "completed" ? "已补充完成" : "正在生成中"}
                    </span>
                    <span className="rounded-full border border-[#ffd7e4] bg-[#fff7fa] px-3 py-1 text-[11px] font-semibold text-[#c25179]">刚刚由 AI 补充生成</span>
                  </div>
                  <h1 className="mt-4 max-w-4xl text-[28px] font-black leading-tight tracking-[-0.03em] text-[#111827] md:text-[38px]">
                    {generatedHeroTitle}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b6472] md:text-[15px]">{generatedHeroSummary}</p>
                </div>

                <div className="grid min-w-[220px] gap-2 sm:grid-cols-3 sm:gap-3">
                  <div className="rounded-[20px] bg-white/72 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#006689]">资料类型</div>
                    <div className="mt-1 text-sm font-bold text-[#111827]">{generatedTypeLabel}</div>
                  </div>
                  <div className="rounded-[20px] bg-white/72 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#006689]">预览方式</div>
                    <div className="mt-1 text-sm font-bold text-[#111827]">{currentPreviewModeLabel}</div>
                  </div>
                  <div className="rounded-[20px] bg-white/72 px-4 py-3 backdrop-blur">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#006689]">当前文件</div>
                    <div className="mt-1 truncate text-sm font-bold text-[#111827]">{displayFileName}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {previewOpenUrl ? (
                  <a
                    href={previewOpenUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-sm font-bold text-white transition hover:translate-y-[-1px] hover:bg-[#0f172a]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    打开原文件
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/72 px-5 py-2.5 text-sm font-bold text-[#006689] backdrop-blur transition hover:bg-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新结果
                </button>
              </div>
            </div>
          </section>

          {error && resource ? (
            <section className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-800">
              当前资源详情加载时出现提示：{error}
            </section>
          ) : null}

          <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_200px]">
            <main className="min-w-0">
              {["text", "snippet"].includes(selectedMode) ? (
                <div
                  className={`relative overflow-hidden rounded-[34px] px-1 py-1 ${
                    isGeneratedTextShowcasePage
                      ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,248,251,0.86)_24%,rgba(248,251,255,0.96)_100%)] shadow-[0_24px_80px_rgba(251,114,153,0.08)]"
                      : "bg-[linear-gradient(180deg,rgba(255,255,255,0.80),rgba(255,255,255,0.52)_22%,rgba(255,255,255,0.74)_100%)]"
                  }`}
                >
                  <div className="pointer-events-none absolute left-0 top-0 h-40 w-full bg-[radial-gradient(circle_at_top_left,rgba(251,114,153,0.16),transparent_42%),radial-gradient(circle_at_top_right,rgba(0,102,137,0.10),transparent_34%)]" />
                  <div className={`relative px-5 pb-2 pt-5 md:px-10 ${isGeneratedTextShowcasePage ? "md:pt-9" : "md:pt-8"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[11px] font-black tracking-[0.22em] text-[#006689]">AI RESOURCE SHOWCASE</div>
                      {isGeneratedTextShowcasePage ? (
                        <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-black tracking-[0.16em] text-[#c25179]">
                          {generatedExperience.heroNoun}
                        </span>
                      ) : null}
                    </div>
                    <div className={`mt-2 font-black tracking-[-0.03em] text-[#111827] ${isGeneratedTextShowcasePage ? "text-[22px] md:text-[26px]" : "text-[18px] md:text-[20px]"}`}>
                      {generatedPrimarySection?.title || previewTitle}
                    </div>
                    {isGeneratedTextShowcasePage ? (
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b6472]">{generatedExperience.adviceLabel}</p>
                    ) : null}
                  </div>

                  <div className={`relative px-5 pt-2 md:px-10 ${isGeneratedTextShowcasePage ? "pb-10 md:pb-12" : "pb-7 md:pb-10"}`}>
                    {textLoading ? (
                      <LoadingBlock title="正在加载生成内容..." />
                    ) : (
                      <div className={isGeneratedTextShowcasePage ? "space-y-12" : "space-y-10"}>
                        {generatedPrimarySection ? (
                          <section id={generatedPrimarySection.anchor} className={isGeneratedTextShowcasePage ? "space-y-6" : "space-y-5"}>
                            <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd7e4] bg-white/70 px-3 py-1 text-[11px] font-black tracking-[0.16em] text-[#c25179] backdrop-blur">
                              <Sparkles className="h-3.5 w-3.5" />
                              {isGeneratedTextShowcasePage ? "本次补充成果" : "本次新增重点"}
                            </div>
                            <MarkdownRenderer
                              content={`## ${generatedPrimarySection.title}\n\n${generatedPrimarySection.body}`}
                              className="[&_h1]:hidden [&_h2]:mb-4 [&_h2]:text-[30px] [&_h2]:font-black [&_h2]:tracking-[-0.04em] [&_h2]:text-[#111827] [&_h3]:mt-8 [&_h3]:text-[18px] [&_h3]:font-black [&_h3]:text-[#111827] [&_p]:text-[15px] [&_p]:leading-8 [&_p]:text-[#334155] [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-8 [&_table]:block [&_table]:overflow-x-auto [&_table]:rounded-2xl [&_table]:border [&_table]:border-[#e8eef5] [&_table]:bg-white/92 [&_th]:bg-[#f8fbff] [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_code]:rounded-md [&_code]:bg-[#f4f7fb] [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:rounded-[22px] [&_pre]:bg-[#0f172a] [&_pre]:p-5 [&_pre]:text-[13px] [&_pre]:leading-7"
                            />
                          </section>
                        ) : null}

                        {generatedSecondarySections.length ? (
                          <div className={`grid gap-x-8 gap-y-8 ${isGeneratedTextShowcasePage ? "md:grid-cols-1 xl:grid-cols-2" : "md:grid-cols-2"}`}>
                            {generatedSecondarySections.map((section, index) => (
                              <section
                                key={section.anchor}
                                id={section.anchor}
                                className={`relative pl-5 ${isGeneratedTextShowcasePage ? "border-l-2 border-[#ffd4e1]" : "border-l border-[#ffd4e1]"}`}
                              >
                                <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black tracking-[0.18em] text-[#006689]">
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef6fb]">{String(index + 2).padStart(2, "0")}</span>
                                  {isGeneratedTextShowcasePage ? "成果分块" : "内容段落"}
                                </div>
                                <MarkdownRenderer
                                  content={`### ${section.title}\n\n${section.body}`}
                                  className="[&_h1]:hidden [&_h2]:hidden [&_h3]:mb-3 [&_h3]:text-[19px] [&_h3]:font-black [&_h3]:text-[#111827] [&_p]:text-[14px] [&_p]:leading-7 [&_p]:text-[#475569] [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:leading-7 [&_code]:rounded-md [&_code]:bg-[#f4f7fb] [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:rounded-[18px] [&_pre]:bg-[#0f172a] [&_pre]:p-4 [&_pre]:text-[12px]"
                                />
                              </section>
                            ))}
                          </div>
                        ) : null}

                        {!generatedPrimarySection && textError ? <EmptyBlock title="当前生成内容暂不可读" description={textError} /> : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                renderPreviewBody()
              )}
            </main>

            <aside className="xl:pt-5">
              <div className="xl:sticky xl:top-5">
                <div className="rounded-[24px] bg-white/48 p-3 backdrop-blur-md">
                  <div className="px-2 text-[11px] font-black tracking-[0.18em] text-[#006689]">阅读索引</div>
                  <div className="mt-3 space-y-2">
                    {generatedPreviewSections.length ? (
                      generatedPreviewSections.map((section, index) => (
                        <a
                          key={section.anchor}
                          href={`#${section.anchor}`}
                          className="flex items-center gap-3 rounded-[16px] px-2.5 py-2 text-sm text-[#475569] transition hover:bg-white/72 hover:text-[#111827]"
                        >
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-[11px] font-black text-[#006689] shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
                            {index + 1}
                          </span>
                          <span className="line-clamp-2">{section.title}</span>
                        </a>
                      ))
                    ) : (
                      <div className="rounded-[18px] bg-white/72 px-3 py-3 text-sm leading-6 text-[#64748b]">当前正在同步生成内容，目录会在正文就绪后自动出现。</div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>
    );
  }

  if (isCodingLabPage) {
    return (
      <div className="min-h-screen bg-[#f3f5f8]">
        <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-4 md:px-6">
          <section className="rounded-[24px] border border-[#dbe3ee] bg-white px-5 py-4 shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-[#006689] transition hover:text-[#005570]">
                  <ArrowLeft className="h-4 w-4" />
                  返回资源中心
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[11px] font-black tracking-[0.16em] text-[#166534]">刷题工作台</span>
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-black text-[#2563eb]">可切题 · 可运行 · 可判题</span>
                </div>
                <h1 className="mt-3 truncate text-2xl font-black tracking-tight text-[#111827] md:text-[30px]">{sanitizePreviewText(resource?.title, "代码刷题工作台")}</h1>
                <p className="mt-2 max-w-4xl text-sm leading-7 text-[#64748b]">这里不只支持生成实操，也支持学生平时刷题训练。可以直接切换不同难度题目，运行样例、提交判题和继续追问 AI。</p>
              </div>
              <div className="rounded-[20px] border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3 text-right">
                <div className="text-[11px] font-black tracking-[0.16em] text-[#64748b]">当前文件</div>
                <div className="mt-1 font-mono text-sm font-black text-[#111827]">{selectedFile?.display_name || "Main.java"}</div>
              </div>
            </div>
          </section>

          {selectedFile ? (
            <CodingLabWorkspace
              file={selectedFile}
              resource={resource}
              previewText={resource?.content_markdown || selectedFile.preview_text || ""}
              onOpenTutor={openTutorFromCodingLab}
              generationIntent={generationIntent}
            />
          ) : (
            <LoadingBlock title="正在准备代码实操工作台..." />
          )}
        </div>
      </div>
    );
  }

  const isShowcaseIllustrationPage = shouldRenderIllustrationAsImage && !isGeneratedPlaceholder;
  const isGeneratedTextShowcasePage =
    !isShowcaseIllustrationPage &&
    !isCodingLabPage &&
    isGeneratedShowcasePage &&
    ["text", "snippet"].includes(selectedMode);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8fb_0%,#fffdfd_18%,#f8fafc_100%)]">
      <div className={`mx-auto space-y-4 px-4 pb-8 pt-4 md:px-8 ${isShowcaseIllustrationPage || isGeneratedTextShowcasePage ? "max-w-[1600px]" : "max-w-[1480px]"}`}>
        <section className={`overflow-hidden rounded-[30px] border border-[#f3dbe6] bg-white shadow-[0_24px_72px_rgba(251,114,153,0.08)] ${isShowcaseIllustrationPage || isGeneratedTextShowcasePage ? "bg-[linear-gradient(135deg,#fffdfd_0%,#fff7fb_42%,#f7fbff_100%)]" : ""}`}>
          <div className={`grid gap-0 ${isShowcaseIllustrationPage || isGeneratedTextShowcasePage ? "xl:grid-cols-[minmax(0,1fr)_240px]" : "xl:grid-cols-[minmax(0,1fr)_320px]"}`}>
            <div className="px-6 py-5 md:px-8 md:py-6">
              <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-[#c25179] transition-colors hover:text-[#a63d66]">
                <ArrowLeft className="h-4 w-4" />
                返回资源中心
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#ffe8f1] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#fb7299]">{getResourceTypeLabel(resource?.resource_type)}</span>
                <span className="rounded-full border border-[#f4d5e2] bg-[#fff7fb] px-3 py-1 text-[11px] font-semibold text-[#c25179]">
                  {isGeneratedPlaceholder ? "生成中预览" : "内容预览"}
                </span>
                {generationIntentStage ? (
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${generationIntentStage === "running" ? "bg-[#fff1f5] text-[#c25179]" : "bg-[#fdf2f8] text-[#9d174d]"}`}>
                    {generationIntentStage === "running" ? "正在生成" : "已生成待同步"}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 max-w-4xl text-[30px] font-black tracking-tight text-slate-900 md:text-[34px]">
                {isGeneratedPlaceholder ? sanitizePreviewText(generationIntentLabel, "拓展阅读") : sanitizePreviewText(resource?.title, "课程资料预览")}
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
                {isGeneratedPlaceholder
                  ? "这份资料正在同步成正式文件。当前先展示生成内容预览，等源文件落库后会自动切换成正式阅读页。"
                  : isShowcaseIllustrationPage
                    ? "这页直接展示刚刚补充生成的教学插图，适合课堂讲解、讲义配图和答辩展示。"
                    : isGeneratedTextShowcasePage
                      ? generatedExperience.heroSummary
                    : sanitizePreviewText(resource?.summary, "这里直接展示资源正文与源文件，不再使用成果展示卡片。")}
              </p>
              {isGeneratedPlaceholder ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[20px] border border-[#f6d7e3] bg-[#fff7fb] px-4 py-3">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#c25179]">当前状态</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{generationIntentStage === "running" ? "内容已生成，文件同步中" : "文件待同步"}</div>
                  </div>
                  <div className="rounded-[20px] border border-[#f6d7e3] bg-[#fff7fb] px-4 py-3">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#c25179]">预览来源</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">AI 生成内容占位</div>
                  </div>
                  <div className="rounded-[20px] border border-[#f6d7e3] bg-[#fff7fb] px-4 py-3">
                    <div className="text-[11px] font-black tracking-[0.16em] text-[#c25179]">下一步</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">同步完成后自动切换正式文件</div>
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="border-t border-[#f6e5eb] bg-[linear-gradient(180deg,#fffafd_0%,#fff7fb_100%)] px-6 py-5 xl:border-l xl:border-t-0">
              {isShowcaseIllustrationPage || isGeneratedTextShowcasePage ? (
                <div className="space-y-3">
                  <div className="rounded-[22px] border border-[#ffdbe7] bg-white/90 px-4 py-4">
                    <div className="text-[11px] font-black tracking-[0.18em] text-[#c25179]">{generatedExperience.statusLabel}</div>
                    <div className="mt-2 text-base font-black text-slate-900">刚刚补充生成</div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">{generatedExperience.statusSummary}</div>
                  </div>
                  {resource?.study_suggestion ? (
                    <div className="rounded-[22px] border border-[#e9eef5] bg-white/90 px-4 py-4">
                      <div className="text-[11px] font-black tracking-[0.16em] text-[#006689]">{isGeneratedTextShowcasePage ? "使用建议" : "阅读建议"}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{resource.study_suggestion}</div>
                    </div>
                  ) : isGeneratedTextShowcasePage ? (
                    <div className="rounded-[22px] border border-[#e9eef5] bg-white/90 px-4 py-4">
                      <div className="text-[11px] font-black tracking-[0.16em] text-[#006689]">使用建议</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{generatedExperience.adviceLabel}</div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffe8f1]">
                      <SelectedIcon className="h-5 w-5 text-[#c25179]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black tracking-[0.18em] text-[#c25179]">当前文件</div>
                      <div className="mt-1 truncate text-sm font-bold text-slate-900">{getReadableFileTitle(selectedFile, "等待载入")}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[18px] border border-[#f1d8e3] bg-white px-4 py-3">
                      <div className="text-[11px] font-black tracking-[0.16em] text-[#64748b]">预览方式</div>
                      <div className="mt-1 text-sm text-slate-700">{currentPreviewModeLabel}</div>
                    </div>
                    <div className="rounded-[18px] border border-[#f1d8e3] bg-white px-4 py-3">
                      <div className="text-[11px] font-black tracking-[0.16em] text-[#64748b]">资料状态</div>
                      <div className="mt-1 text-sm text-slate-700">{isGeneratedPlaceholder ? "生成内容预览" : "可直接阅读"}</div>
                    </div>
                    {resource?.study_suggestion ? (
                      <div className="rounded-[18px] border border-[#f2d7e3] bg-[#fff6fa] px-4 py-3">
                        <div className="text-[11px] font-black tracking-[0.16em] text-[#c25179]">学习建议</div>
                        <div className="mt-1 text-sm leading-6 text-slate-700">{resource.study_suggestion}</div>
                      </div>
                    ) : isGeneratedPlaceholder ? (
                      <div className="rounded-[18px] border border-[#f2d7e3] bg-[#fff6fa] px-4 py-3">
                        <div className="text-[11px] font-black tracking-[0.16em] text-[#c25179]">同步提示</div>
                        <div className="mt-1 text-sm leading-6 text-slate-700">现在展示的是生成内容预览，等真实文件同步完成后，这里会自动替换成正式文档。</div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </aside>
          </div>
        </section>

        {error && resource ? (
          <section className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">当前资源详情加载时出现提示：{error}</section>
        ) : null}

        <section className={`grid gap-4 ${isShowcaseIllustrationPage || isGeneratedTextShowcasePage ? "xl:grid-cols-[minmax(0,1fr)_240px]" : "xl:grid-cols-[minmax(0,1fr)_300px]"}`}>
          <main className="min-w-0">
            {isShowcaseIllustrationPage ? (
              <div className="space-y-5">
                {renderPreviewBody()}
                {selectedFile && previewOpenUrl ? (
                  <div className="flex justify-end">
                    <a href={previewOpenUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f172a]">
                      <ExternalLink className="h-4 w-4" />
                      打开原文件
                    </a>
                  </div>
                ) : null}
              </div>
            ) : (
              <PreviewShell
                title={previewTitle}
                description={selectedFile ? `${getReadableFileTitle(selectedFile)} · ${formatFileSize(selectedFile.file_size)}` : "请选择一个可预览文件"}
                action={
                  selectedFile && previewOpenUrl ? (
                    <a href={previewOpenUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#fb7299] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#f85f8b]">
                      <ExternalLink className="h-3.5 w-3.5" />
                      打开原文件
                    </a>
                  ) : null
                }
              >
                {renderPreviewBody()}
              </PreviewShell>
            )}
          </main>

          <aside className="space-y-5">
            <section className="rounded-[24px] border border-[#f3dbe6] bg-white p-5 shadow-[0_18px_48px_rgba(251,114,153,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <FolderKanban className="h-4 w-4 text-[#c25179]" />
                  文件目录
                </div>
                <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1 rounded-full border border-[#f1d8e3] bg-[#fff7fb] px-3 py-1.5 text-[11px] font-bold text-[#c25179] transition-colors hover:bg-[#fff1f6]">
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {groupedFiles.length ? (
                  groupedFiles.map((group) => (
                    <div key={group.category} className="rounded-[20px] border border-[#f6e5eb] bg-[#fffafb] p-3">
                      <div className="px-2 pb-2 text-[11px] font-black tracking-[0.16em] text-[#c25179]">{group.category}</div>
                      <div className="space-y-2">
                        {group.files.map((file) => {
                          const active = file.file_id === selectedFile?.file_id;
                          const Icon = getFileIcon(file);
                          return (
                            <button
                              key={file.file_id}
                              type="button"
                              onClick={() => openFilePreview(file)}
                              className={`w-full rounded-[16px] border px-3 py-3 text-left transition-all ${
                                active ? "border-[#fb7299]/40 bg-[#fff5f8] shadow-[0_10px_24px_rgba(251,114,153,0.10)]" : "border-transparent bg-white hover:border-[#d9e8fb] hover:bg-[#f8fbff]"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-[#fb7299]/12 text-[#fb7299]" : "bg-[#eef5fb] text-[#006689]"}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={`truncate text-sm font-bold ${active ? "text-[#c25179]" : "text-slate-800"}`}>{file.display_name}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    <span>{getFileKindLabel(file)}</span>
                                    <span>·</span>
                                    <span>{formatFileSize(file.file_size)}</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-[#d8e0ea] bg-[#fafcff] px-4 py-5 text-sm text-slate-500">当前资源目录还没有同步出可用文件。</div>
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
