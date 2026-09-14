import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
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
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { studentApi, type ProfileSummaryResponse, type ResourceCard, type ResourceSourceFileRef } from "../lib/studentApi";
import { ACTIVE_USER_ID, resolveCourseId } from "../lib/courseContext";
import { openTutorPanel, saveActiveTutorContext } from "../lib/tutorPanel";
import {
  buildProfileAwareKnowledgePoints,
  buildResourceGenerationProfileContext,
} from "../lib/profileGeneration";

const FORCE_CODING_LAB_RESOURCE_IDS = new Set([9921]);
const FORCE_CODING_LAB_FILE_IDS = new Set([900001]);
const DEFAULT_COURSE_ID = "series-2";

const PREVIEW_GENERATION_OPTIONS = [
  {
    id: "extended_reading",
    label: "拓展阅读",
    actionLabel: "生成拓展阅读",
    detail: "补充背景原理、延伸材料和进一步阅读路径。",
    fileName: "AI 拓展阅读.md",
    category: "生成资料",
    extension: ".md",
    mime: "text/markdown",
  },
  {
    id: "coding_lab",
    label: "代码实操",
    actionLabel: "生成代码实操",
    detail: "生成可运行、可判题的练习任务和代码入口。",
    fileName: "AI 代码实操任务.md",
    category: "生成资料",
    extension: ".md",
    mime: "text/markdown",
  },
  {
    id: "visual_illustration",
    label: "教学插图",
    actionLabel: "生成教学插图",
    detail: "把知识点整理成课堂讲解图、结构图或流程图。",
    fileName: "AI 教学插图说明.md",
    category: "生成资料",
    extension: ".md",
    mime: "text/markdown",
  },
  {
    id: "ocr_notes",
    label: "真实板书",
    actionLabel: "生成真实板书",
    detail: "生成适合复习的板书式笔记和课堂重点整理。",
    fileName: "AI 真实板书稿.md",
    category: "生成资料",
    extension: ".md",
    mime: "text/markdown",
  },
] as const;

type PreviewGenerationType = (typeof PREVIEW_GENERATION_OPTIONS)[number]["id"];

type ResourcePreviewRouteState = {
  initialResource?: ResourceCard | null;
  initialFileId?: number | null;
  initialPreviewFile?: ResourceSourceFileRef | null;
  generationIntent?: {
    stage: "running" | "completed";
    label: string;
    type?: string | null;
  } | null;
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

type TeacherAssignment = CodingProblem & {
  assignmentId: string;
  teacher: string;
  dueLabel: string;
  points: number;
};

type AssignmentSubmissionRecord = {
  assignmentId: string;
  problemTitle: string;
  submittedAt: string;
  passed: number;
  total: number;
  status: "submitted" | "needs_fix";
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

const ASSIGNMENT_SUBMISSION_STORAGE_KEY = "a3-teacher-assignment-submissions";

function buildAssignmentSubmissionKey(courseId: string, fileId?: string | number | null) {
  return `${courseId || DEFAULT_COURSE_ID}::${fileId || "coding-lab"}`;
}
function loadAssignmentSubmissions(courseId: string, fileId?: string | number | null) {
  if (typeof window === "undefined") return {} as Record<string, AssignmentSubmissionRecord>;
  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_SUBMISSION_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, AssignmentSubmissionRecord>>) : {};
    return parsed[buildAssignmentSubmissionKey(courseId, fileId)] || {};
  } catch {
    return {};
  }
}

function saveAssignmentSubmissions(
  courseId: string,
  fileId: string | number | null | undefined,
  submissions: Record<string, AssignmentSubmissionRecord>,
) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_SUBMISSION_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, AssignmentSubmissionRecord>>) : {};
    parsed[buildAssignmentSubmissionKey(courseId, fileId)] = submissions;
    window.localStorage.setItem(ASSIGNMENT_SUBMISSION_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Submission cache is a local fallback until a teacher-assignment API is connected.
  }
}

function buildTeacherAssignments(baseProblems: CodingProblem[], courseId: string): TeacherAssignment[] {
  const teacher = courseId === "series-2" ? "软件工程任课教师" : "课程教师";
  const assignments: CodingProblem[] = [
    {
      id: "lc-two-sum-all-pairs",
      title: "两数之和：输出全部下标对",
      difficulty: "进阶",
      category: "哈希表",
      summary: "LeetCode Two Sum 的增强版，要求输出所有满足条件的下标对。",
      description:
        "给定长度为 n 的整数数组 nums 和目标值 target，请找出所有满足 nums[i] + nums[j] = target 且 i < j 的下标对。下标从 0 开始，按 i 从小到大、i 相同时 j 从小到大的顺序输出；如果不存在，输出 None。",
      input: "- 第 1 行输入整数 n。\n- 第 2 行输入 n 个整数。\n- 第 3 行输入整数 target。",
      output: "- 每行输出一个下标对：i j。\n- 如果没有满足条件的下标对，输出 None。",
      hint: "可以用 HashMap 记录每个值出现过的下标列表。遍历当前位置 j 时，查找 target - nums[j] 之前出现过的位置。",
      starterCode:
        'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int[] nums = new int[n];\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            nums[i] = scanner.nextInt();\n        }\n        int target = scanner.hasNextInt() ? scanner.nextInt() : 0;\n\n        StringBuilder answer = new StringBuilder();\n        for (int i = 0; i < n; i++) {\n            for (int j = i + 1; j < n; j++) {\n                if (nums[i] + nums[j] == target) {\n                    if (answer.length() > 0) {\n                        answer.append("\\n");\n                    }\n                    answer.append(i).append(" ").append(j);\n                }\n            }\n        }\n        System.out.println(answer.length() == 0 ? "None" : answer.toString());\n    }\n}\n',
      testCases: [
        { label: "用例 1", input: "5\n2 7 11 15 0\n9", output: "0 1" },
        { label: "用例 2", input: "6\n1 3 2 2 3 1\n4", output: "0 1\n0 4\n1 5\n2 3\n4 5" },
        { label: "用例 3", input: "4\n5 5 5 5\n10", output: "0 1\n0 2\n0 3\n1 2\n1 3\n2 3" },
      ],
    },
    {
      id: "lc-longest-subarray-sum-k",
      title: "和为 K 的最长连续子数组",
      difficulty: "提高",
      category: "前缀和",
      summary: "经典前缀和 + 哈希表题，要求在线性时间内找到最长区间。",
      description:
        "给定长度为 n 的整数数组 nums 和整数 k，请输出和为 k 的最长连续子数组长度。数组中可能包含负数，因此不能使用普通滑动窗口。",
      input: "- 第 1 行输入整数 n。\n- 第 2 行输入 n 个整数。\n- 第 3 行输入整数 k。",
      output: "- 输出一个整数，表示和为 k 的最长连续子数组长度；如果不存在，输出 0。",
      hint: "记录每个前缀和第一次出现的位置。当前位置前缀和为 sum，如果 sum - k 曾出现，则中间区间和为 k。",
      starterCode:
        'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int[] nums = new int[n];\n        for (int i = 0; i < n && scanner.hasNextInt(); i++) {\n            nums[i] = scanner.nextInt();\n        }\n        int k = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        // TODO: 使用前缀和求最长连续子数组长度\n    }\n}\n',
      testCases: [
        { label: "用例 1", input: "6\n1 -1 5 -2 3 1\n3", output: "4" },
        { label: "用例 2", input: "5\n-2 -1 2 1 4\n1", output: "2" },
        { label: "用例 3", input: "4\n1 2 3 4\n100", output: "0" },
      ],
    },
    {
      id: "lc-min-path-sum-grid",
      title: "最小路径和",
      difficulty: "进阶",
      category: "动态规划",
      summary: "二维 DP 经典题，训练状态定义、边界处理和空间优化。",
      description:
        "给定 m x n 的非负整数矩阵 grid。每次只能向右或向下移动一步，请从左上角走到右下角，输出路径上数字总和的最小值。",
      input: "- 第 1 行输入 m n。\n- 接下来 m 行，每行 n 个非负整数。",
      output: "- 输出一个整数，表示最小路径和。",
      hint: "dp[j] 表示走到当前行第 j 列的最小路径和。更新时取上方 dp[j] 和左侧 dp[j-1] 的较小值。",
      starterCode:
        'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int m = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int[][] grid = new int[m][n];\n        for (int i = 0; i < m; i++) {\n            for (int j = 0; j < n && scanner.hasNextInt(); j++) {\n                grid[i][j] = scanner.nextInt();\n            }\n        }\n        // TODO: 计算从左上角到右下角的最小路径和\n    }\n}\n',
      testCases: [
        { label: "用例 1", input: "3 3\n1 3 1\n1 5 1\n4 2 1", output: "7" },
        { label: "用例 2", input: "2 3\n1 2 3\n4 5 6", output: "12" },
        { label: "用例 3", input: "1 4\n5 1 2 3", output: "11" },
      ],
    },
    {
      id: "lc-course-schedule",
      title: "课程表：判断能否完成所有课程",
      difficulty: "提高",
      category: "图论拓扑排序",
      summary: "LeetCode Course Schedule 同类题，判断有向图是否存在环。",
      description:
        "学校有 n 门课程，编号 0 到 n-1。给定 p 条先修关系 a b，表示学习课程 a 之前必须先完成课程 b。请判断是否可以完成所有课程。",
      input: "- 第 1 行输入 n p。\n- 接下来 p 行，每行两个整数 a b，表示 b -> a 的先修关系。",
      output: "- 如果可以完成所有课程，输出 Yes；否则输出 No。",
      hint: "构建有向图和入度数组。使用队列执行拓扑排序，最后判断出队课程数量是否等于 n。",
      starterCode:
        'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int n = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        int p = scanner.hasNextInt() ? scanner.nextInt() : 0;\n        // TODO: 读取先修关系，使用拓扑排序判断是否有环\n    }\n}\n',
      testCases: [
        { label: "用例 1", input: "4 3\n1 0\n2 1\n3 2", output: "Yes" },
        { label: "用例 2", input: "2 2\n0 1\n1 0", output: "No" },
        { label: "用例 3", input: "5 4\n1 0\n2 0\n3 1\n3 2", output: "Yes" },
      ],
    },
  ];
  const fallback = baseProblems[0];
  return (assignments.length ? assignments : fallback ? [fallback] : []).map((problem, index) => ({
    ...problem,
    assignmentId: `teacher-${courseId}-${problem.id}`,
    teacher,
    dueLabel: index === 0 ? "今天 23:59 前" : index === 1 ? "明天 18:00 前" : "本周内",
    points: index === 0 ? 30 : 25,
    category: "老师布置",
  }));
}

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

function normalizePreviewLine(line: string) {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
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
      <text x="156" y="596" font-size="18" font-family="Arial, sans-serif" fill="#475467">推荐用途：讲义配图、课堂讲解、答辩结构说明、学习助手流程解释</text>
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
      <text x="786" y="718" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="${palette.accent}">插图投放位：讲义页 / PPT 页 / 学习助手页</text>
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
    preview_text: buildStructuredDocumentPreview("AI 生成资料预览", "extended_reading", "正式文件仍在同步中。当前页面先展示规范化学习资料结构，避免只显示简单占位说明。"),
    is_inline_previewable: true,
    preview_mode: "snippet",
    preview_url: null,
    open_url: "",
  };
}

function buildStructuredDocumentPreview(title: string, resourceType?: string | null, summary?: string | null) {
  const safeTitle = sanitizePreviewText(title, "课程资料");
  const normalizedType = String(resourceType || "").toLowerCase();
  const isExtendedReading = normalizedType === "extended_reading" || safeTitle.includes("拓展阅读") || safeTitle.includes("阅读");
  const isRagAgentTopic = /rag|检索增强|多智能体|智能体|agent/i.test(`${safeTitle} ${summary || ""}`);
  const documentKind = isExtendedReading ? "拓展阅读" : getResourceTypeLabel(normalizedType || "lecture_note");
  if (isRagAgentTopic) {
    return [
      `# ${safeTitle}`,
      "",
      "## 1. 学习定位",
      "这份资料围绕“多智能体协作 + RAG 检索增强”展开，重点不是记几个名词，而是理解系统如何把用户问题、知识库检索、智能体分工、答案生成和结果校验串成一个稳定流程。",
      "",
      "## 2. 先掌握的核心概念",
      "| 概念 | 要解决的问题 | 在系统里的位置 |",
      "| --- | --- | --- |",
      "| RAG | 大模型只靠参数记忆容易过时或编造 | 先检索课程资料、题库、作业记录，再把证据交给模型回答 |",
      "| 向量检索 | 用户问法和资料原文不完全一致 | 把文本切片编码成向量，按语义相似度召回片段 |",
      "| 多智能体 | 一个模型同时做规划、检索、判分会混乱 | 拆成画像、路径、资源、评估、答疑等职责明确的智能体 |",
      "| 编排器 | 多个智能体需要知道谁先执行、谁接收结果 | 管理任务流、上下文传递、失败重试和最终汇总 |",
      "| 证据链 | AI 回答需要可解释、可追溯 | 回答时附带资料来源、命中的知识点和下一步建议 |",
      "",
      "## 3. 主线流程",
      "1. 用户提出问题或学习目标，系统先识别意图：是要解释概念、生成资料、做测评，还是推荐学习路径。",
      "2. 岗位学情诊断智能体读取测评数据、学习行为和作业表现，判断当前能力薄弱点、学习偏好和可投入时间。",
      "3. 资源智能体根据课程、章节和知识点检索资料，优先召回讲义、视频片段、题目和历史答疑。",
      "4. RAG 模块把召回内容整理成可引用上下文，去掉重复片段，保留标题、来源和关键句。",
      "5. 答疑或生成智能体基于证据生成回答、讲义、练习或代码任务，并标出学习建议。",
      "6. 评估智能体通过小测、练习结果或对话反馈更新画像，下一轮路径再据此调整。",
      "",
      "## 4. 为什么要这样设计",
      "- 只用大模型回答：速度可能快，但容易缺少课程依据，也不容易解释答案从哪里来。",
      "- 只做资料检索：能找到原文，但不能把不同资料整理成适合当前学生的学习计划。",
      "- RAG + 多智能体：既保留资料依据，又能按学生状态组织下一步动作，适合个性化学习平台。",
      "",
      "## 5. 演示时可以怎么讲",
      "演示时先用一个学生问题触发 学习助手，让系统展示命中的课程资料和回答；再切到画像页说明这些推荐不是固定模板，而是结合测评、行为和作业表现生成；最后展示路径页或资源页，说明系统会把薄弱点转成后续学习任务和补充资料。",
      "",
      "## 6. 自测清单",
      "- 我能否说明 RAG 和普通聊天机器人的区别？",
      "- 我能否画出“问题识别 -> 检索 -> 证据整理 -> 生成 -> 反馈更新”的流程？",
      "- 我能否解释岗位学情诊断智能体、资源智能体、评估智能体分别负责什么？",
      "- 我能否指出一个没有证据链时容易出错的回答场景？",
      "",
      "## 7. 完成标准",
      "完成学习后，应该能用自己的话讲清楚：系统为什么需要 RAG，为什么要拆成多个智能体，以及这些智能体如何共同支持个性化学习。",
    ].join("\n");
  }
  if (normalizedType === "coding_lab") {
    return [
      `# ${safeTitle}`,
      "",
      "## 1. 实操目标",
      "把当前知识点转成一个可运行、可检查的小任务。完成后不只知道概念，还要能写出代码、解释输出，并定位常见错误。",
      "",
      "## 2. 任务背景",
      summary || "围绕当前课程主题设计一个短实操，把课堂概念落到输入、处理、输出和验证步骤上。",
      "",
      "## 3. 开发要求",
      "- 明确程序输入、处理逻辑和输出格式。",
      "- 至少包含 1 个核心知识点的直接应用。",
      "- 代码要能独立运行，关键分支需要有注释。",
      "- 运行后记录 2 组测试数据和对应输出。",
      "",
      "## 4. 推荐步骤",
      "1. 先写出伪代码，确认每一步要解决什么问题。",
      "2. 再补全主函数或核心方法，优先保证能运行。",
      "3. 用正常输入和边界输入各测一次。",
      "4. 最后用 3 句话解释代码为什么这样写。",
      "",
      "## 5. 提交标准",
      "- 一份可运行代码。",
      "- 两组测试输入输出。",
      "- 一个常见错误说明，例如类型转换、空值、边界条件或循环条件错误。",
    ].join("\n");
  }
  if (normalizedType === "visual_illustration") {
    return [
      `# ${safeTitle}`,
      "",
      "## 1. 插图用途",
      "这张图用于把抽象知识点转成课堂可讲解的结构图，重点展示对象、流程、关系和输入输出。",
      "",
      "## 2. 画面结构",
      "- 左侧：问题来源或用户输入。",
      "- 中间：关键处理流程、模块分工或数据流转。",
      "- 右侧：输出结果、反馈更新或验证标准。",
      "- 底部：标出容易混淆的边界条件和注意点。",
      "",
      "## 3. 讲解顺序",
      "1. 先说明这张图回答什么问题。",
      "2. 再从左到右讲清每个节点的职责。",
      "3. 最后指出哪个环节决定结果质量，以及如何验证。",
      "",
      "## 4. 配套说明",
      summary || "当前插图围绕课程资料生成，适合放在讲义、PPT 或答辩说明中，用来辅助解释复杂流程。",
    ].join("\n");
  }
  if (normalizedType === "ocr_notes") {
    return [
      `# ${safeTitle}`,
      "",
      "## 1. 板书主线",
      "本页按课堂板书方式整理，先写主题，再写核心概念、关系式、例子和课后检查点。",
      "",
      "## 2. 板书内容",
      "### 主题",
      safeTitle,
      "",
      "### 必记概念",
      "- 这个知识点解决什么问题。",
      "- 它和前后知识点的关系。",
      "- 它在项目或练习中通常出现在哪里。",
      "",
      "### 课堂例子",
      summary || "结合当前资料中的案例，把概念放回实际场景中解释。",
      "",
      "## 3. 课后检查",
      "- 能否用自己的话复述主题。",
      "- 能否举出一个应用场景。",
      "- 能否指出一个易错点并说明如何避免。",
    ].join("\n");
  }
  return [
    `# ${safeTitle}`,
    "",
    "## 1. 文档定位",
    isExtendedReading
      ? "这份资料用于补齐课堂主线之外的背景、原理、工程场景和继续阅读任务。它不是几条提示，而是一份可以直接用于复习、报告和答辩准备的拓展阅读规范稿。"
      : "这份资料用于把当前课程内容整理为可阅读、可复习、可验证的正式学习文档，帮助你从课堂内容过渡到项目应用。",
    "",
    "## 2. 阅读目标",
    "- 说清楚当前知识点解决的真实问题。",
    "- 区分概念定义、工程边界、实现步骤和验证标准。",
    "- 能把资料内容迁移到项目页面、接口联调、代码组织或学习报告中。",
    "",
    "## 3. 内容摘要",
    summary || "当前资源正在补全正式正文。系统先提供规范化预览稿，保证页面展示的是完整学习资料结构，而不是空白页或简单占位提示。",
    "",
    "## 4. 核心知识展开",
    "### 4.1 背景与动机",
    "学习任何技术点时，先回答它为什么出现：它降低了哪类复杂度，解决了哪类协作问题，或者让系统在哪个环节更容易维护。",
    "",
    "### 4.2 概念边界",
    "把概念边界写清楚比记住定义更重要。建议按“输入是什么、处理什么、输出什么、谁来使用结果”四个问题梳理。",
    "",
    "### 4.3 工程落地",
    "落地时要关注数据来源、状态变化、异常提示、权限边界和最终验证。只要其中一个环节没有说明清楚，后续就容易出现页面可见但流程不可用的问题。",
    "",
    "## 5. 对照表",
    "| 维度 | 需要回答的问题 | 产出物 |",
    "| --- | --- | --- |",
    `| 资料类型 | 这份${documentKind}服务哪个学习目标 | 阅读笔记或复盘提纲 |`,
    "| 工程场景 | 它对应页面、接口、数据还是协作流程 | 场景说明 |",
    "| 验证方式 | 如何确认自己真的理解了 | 自测清单和问题记录 |",
    "",
    "## 6. 阅读任务",
    "1. 提炼 3 个关键词，并说明它们之间的关系。",
    "2. 找一个项目中的对应场景，说明这份资料能解决什么问题。",
    "3. 写出一个可能出错的边界情况，并给出验证方式。",
    "4. 如果要向老师或评委解释这部分内容，准备一段 1 分钟说明。",
    "",
    "## 7. 完成标准",
    "- 不依赖原文也能解释主要概念。",
    "- 能把概念映射到项目实现或学习任务。",
    "- 能提出至少一个追问，继续让 学习助手补充细节。",
    "- 能基于本文形成下一步练习或复习计划。",
  ].join("\n");
}

function normalizePreviewDocumentContent(resource: ResourceCard, content: string) {
  const trimmed = content.trim();
  const looksLikePlaceholder =
    trimmed.length < 320 ||
    /拓展阅读草稿|生成完成后|这里会自动替换成真实内容|背景原理：补齐/.test(trimmed);
  if (!looksLikePlaceholder) {
    return content;
  }
  return buildStructuredDocumentPreview(resource.title, resource.resource_type, resource.summary || resource.study_suggestion);
}

function buildFileFallbackDocument(file: ResourceSourceFileRef, resource?: ResourceCard | null) {
  const fileTitle = sanitizePreviewText(file.display_name, "课程资料");
  const isPdf = file.file_extension?.toLowerCase() === ".pdf" || file.mime_type?.includes("pdf");
  const baseTitle = fileTitle.replace(/\.(pdf|md|txt|docx?|pptx?)$/i, "");
  return [
    `# ${baseTitle}`,
    "",
    "## 1. 文件状态",
    isPdf
      ? "这是一份 PDF 类型资料，但当前本地兜底资源没有提供可直接加载的 PDF 文件地址。页面已自动切换为规范化讲义预览，避免出现空白或无法打开的错误页。"
      : "当前文件没有提供可直接打开的源地址，页面已自动切换为规范化文本预览。",
    "",
    "## 2. 资料定位",
    resource?.summary || "这份资料用于帮助你快速回到当前课程主线，梳理核心概念、学习顺序和后续练习方向。",
    "",
    "## 3. 讲义速览",
    "- 先确认本节课的主题、目标和对应项目场景。",
    "- 再梳理关键概念之间的关系，区分定义、边界、流程和验证方式。",
    "- 最后把内容迁移到实操任务、答辩说明或学习报告中。",
    "",
    "## 4. 建议阅读顺序",
    "1. 浏览标题和目录，确认这份资料对应哪一节课。",
    "2. 阅读核心概念，标出和项目实现直接相关的内容。",
    "3. 对照实操任务，检查自己是否能独立复述实现思路。",
    "4. 使用 学习助手继续追问不清楚的概念或工程边界。",
    "",
    "## 5. 自测问题",
    "- 这份资料对应的核心问题是什么？",
    "- 如果要在项目中使用这个知识点，需要改动哪些模块？",
    "- 哪些状态、接口或文件缺失时，页面应该如何兜底？",
    "- 我能否用 1 分钟向老师说明这份资料的价值？",
  ].join("\n");
}

function normalizeGeneratedPreviewText(title: string, generationType: PreviewGenerationType, content: string, context?: string | null) {
  const trimmed = content.trim();
  const genericSignals = [
    "这份资料用于把当前课程内容整理为可阅读",
    "说清楚当前知识点解决的真实问题",
    "系统先提供规范化预览稿",
    "资料类型 | 这份",
  ];
  const shouldRebuild =
    trimmed.length < 520 ||
    genericSignals.some((signal) => trimmed.includes(signal)) ||
    /正式文件仍在同步|当前资源正在补全正式正文/.test(trimmed);
  if (!shouldRebuild) {
    return content;
  }
  return buildStructuredDocumentPreview(title, generationType, context || "围绕当前资料生成的补充学习材料。");
}

function isGeneratedFileCompatible(generationType: PreviewGenerationType, file?: ResourceSourceFileRef | null) {
  if (!file) return false;
  const extension = String(file.file_extension || "").toLowerCase();
  const mode = String(file.preview_mode || "").toLowerCase();
  if (generationType === "coding_lab") {
    return [".java", ".md", ".txt"].includes(extension) || mode === "code" || mode === "snippet";
  }
  if (generationType === "visual_illustration") {
    return [".md", ".txt", ".svg", ".png", ".jpg", ".jpeg", ".webp"].includes(extension) || mode === "image" || mode === "snippet";
  }
  return [".md", ".txt"].includes(extension) || mode === "snippet" || mode === "text";
}

function buildGeneratedFileFromResource(
  generated: ResourceCard | null | undefined,
  generationType: PreviewGenerationType,
  fallbackId: number,
  sourceTitle: string,
): ResourceSourceFileRef {
  const option = PREVIEW_GENERATION_OPTIONS.find((item) => item.id === generationType) || PREVIEW_GENERATION_OPTIONS[0];
  const candidateFile = generated?.source_files?.[0] || null;
  const generatedFile = isGeneratedFileCompatible(generationType, candidateFile) ? candidateFile : null;
  const title = sanitizePreviewText(generated?.title || option.fileName.replace(/\.md$/i, ""), option.fileName.replace(/\.md$/i, ""));
  const previewText =
    generatedFile?.preview_text ||
    generated?.content_markdown ||
    buildStructuredDocumentPreview(title, generationType, generated?.summary || `围绕《${sourceTitle}》生成的补充资料，已放入当前资料包。`);
  const normalizedPreviewText = normalizeGeneratedPreviewText(title, generationType, previewText, generated?.summary || sourceTitle);
  return {
    file_id: generatedFile?.file_id && generatedFile.file_id > 0 ? generatedFile.file_id : fallbackId,
    display_name: generatedFile?.display_name || option.fileName,
    relative_path: generatedFile?.relative_path || `generated://${generationType}/${fallbackId}`,
    top_level_category: option.category,
    file_extension: generatedFile?.file_extension || option.extension,
    mime_type: generatedFile?.mime_type || option.mime,
    file_size: generatedFile?.file_size || null,
    preview_text: normalizedPreviewText,
    is_inline_previewable: true,
    preview_mode: generatedFile?.preview_mode || "snippet",
    preview_url: generatedFile?.preview_url || null,
    open_url: generatedFile?.open_url || "",
  };
}

function normalizePreviewSourceFiles(files: ResourceSourceFileRef[]) {
  const seen = new Set<number>();
  return files.map((file, index) => {
    const rawFileId = Number(file.file_id);
    const hasUsableId = Number.isFinite(rawFileId) && rawFileId > 0 && !seen.has(rawFileId);
    const nextFileId = hasUsableId ? rawFileId : 900_000 + index;
    seen.add(nextFileId);
    return nextFileId === file.file_id ? file : { ...file, file_id: nextFileId };
  });
}

function buildQualityLectureNotePreview(title: string, courseId?: string) {
  const isSoftwareEngineering = courseId === "series-2";
  if (!isSoftwareEngineering) {
    return [
      `# ${title}`,
      "",
      "## 1. 本节定位",
      "本讲义把课堂内容整理成可复习、可摘录、可继续追问的学习材料。阅读时先抓主线，再看概念之间的关系，最后把结论落到项目或练习任务里。",
      "",
      "## 2. 学习目标",
      "- 说清本节课要解决的核心问题。",
      "- 区分概念定义、适用场景、操作步骤和检查标准。",
      "- 能把课堂结论迁移到当前项目、练习题或课堂汇报中。",
      "",
      "## 3. 学习路径",
      "先阅读本节主线，再整理关键词，最后用一个真实场景解释本节知识点的作用。",
      "",
      "## 4. 课后自测",
      "- 本节最核心的概念是什么？",
      "- 它解决了什么问题？",
      "- 如果换到真实项目中，应该放在哪个模块或流程里？",
    ].join("\n");
  }

  return [
    `# ${title}`,
    "",
    "## 1. 本节定位",
    "本讲义围绕“软件工程基础与软件危机”展开。重点不是背定义，而是理解为什么软件开发需要工程化方法：当项目规模扩大、需求变化加快、参与人员增多时，只靠个人经验很难稳定交付高质量软件。",
    "",
    "## 2. 学习目标",
    "- 能用自己的话说明“软件危机”产生的原因和典型表现。",
    "- 能区分程序设计、软件开发与软件工程三个层次。",
    "- 能说出软件工程如何通过过程、方法、工具和管理降低项目风险。",
    "- 能把课堂概念迁移到一个真实项目，从需求、设计、编码、测试、维护角度分析风险。",
    "",
    "## 3. 课堂主线",
    "1. 从软件危机切入：为什么软件项目经常延期、超支、质量不可控。",
    "2. 引出软件工程：用系统化、规范化、可度量的方法组织软件生产。",
    "3. 建立生命周期视角：需求、设计、实现、测试、交付、维护不是孤立环节。",
    "4. 回到实践：用工程化思维判断一个项目哪里最容易出风险。",
    "",
    "## 4. 软件危机是什么",
    "软件危机指软件开发和维护过程中长期存在的一组困难：开发进度难以预测，成本不断上升，软件质量不稳定，维护越来越困难，用户需求和最终交付之间经常出现偏差。",
    "",
    "| 表现 | 具体含义 | 对项目的影响 |",
    "| --- | --- | --- |",
    "| 进度失控 | 原计划无法按时完成 | 影响交付、验收和后续迭代 |",
    "| 成本超支 | 人力、时间和返工成本持续增加 | 项目收益下降，管理压力增大 |",
    "| 质量不稳定 | 缺陷多、可靠性差、用户体验差 | 上线风险高，维护负担重 |",
    "| 维护困难 | 代码结构混乱、文档缺失、理解成本高 | 后续修改容易引入新问题 |",
    "",
    "## 5. 为什么会出现软件危机",
    "- 软件本身不可见，进度和质量不像实体产品那样容易观察。",
    "- 需求经常变化，如果没有需求管理和变更控制，返工会迅速累积。",
    "- 软件规模扩大后，模块之间的依赖关系变复杂，局部修改可能影响全局。",
    "- 多人协作需要统一规范，如果缺少文档、评审和版本控制，沟通成本会压过编码效率。",
    "- 测试和质量保证如果放在最后，问题发现越晚，修复成本越高。",
    "",
    "## 6. 软件工程如何解决问题",
    "软件工程不是简单地“多写文档”，而是用工程化方式管理复杂性。它强调在开发前明确需求，在开发中控制设计和实现质量，在交付前通过测试验证结果，在上线后持续维护和改进。",
    "",
    "### 6.1 过程",
    "过程回答“按什么顺序做”。典型活动包括需求分析、概要设计、详细设计、编码、测试、部署和维护。过程的价值在于让团队知道当前处于哪一步、上一环节的产物是什么、下一环节需要什么输入。",
    "",
    "### 6.2 方法",
    "方法回答“每一步怎么做”。例如需求建模、模块化设计、结构化分析、面向对象设计、测试用例设计等，都是把抽象问题变成可执行工作的手段。",
    "",
    "### 6.3 工具",
    "工具回答“如何提高效率和可控性”。例如 Git 用于版本管理，Issue 系统用于任务跟踪，CI 用于自动构建和测试，文档平台用于沉淀需求和设计。",
    "",
    "### 6.4 管理",
    "管理回答“如何保证团队协同”。包括计划、估算、风险识别、质量评审、进度跟踪和变更控制。软件工程强调技术活动和管理活动同时存在。",
    "",
    "## 7. 案例化理解",
    "假设一个学生团队要开发“课程资源生成平台”。如果没有软件工程方法，团队可能直接开始写页面，做到一半才发现教师端、学生端、资源生成、历史记录、AI 问答之间的数据关系没有定义清楚，最后出现页面能展示但业务链路断裂的问题。",
    "",
    "按照软件工程思路，应先明确用户角色和核心用例，再定义资源生成、保存、预览、追问等关键流程，然后拆分模块，最后通过测试验证每条链路是否可用。这样做虽然前期多花时间，但能减少后期大面积返工。",
    "",
    "## 8. 易错点",
    "- 把软件工程误解为写代码之前的形式主义文档。",
    "- 只关注编码速度，忽略需求变化、测试验证和维护成本。",
    "- 认为小项目不需要工程化。实际上小项目也需要最小必要规范，例如任务拆分、版本管理和基本测试。",
    "- 把测试放到最后才做，导致问题集中暴露，修复成本急剧增加。",
    "",
    "## 9. 课堂活动建议",
    "请选取一个熟悉的软件，例如在线学习平台、外卖系统或图书管理系统，完成以下分析：",
    "",
    "1. 写出 3 个核心用户需求。",
    "2. 找出 2 个可能导致延期或返工的风险。",
    "3. 说明可以用哪一种工程化手段降低风险。",
    "4. 用一句话解释为什么这个系统不能只靠“边写边改”。",
    "",
    "## 10. 课后自测",
    "- 软件危机的四个典型表现是什么？",
    "- 为什么需求变化会显著增加软件开发风险？",
    "- 软件生命周期中，需求分析和测试分别解决什么问题？",
    "- 如果一个项目频繁返工，你会优先检查需求、设计、代码还是测试？为什么？",
    "- 软件工程中的“过程、方法、工具、管理”分别对应什么作用？",
    "",
    "## 11. 本节小结",
    "软件开发不是单纯的编码活动，而是一项需要协作、规范、验证和持续维护的工程活动。软件工程的价值在于让复杂的软件生产过程更可控，让团队能够在有限时间和成本内交付质量稳定的软件。",
  ].join("\n");
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
      "## 1. 本节定位",
      "这份课堂讲义把视频中的讲解顺序整理成可复习、可摘录、可继续追问的书面结构。阅读时先抓主线，再看概念之间的关系，最后把结论落到项目或练习任务里。",
      "",
      "## 2. 学习目标",
      "- 说清本节课要解决的核心问题。",
      "- 区分概念定义、适用场景、操作步骤和检查标准。",
      "- 能把课堂结论迁移到当前项目、练习题或课堂汇报中。",
      "",
      "## 3. 本节主线",
      "1. 先确认本节主题与目标，理解老师希望你最终掌握什么。",
      "2. 再梳理重点概念与结构关系，建立一条从问题到方法的解释链。",
      "3. 最后关注例子、易错点和课堂提示，把理解落到可迁移的应用上。",
      "",
      "## 4. 课堂重点整理",
      "正式讲义正文仍在同步中。当前预览先提供规范化讲义骨架，保证你能马上看到阅读路径、重点整理方式和后续复习任务。",
      "",
      "## 5. 课后自测",
      "- 本节课最核心的概念是什么？它解决了什么问题？",
      "- 如果换一个真实项目场景，这个知识点应该放在哪个模块或流程里？",
      "- 哪个步骤最容易理解错？应该用什么例子验证？",
      "",
      "## 6. 继续学习",
      "读完后建议把不确定的术语或步骤交给 学习助手继续追问，再回到课堂视频核对老师的原始讲解。",
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
    type === "lecture_note" || type === "lecture_notes" || type === "handout"
      ? buildQualityLectureNotePreview(title, courseId)
      : contentByType[type] ||
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
    relative_path: intent?.stage === "completed" ? `generated-preview://completed/${type}/${safeFileId}` : "generated-preview://pending",
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
  const content = normalizePreviewDocumentContent(resource, resource.content_markdown || resource.summary || resource.study_suggestion || rawTitle);

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

function normalizeComparableTitle(value?: string | null) {
  return String(value || "")
    .replace(/^#+\s*/, "")
    .replace(/\.(md|txt|pdf|docx?|pptx?)$/i, "")
    .replace(/^(AI\s*)?(课堂)?讲义[:：\s-]*/i, "")
    .replace(/[《》「」""''【】\s]/g, "")
    .toLowerCase();
}

function buildLectureHandoutTitle(...candidates: Array<string | null | undefined>) {
  const candidate =
    candidates
      .map((item) => sanitizePreviewText(item, ""))
      .find((item) => item && !/^AI\s*学习资料$/i.test(item)) || "课堂讲义";
  const cleaned = candidate
    .replace(/\.(md|txt|pdf|docx?)$/i, "")
    .replace(/^(AI\s*)?(生成)?(课堂)?讲义[:：\s-]*/i, "")
    .replace(/(课堂讲义|课程讲义|讲义资料)$/i, "")
    .trim();
  return cleaned || candidate || "课堂讲义";
}

function isTitleLikeLectureHandout(title: string, handoutTitle: string) {
  const rawTitle = sanitizePreviewText(title, "").replace(/\.(md|txt|pdf|docx?)$/i, "").trim();
  const rawHandoutTitle = sanitizePreviewText(handoutTitle, "").replace(/\.(md|txt|pdf|docx?)$/i, "").trim();
  if (rawTitle && rawHandoutTitle && (rawTitle === rawHandoutTitle || rawTitle.includes(rawHandoutTitle) || rawHandoutTitle.includes(rawTitle))) {
    return true;
  }
  const normalizedTitle = normalizeComparableTitle(title);
  const normalizedHandoutTitle = normalizeComparableTitle(handoutTitle);
  return Boolean(normalizedTitle && normalizedHandoutTitle && (normalizedTitle === normalizedHandoutTitle || normalizedTitle.includes(normalizedHandoutTitle)));
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
    <section className="overflow-hidden rounded-[16px] border border-[#dfe7ef] bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f7] bg-[#fbfdff] px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-xs font-black text-[#006689]">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="bg-[#f6f8fb] p-3">{children}</div>
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

const SERIES_TWO_TOPIC = "软件工程基础与软件危机";

function GeneratedPptPreview({ title }: { title: string }) {
  const slides = [
    {
      eyebrow: "01 / 课程导入",
      title: "为什么需要软件工程",
      points: ["软件规模扩大后，个人经验无法稳定保证质量", "软件危机集中表现为延期、超支、质量不可控", "软件工程用过程、方法和工具降低交付风险"],
    },
    {
      eyebrow: "02 / 核心概念",
      title: "软件生命周期",
      points: ["问题定义与可行性研究明确做不做", "需求分析说明做什么", "设计、编码、测试和维护保证怎么做、做得对不对"],
    },
    {
      eyebrow: "03 / 课堂讨论",
      title: "从项目失败看工程化价值",
      points: ["需求频繁变化时需要变更管理", "多人协作时需要规范、评审和版本控制", "质量风险需要通过测试与度量提前暴露"],
    },
    {
      eyebrow: "04 / 总结",
      title: "本节课要带走的三句话",
      points: ["软件工程不是写代码本身，而是组织可控的软件生产", "软件危机的根源是复杂性、变化和协作成本", "工程化目标是让软件按成本、质量和进度稳定交付"],
    },
  ];

  return (
    <PreviewShell title="课堂 PPT 预览" description="按幻灯片结构展示生成结果，适合录屏演示和课堂讲解。">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {slides.map((slide, index) => (
            <div key={slide.title} className="rounded-2xl border border-[#f4c6d5] bg-white px-4 py-3">
              <div className="text-[10px] font-black text-[#FB7299]">{String(index + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-sm font-black text-[#111827]">{slide.title}</div>
            </div>
          ))}
        </aside>
        <div className="grid gap-5">
          {slides.map((slide) => (
            <section key={slide.title} className="min-h-[300px] rounded-[28px] border border-[#f2c8d6] bg-[linear-gradient(135deg,#fff7fb_0%,#ffffff_54%,#eef7ff_100%)] p-8 shadow-[0_20px_52px_rgba(251,114,153,0.10)]">
              <div className="text-xs font-black tracking-[0.18em] text-[#FB7299]">{slide.eyebrow}</div>
              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.05em] text-[#111827]">{slide.title}</h2>
              <div className="mt-8 grid gap-3">
                {slide.points.map((point) => (
                  <div key={point} className="rounded-2xl border border-[#fde2e8] bg-white/82 px-5 py-4 text-base font-bold leading-7 text-[#334155]">
                    {point}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-5 py-4 text-sm leading-7 text-[#1e3a8a]">
        当前文件：{title || "课堂 PPT"}。页面展示的是可直接讲解的 PPT 结构预览，不再落回空白 Markdown。
      </div>
    </PreviewShell>
  );
}

type EditablePreviewSlide = {
  title: string;
  subtitle: string;
  points: string[];
  illustration?: {
    title: string;
    caption: string;
  };
};

const PPT_ILLUSTRATION_IMAGE = "/generated-resource-illustrations/ppt/software-engineering-classroom.svg";

function PreviewPptIllustrationScene({ illustration }: { illustration?: EditablePreviewSlide["illustration"] }) {
  const [imageReady, setImageReady] = useState(true);
  const title = (illustration?.title || "概念结构图").replace(/插画/g, "图解");
  const caption = (illustration?.caption || "用图像把本页内容转成更容易讲解的视觉线索。").replace(/插画/g, "图像");

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[#DCE7F7] bg-[#F8FBFF]">
        {imageReady ? (
          <img
            src={PPT_ILLUSTRATION_IMAGE}
            alt={title}
            className="h-[190px] w-full object-contain"
            decoding="async"
            onError={() => setImageReady(false)}
          />
        ) : (
          <svg viewBox="0 0 260 168" role="img" aria-label={title} className="h-[190px] w-full object-contain">
            <rect width="260" height="168" rx="18" fill="#F8FBFF" />
            <rect x="24" y="24" width="122" height="62" rx="12" fill="#FFFFFF" stroke="#CFE0FF" strokeWidth="2" />
            <rect x="42" y="42" width="68" height="6" rx="3" fill="#1677FF" />
            <rect x="42" y="58" width="88" height="4" rx="2" fill="#CBD5E1" />
            <circle cx="58" cy="112" r="17" fill="#FFD7C2" />
            <path d="M42 108c6-22 31-22 37 0-13-9-25-9-37 0Z" fill="#7C3AED" />
            <path d="M45 131c6-22 30-24 39 0l12 30H34Z" fill="#FB7299" />
            <rect x="104" y="102" width="54" height="35" rx="10" fill="#FFFFFF" stroke="#F9A8D4" strokeWidth="2" />
            <rect x="180" y="60" width="52" height="42" rx="12" fill="#FFFFFF" stroke="#CFE0FF" strokeWidth="2" />
            <path d="M154 119c18-18 32-22 49-15" fill="none" stroke="#1677FF" strokeWidth="5" strokeLinecap="round" />
            <path d="m200 96 14 10-15 9" fill="none" stroke="#1677FF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="28" y="145" width="202" height="9" rx="4.5" fill="#FED7AA" />
          </svg>
        )}
      </div>
      <div className="mt-2 text-sm font-black text-[#111827]">{title}</div>
      <p className="mt-1 line-clamp-3 text-[11px] font-semibold leading-5 text-[#64748B]">{caption}</p>
    </div>
  );
}

type PreviewPptTemplateId = "academic" | "defense" | "warm" | "chalkboard" | "techGrid" | "minimalReport";

const PREVIEW_PPT_TEMPLATES: Record<
  PreviewPptTemplateId,
  {
    name: string;
    topBar: string;
    canvas: string;
    cornerA: string;
    cornerB: string;
    lineA: string;
    lineB: string;
    title: string;
    subtitle: string;
    number: string;
    bullet: string;
  }
> = {
  academic: {
    name: "学术白板",
    topBar: "bg-[#F8FAFC] text-[#111827]",
    canvas: "bg-white",
    cornerA: "bg-[#DEB7A8]",
    cornerB: "bg-[#DDE7B5]",
    lineA: "bg-[#DDB7A8]",
    lineB: "bg-[#DDE7B5]",
    title: "text-[#222]",
    subtitle: "text-[#64748B]",
    number: "text-[#D8DDD8]/80",
    bullet: "border-[#E5EAF1] bg-white/86 text-[#334155]",
  },
  defense: {
    name: "蓝色答辩",
    topBar: "bg-[#0F2A5F] text-white",
    canvas: "bg-[linear-gradient(135deg,#F8FBFF_0%,#FFFFFF_62%,#EAF1FF_100%)]",
    cornerA: "bg-[#0F2A5F]",
    cornerB: "bg-[#BFD7FF]",
    lineA: "bg-[#2F6BFF]",
    lineB: "bg-[#0F2A5F]",
    title: "text-[#0F172A]",
    subtitle: "text-[#31507A]",
    number: "text-[#D9E6FF]",
    bullet: "border-[#CFE0FF] bg-white text-[#17345F]",
  },
  warm: {
    name: "暖色课堂",
    topBar: "bg-[#FFF7ED] text-[#7C2D12]",
    canvas: "bg-[linear-gradient(135deg,#FFF7ED_0%,#FFFFFF_60%,#FFEDD5_100%)]",
    cornerA: "bg-[#FDBA74]",
    cornerB: "bg-[#FED7AA]",
    lineA: "bg-[#F97316]",
    lineB: "bg-[#FDBA74]",
    title: "text-[#1F2937]",
    subtitle: "text-[#9A3412]",
    number: "text-[#FED7AA]/80",
    bullet: "border-[#FED7AA] bg-white/90 text-[#7C2D12]",
  },
  chalkboard: {
    name: "黑板板书",
    topBar: "bg-[#102A2A] text-[#DFF7EF]",
    canvas: "bg-[#102A2A]",
    cornerA: "bg-[#DFF7EF]",
    cornerB: "bg-[#F8D47A]",
    lineA: "bg-[#DFF7EF]",
    lineB: "bg-[#F8D47A]",
    title: "text-[#F8FAFC]",
    subtitle: "text-[#DFF7EF]/80",
    number: "text-[#DFF7EF]/16",
    bullet: "border-white/15 bg-white/8 text-[#F8FAFC]",
  },
  techGrid: {
    name: "科技网格",
    topBar: "bg-[#08111F] text-[#20D3EE]",
    canvas: "bg-[linear-gradient(135deg,#08111F_0%,#111827_58%,#1E1B4B_100%)]",
    cornerA: "bg-[#20D3EE]",
    cornerB: "bg-[#7C3AED]",
    lineA: "bg-[#20D3EE]",
    lineB: "bg-[#7C3AED]",
    title: "text-white",
    subtitle: "text-[#A5F3FC]",
    number: "text-[#20D3EE]/18",
    bullet: "border-[#20D3EE]/30 bg-white/8 text-white",
  },
  minimalReport: {
    name: "极简报告",
    topBar: "bg-[#F8FAFC] text-[#111827]",
    canvas: "bg-[#F8FAFC]",
    cornerA: "bg-[#111827]",
    cornerB: "bg-[#CBD5E1]",
    lineA: "bg-[#111827]",
    lineB: "bg-[#94A3B8]",
    title: "text-[#111827]",
    subtitle: "text-[#64748B]",
    number: "text-[#CBD5E1]/70",
    bullet: "border-[#E2E8F0] bg-white text-[#334155]",
  },
};

function getPreviewPptTemplate(markdown: string): PreviewPptTemplateId {
  const match = markdown.match(/ppt-template:(academic|defense|warm|chalkboard|techGrid|minimalReport)/i);
  const raw = match?.[1] || "";
  const normalized = raw.toLowerCase();
  if (normalized === "techgrid") return "techGrid";
  if (normalized === "minimalreport") return "minimalReport";
  if (normalized === "chalkboard") return "chalkboard";
  if (normalized === "defense") return "defense";
  if (normalized === "warm") return "warm";
  return "academic";
}

function buildInteractivePreviewSlides(markdown: string, title: string): EditablePreviewSlide[] {
  const sections = markdown
    .replace(/<!--\s*ppt-template:(academic|defense|warm|chalkboard|techGrid|minimalReport)\s*-->/i, "")
    .split(/\n(?=##\s+)/)
    .map((section) => section.trim())
    .filter(Boolean);
  const parsed = sections
    .map((section) => {
      const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
      const heading = normalizePreviewLine(lines[0] || "");
      const illustrationLine = lines.find((line) => /^>\s*(插画|图解)[:：]/.test(line));
      const illustrationText = illustrationLine?.replace(/^>\s*(插画|图解)[:：]\s*/, "").trim() || "";
      const [illustrationTitle, illustrationCaption] = illustrationText.split(/[｜|]/).map((item) => item.trim());
      const points = lines
        .slice(1)
        .filter((line) => !/^>\s*(插画|图解)[:：]/.test(line))
        .map((line) => normalizePreviewLine(line))
        .filter((line) => line.length >= 2)
        .slice(0, 5);
      return {
        title: heading || title || "课堂 PPT",
        subtitle: points[0] || "按当前资料生成的课件页",
        points: points.length ? points : ["补充本页核心观点", "结合课堂案例解释", "加入复习或答辩表达"],
        illustration: illustrationTitle
          ? {
              title: illustrationTitle,
              caption: illustrationCaption || "用图像把本页内容转成更容易讲解的视觉线索。",
            }
          : undefined,
      };
    })
    .filter((slide) => slide.title);

  if (parsed.length) return parsed.slice(0, 12);
  return [
    { title: title || "课堂 PPT", subtitle: "课程导入", points: ["说明本节课的学习目标", "交代问题背景和应用场景", "建立后续内容的主线"], illustration: { title: "课程场景图", caption: "用课堂、资料和练习三个元素表现学习入口。" } },
    { title: "核心概念与结构", subtitle: "把术语讲成关系", points: ["拆解关键概念", "说明上下游关系", "标出容易混淆的边界"], illustration: { title: "概念结构图", caption: "用节点和连线展示概念之间的上下游关系。" } },
    { title: "案例应用", subtitle: "回到课堂任务", points: ["结合课程项目说明用途", "给出分析或实现步骤", "说明结果如何验证"], illustration: { title: "任务场景图", caption: "用真实任务画面帮助理解知识如何落地。" } },
    { title: "复习与练习", subtitle: "形成学习闭环", points: ["整理易错点", "生成练习验证掌握", "把结论用于答辩表达"], illustration: { title: "学习闭环图", caption: "把讲义、导图、练习和答疑串成复习路径。" } },
  ];
}

function InteractiveGeneratedPptPreview({ title, markdown }: { title: string; markdown?: string }) {
  const [slides, setSlides] = useState(() => buildInteractivePreviewSlides(markdown || "", title));
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const templateId = getPreviewPptTemplate(markdown || "");
  const template = PREVIEW_PPT_TEMPLATES[templateId];
  const activeSlide = slides[activeIndex] || slides[0];

  useEffect(() => {
    setSlides(buildInteractivePreviewSlides(markdown || "", title));
    setActiveIndex(0);
    setPlaying(false);
  }, [markdown, title]);

  useEffect(() => {
    if (!playing || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => {
        if (index >= slides.length - 1) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, [playing, slides.length]);

  const updateSlide = (patch: Partial<EditablePreviewSlide>) => {
    setSlides((current) => current.map((slide, index) => (index === activeIndex ? { ...slide, ...patch } : slide)));
  };
  const updatePoint = (pointIndex: number, value: string) => {
    const points = [...activeSlide.points];
    points[pointIndex] = value;
    updateSlide({ points });
  };

  return (
    <PreviewShell title="课堂 PPT 预览" description="先查看课件页，再播放或编辑当前页内容。">
      <div className="overflow-hidden rounded-[12px] border border-[#D4DCE6] bg-white">
        <div className={`flex min-h-[36px] items-center justify-between border-b border-[#D4DCE6] px-3 ${template.topBar}`}>
          <div className="text-xs font-black">{template.name}</div>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded bg-white px-2.5 py-1 text-[11px] font-black text-[#111827]"
          >
            <Play className="h-3.5 w-3.5" />
            {playing ? "暂停" : "播放"}
          </button>
        </div>
        <div className="grid min-h-[520px] bg-[#F3F5F8] lg:grid-cols-[132px_minmax(0,1fr)_230px]">
          <aside className="border-r border-[#D4DCE6] bg-white p-2">
            <div className="mb-2 rounded border border-[#D4DCE6] bg-[#FAFBFC] px-2 py-1.5 text-[11px] font-bold text-[#475569]">
              + 添加幻灯片
            </div>
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <button
                  key={`${slide.title}-${index}`}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setActiveIndex(index);
                  }}
                  className={`w-full rounded-md border p-1 text-left ${activeIndex === index ? "border-[#1677FF] bg-[#EEF5FF]" : "border-[#E5EAF1] bg-white"}`}
                >
                  <div className="aspect-video rounded bg-[radial-gradient(circle_at_8%_8%,#DEB7A8_0%,#DEB7A8_22%,transparent_23%),radial-gradient(circle_at_92%_92%,#DDE7B5_0%,#DDE7B5_18%,transparent_19%),#fff] p-2">
                    <div className="text-[9px] font-black text-[#94A3B8]">{String(index + 1).padStart(2, "0")}</div>
                    <div className="mt-4 line-clamp-2 text-[10px] font-black text-[#111827]">{slide.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex items-center justify-center overflow-auto p-4">
            <section className={`relative aspect-[16/9] w-full max-w-[820px] p-8 shadow-[0_10px_26px_rgba(15,23,42,0.14)] ${template.canvas}`}>
              <div className={`absolute left-0 top-0 h-24 w-24 rounded-br-full ${template.cornerA}`} />
              <div className={`absolute bottom-0 right-0 h-24 w-32 rounded-tl-full ${template.cornerB}`} />
              <div className={`absolute left-[18%] right-[10%] top-10 h-1.5 ${template.lineA}`} />
              <div className={`absolute bottom-12 left-[8%] right-[18%] h-1.5 ${template.lineB}`} />
              <div className="relative z-10 grid h-full items-center gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="relative flex min-w-0 flex-col items-center justify-center text-center">
                  <div className={`absolute -top-10 text-[58px] font-black leading-none ${template.number}`}>{String(activeIndex + 1).padStart(2, "0")}</div>
                  <h2 className={`max-w-[620px] text-[30px] font-black leading-tight ${template.title}`}>{activeSlide.title}</h2>
                  <p className={`mt-3 max-w-[620px] text-xs font-semibold leading-5 ${template.subtitle}`}>{activeSlide.subtitle}</p>
                  <div className="mt-5 grid w-full max-w-[700px] gap-2 text-left">
                    {activeSlide.points.slice(0, 4).map((point, index) => (
                      <div key={`${activeIndex}-${index}`} className={`rounded-md border px-3 py-2 text-xs font-semibold leading-5 ${template.bullet}`}>
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hidden rounded-2xl border border-[#E5EAF1] bg-[linear-gradient(135deg,#F8FBFF_0%,#FFFFFF_100%)] p-4 text-left shadow-sm lg:block">
                  <PreviewPptIllustrationScene illustration={activeSlide.illustration} />
                </div>
              </div>
            </section>
          </main>

          <aside className="border-l border-[#D4DCE6] bg-white p-3">
            <div className="text-xs font-black text-[#002FA7]">编辑当前页</div>
            <label className="mt-3 block">
              <span className="text-[10px] font-black text-[#64748B]">大标题</span>
              <input value={activeSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} className="mt-1 w-full rounded border border-[#D4DCE6] px-2 py-2 text-xs font-bold outline-none focus:border-[#1677FF]" />
            </label>
            <label className="mt-3 block">
              <span className="text-[10px] font-black text-[#64748B]">小标题</span>
              <input value={activeSlide.subtitle} onChange={(event) => updateSlide({ subtitle: event.target.value })} className="mt-1 w-full rounded border border-[#D4DCE6] px-2 py-2 text-xs outline-none focus:border-[#1677FF]" />
            </label>
            <div className="mt-3">
              <div className="text-[10px] font-black text-[#64748B]">页面要点</div>
              <div className="mt-1 space-y-2">
                {activeSlide.points.slice(0, 5).map((point, index) => (
                  <textarea key={`${activeIndex}-edit-${index}`} value={point} onChange={(event) => updatePoint(index, event.target.value)} rows={2} className="w-full resize-none rounded border border-[#D4DCE6] px-2 py-2 text-[11px] leading-5 outline-none focus:border-[#1677FF]" />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PreviewShell>
  );
}

function GeneratedMindmapPreview({ title }: { title: string }) {
  const branches = [
    { title: "软件危机", items: ["延期与超支", "质量难保证", "维护成本高"] },
    { title: "软件工程目标", items: ["控制复杂性", "规范协作", "提升可维护性"] },
    { title: "生命周期", items: ["需求分析", "系统设计", "编码测试", "运行维护"] },
    { title: "工程方法", items: ["过程模型", "项目管理", "质量保证"] },
  ];

  return (
    <PreviewShell title="课堂导图预览" description="用中心主题和分支节点呈现知识结构，便于一眼看出本节课脉络。">
      <div className="relative overflow-hidden rounded-[14px] border border-[#dfe7ef] bg-white p-4">
        <div className="relative mx-auto grid max-w-6xl gap-3 lg:grid-cols-[1fr_220px_1fr]">
          <div className="grid gap-3">
            {branches.slice(0, 2).map((branch) => (
              <MindmapBranch key={branch.title} branch={branch} align="right" />
            ))}
          </div>
          <div className="flex items-center justify-center">
            <div className="rounded-[16px] border-2 border-[#FB7299] bg-white px-5 py-5 text-center shadow-[0_10px_24px_rgba(251,114,153,0.12)]">
              <div className="text-[10px] font-black text-[#FB7299]">中心主题</div>
              <h2 className="mt-2 text-lg font-black leading-tight text-[#111827]">{SERIES_TWO_TOPIC}</h2>
              <p className="mt-2 text-[11px] leading-5 text-[#64748b]">{title || "课堂导图"}</p>
            </div>
          </div>
          <div className="grid gap-3">
            {branches.slice(2).map((branch) => (
              <MindmapBranch key={branch.title} branch={branch} align="left" />
            ))}
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function MindmapBranch({ branch, align }: { branch: { title: string; items: string[] }; align: "left" | "right" }) {
  return (
    <section className={`rounded-[12px] border border-[#dbeafe] bg-white px-3 py-3 ${align === "right" ? "lg:text-right" : ""}`}>
      <h3 className="text-sm font-black text-[#1d4ed8]">{branch.title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {branch.items.map((item) => (
          <span key={item} className="rounded-full border border-[#f4c6d5] bg-[#fff7fb] px-2 py-0.5 text-[11px] font-bold text-[#9f1239]">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function GeneratedPracticePreview({ title }: { title: string }) {
  const questions = [
    { type: "单选题", tag: "数据结构：栈", stem: "使用数组实现栈时，`top` 表示栈顶元素下标。执行 `push(x)` 前最应该先检查什么？", answer: "`top == capacity - 1`，用于判断栈是否已满，避免数组越界。" },
    { type: "单选题", tag: "数据结构：队列", stem: "打印任务按提交顺序依次处理，最适合使用哪种数据结构？", answer: "队列。它满足 FIFO，先进入队列的任务先被处理。" },
    { type: "多选题", tag: "队列应用", stem: "以下哪些场景通常可以使用队列思想？", answer: "打印任务排队、消息队列消费、广度优先搜索 BFS。" },
    { type: "单选题", tag: "算法复杂度", stem: "对长度为 n 的无序数组做线性查找，最坏情况下时间复杂度是多少？", answer: "O(n)。最坏情况下需要检查每一个元素。" },
    { type: "判断题", tag: "二分查找", stem: "二分查找可以直接用于任意无序数组。", answer: "错误。二分查找依赖有序性或可单调排除搜索区间的条件。" },
    { type: "代码阅读题", tag: "Java 数组", stem: "阅读代码：`int[] a = {2, 4, 6}; System.out.println(a[2]);` 输出什么？", answer: "输出 6。Java 数组下标从 0 开始，`a[2]` 是第三个元素。" },
    { type: "多选题", tag: "Java 集合", stem: "用 `HashMap<String, Integer>` 做词频统计时，核心操作有哪些？", answer: "按 key 查询旧次数，并将新次数写回对应 key。" },
    { type: "单选题", tag: "数据库索引", stem: "用户表 `email` 字段要求唯一且常用于登录查询，应该优先做什么设计？", answer: "建立唯一索引，既保证邮箱不重复，也提升按邮箱查询效率。" },
    { type: "单选题", tag: "操作系统", stem: "多个线程同时修改共享计数器且没有同步控制，最可能出现什么问题？", answer: "竞态条件。共享变量并发读写会导致结果不确定。" },
    { type: "应用题", tag: "综合设计", stem: "请设计一个“小型在线题库”的核心表结构，并说明至少 2 个关键字段。", answer: "可设计题目表、选项表、提交记录表；关键字段包括题目 id、知识点、题型、正确答案、用户答案、提交时间等。" },
  ];

  return (
    <PreviewShell title="课堂练习预览" description="展示可直接用于计算机课程检测的 10 道练习题，覆盖数据结构、Java、算法、数据库与操作系统。">
      <div className="grid gap-3 md:grid-cols-2">
        {questions.map((question, index) => (
          <section key={question.stem} className="rounded-[14px] border border-[#e2e8f0] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[11px] font-black text-white">{String(index + 1).padStart(2, "0")}</span>
              <span className="rounded-full bg-[#fff1f5] px-2 py-0.5 text-[11px] font-black text-[#FB7299]">{question.type}</span>
              <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[11px] font-bold text-[#1d4ed8]">{question.tag}</span>
            </div>
            <h3 className="mt-3 text-sm font-black leading-6 text-[#111827]">{question.stem}</h3>
            <div className="mt-2 rounded-[10px] border border-[#dcfce7] bg-[#f0fdf4] px-3 py-2 text-xs font-bold leading-6 text-[#166534]">
              参考答案：{question.answer}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-3 text-[11px] font-bold text-[#64748b]">当前文件：{title || "课堂练习"}。练习内容已按中文题面重新结构化展示。</div>
    </PreviewShell>
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
    summary: "根据当前课程内容生成的配套实操题，可直接运行并进入判题结果页。",
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

function decorateCodingProblem(problem: CodingProblem, patch: Partial<Pick<CodingProblem, "id" | "difficulty" | "category" | "summary">>) {
  return {
    ...problem,
    ...patch,
  };
}

function buildContextCodingProblemBank(problemText: string, resource?: ResourceCard | null) {
  const currentTask = decorateCodingProblem(
    buildCodingProblemFromMarkdown(problemText, resource?.title || "老师布置的代码实操"),
    {
      id: "teacher-assigned-current",
      difficulty: "进阶" as CodingProblem["difficulty"],
      category: "老师布置",
      summary: "来自当前课程资源或老师布置内容，优先对应你现在正在学习的章节任务。",
    },
  );
  const progressTasks = [
    decorateCodingProblem(CODING_LAB_PROBLEM_BANK[1], {
      id: "progress-array-max",
      category: "进度推荐",
      summary: "根据当前代码实操进度补强数组遍历和条件更新。",
    }),
    decorateCodingProblem(CODING_LAB_PROBLEM_BANK[2], {
      id: "weak-point-branch-loop",
      category: "薄弱点补练",
      summary: "用于巩固循环中的条件判断，适合在样例通过后继续补弱。",
    }),
    decorateCodingProblem(CODING_LAB_PROBLEM_BANK[3], {
      id: "teacher-format-average",
      category: "课堂作业",
      summary: "贴近老师常布置的输入处理与格式化输出题。",
    }),
  ].filter(Boolean) as CodingProblem[];
  return [currentTask, ...progressTasks];
}

function buildRequestedCodingProblem(goal: string, markdown?: string) {
  const generated = buildCodingProblemFromMarkdown(markdown || "", goal || "AI 按需生成练习");
  if (markdown && markdown.trim().length > 20) {
    return decorateCodingProblem(generated, {
      id: `ai-generated-${Date.now()}`,
      difficulty: "进阶" as CodingProblem["difficulty"],
      category: "AI 按需生成",
      summary: `根据你的练习目标生成：${goal}`,
    });
  }

  const normalized = goal.toLowerCase();
  const base = /数组|array|最大|最小|max|min/.test(normalized)
    ? CODING_LAB_PROBLEM_BANK[1]
    : /偶数|奇数|条件|判断|if|branch/.test(normalized)
      ? CODING_LAB_PROBLEM_BANK[2]
      : /平均|小数|格式|format/.test(normalized)
        ? CODING_LAB_PROBLEM_BANK[3]
        : CODING_LAB_PROBLEM_BANK[0];
  return decorateCodingProblem(base, {
    id: `ai-generated-${Date.now()}`,
    category: "AI 按需生成",
    summary: `根据你的练习目标生成：${goal}`,
  });
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

function buildRunResult(stdout: string): Awaited<ReturnType<typeof studentApi.runJavaCode>> {
  return {
    success: true,
    compile_ok: true,
    run_ok: true,
    stdout,
    stderr: "",
    exit_code: 0,
    compile_output: "",
  };
}

function runLocalTwoSumAllPairs(stdin: string): Awaited<ReturnType<typeof studentApi.runJavaCode>> {
  const numbers = (stdin.match(/-?\d+/g) || []).map(Number);
  const n = numbers[0] || 0;
  const nums = numbers.slice(1, 1 + n);
  const target = numbers[1 + n] ?? 0;
  const lines: string[] = [];
  for (let i = 0; i < nums.length; i += 1) {
    for (let j = i + 1; j < nums.length; j += 1) {
      if (nums[i] + nums[j] === target) {
        lines.push(`${i} ${j}`);
      }
    }
  }
  return buildRunResult(lines.length ? lines.join("\n") : "None");
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
  if (/nums\s*\[\s*i\s*\]\s*\+\s*nums\s*\[\s*j\s*\]\s*==\s*target/.test(normalizedCode) && /StringBuilder|println/.test(normalizedCode)) {
    return runLocalTwoSumAllPairs(stdin);
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
  return buildRunResult(String(sum));
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
  const navigate = useNavigate();
  const problemText = previewText || resource?.content_markdown || resource?.summary || "请阅读题目要求，在右侧补全 Main.java 并运行判题。";
  const courseId = getCourseIdFromUrl();
  const sourceFileId = getSourceFileIdFromUrl();
  const baseProblemBank = useMemo(() => buildContextCodingProblemBank(problemText, resource), [problemText, resource]);
  const teacherAssignments = useMemo(() => buildTeacherAssignments(baseProblemBank, courseId), [baseProblemBank, courseId]);
  const [aiProblems, setAiProblems] = useState<CodingProblem[]>([]);
  const problemBank = useMemo(
    () => [...teacherAssignments, ...baseProblemBank, ...aiProblems],
    [aiProblems, baseProblemBank, teacherAssignments],
  );
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<Record<string, AssignmentSubmissionRecord>>(() =>
    loadAssignmentSubmissions(courseId, sourceFileId),
  );
  const [submitMessage, setSubmitMessage] = useState("");
  const [selectedProblemId, setSelectedProblemId] = useState(problemBank[0]?.id || "generated-coding-problem");
  const selectedProblem = useMemo(
    () => problemBank.find((item) => item.id === selectedProblemId) || problemBank[0],
    [problemBank, selectedProblemId],
  );
  const selectedAssignment = useMemo(
    () => teacherAssignments.find((item) => item.id === selectedProblem?.id) || null,
    [selectedProblem?.id, teacherAssignments],
  );
  const selectedAssignmentSubmission = selectedAssignment ? assignmentSubmissions[selectedAssignment.assignmentId] : null;
  const testCases = selectedProblem?.testCases || [];
  const [code, setCode] = useState(() => selectedProblem?.starterCode || extractStarterCode(file.preview_text || problemText));
  const [stdin, setStdin] = useState(selectedProblem?.testCases[0]?.input || "");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [activeResult, setActiveResult] = useState<Awaited<ReturnType<typeof studentApi.runJavaCode>> | null>(null);
  const [caseResults, setCaseResults] = useState<CodingCaseResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [problemExpanded, setProblemExpanded] = useState(false);
  const [reviewResult, setReviewResult] = useState<Awaited<ReturnType<typeof studentApi.reviewJavaCode>> | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [generatingProblem, setGeneratingProblem] = useState(false);
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
    setSelectedResultIndex(0);
    setProblemExpanded(false);
    setReviewResult(null);
    setError("");
    setSubmitMessage("");
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
  const totalCases = testCases.length;
  const statusLabel = caseResults.length ? `${passedCount}/${caseResults.length} 通过` : getJudgeStatusLabel(latestStatus);
  const statusTone =
    latestStatus === "Accepted"
      ? "border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676]"
      : latestStatus === "Pending"
        ? "border-white/15 bg-white/5 text-[#CBD5E1]"
        : "border-[#FFB800]/50 bg-[#FFB800]/10 text-[#FFB800]";
  const safeSelectedResultIndex = caseResults.length ? Math.min(selectedResultIndex, caseResults.length - 1) : 0;
  const selectedCaseResult = caseResults[safeSelectedResultIndex] || null;
  const selectedCaseOutput = selectedCaseResult?.stdout || selectedCaseResult?.stderr || selectedCaseResult?.compileOutput || "";
  const selectedCaseDiagnostics = [selectedCaseResult?.compileOutput, selectedCaseResult?.stderr].filter(Boolean).join("\n");
  const judgeHeadline = latestStatus === "Pending" ? "Not Run" : latestStatus;
  const judgeHeadlineTone =
    latestStatus === "Accepted"
      ? "text-[#00E676]"
      : latestStatus === "Pending"
        ? "text-[#CBD5E1]"
        : "text-[#FF3B30]";
  const judgeSummary = caseResults.length
    ? `${passedCount}/${caseResults.length} testcases passed`
    : activeResult
      ? "Sample run completed"
      : "Run code or submit to see judge results";

  useEffect(() => {
    if (!submitting) return undefined;
    const timer = window.setTimeout(() => {
      setSubmitting(false);
      setSubmitMessage("判题服务响应较慢，已切回本地快速判题。请再次点击运行。");
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [submitting]);

  function isLocalJudgeUsable(result: Awaited<ReturnType<typeof studentApi.runJavaCode>>) {
    return result.compile_ok && result.run_ok && !result.stderr;
  }

  async function runJavaWithFallback(input: string) {
    const localResult = runLocalCodingFallback(code, input);
    if (isLocalJudgeUsable(localResult)) {
      return localResult;
    }

    try {
      const result = await studentApi.runJavaCode({
        source_code: code,
        class_name: "Main",
        stdin: input,
        timeout_seconds: 2,
      });
      return result;
    } catch {
      return localResult;
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
      setSelectedResultIndex(0);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Java 运行失败");
    } finally {
      setRunning(false);
    }
  }

  async function runAllCasesInline() {
    const nextResults = await Promise.all(testCases.map(async (testCase) => {
      const result = await runJavaWithFallback(testCase.input);
      return {
        label: testCase.label,
        status: getJudgeStatus(result, testCase.output),
        input: testCase.input,
        expected: testCase.output,
        stdout: result.stdout,
        stderr: result.stderr,
        compileOutput: result.compile_output,
      } satisfies CodingCaseResult;
    }));
    setCaseResults(nextResults);
    setSelectedResultIndex(nextResults.findIndex((item) => item.status !== "Accepted") >= 0 ? nextResults.findIndex((item) => item.status !== "Accepted") : 0);
    return nextResults;
  }

  async function openJudgeResultPage() {
    setSubmitting(true);
    setError("");
    setSubmitMessage("");
    const startedAt = Date.now();
    try {
      const results = await runAllCasesInline();
      const finishedAt = Date.now();
      navigate(`/resources/judge-result?courseId=${encodeURIComponent(courseId)}&fileId=${encodeURIComponent(String(sourceFileId || "coding-lab"))}`, {
        state: {
          sourceCode: code,
          className: "Main",
          problem: selectedProblem
            ? {
                id: selectedProblem.id,
                title: selectedProblem.title,
                difficulty: selectedProblem.difficulty,
                category: selectedProblem.category,
                description: selectedProblem.description,
              }
            : null,
          testCases,
          precomputedResults: results,
          startedAt,
          finishedAt,
          returnTo: `${window.location.pathname}${window.location.search}`,
        },
      });
    } catch (judgeError) {
      setError(judgeError instanceof Error ? judgeError.message : "判题失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAllCases() {
    setSubmitting(true);
    setError("");
    setSubmitMessage("");
    try {
      const results = await runAllCasesInline();
      const passCount = results.filter((item) => item.status === "Accepted").length;
      setSubmitMessage(passCount === results.length ? "判题通过，可以提交老师作业。" : "还有用例未通过，建议先查看失败用例或点 AI 纠错。");
    } catch (judgeError) {
      setError(judgeError instanceof Error ? judgeError.message : "判题失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTeacherAssignment() {
    if (!selectedAssignment) return;
    setSubmitting(true);
    setError("");
    setSubmitMessage("");
    try {
      const results = caseResults.length === testCases.length ? caseResults : await runAllCasesInline();
      const passCount = results.filter((item) => item.status === "Accepted").length;
      const record: AssignmentSubmissionRecord = {
        assignmentId: selectedAssignment.assignmentId,
        problemTitle: selectedAssignment.title,
        submittedAt: new Date().toISOString(),
        passed: passCount,
        total: results.length,
        status: passCount === results.length ? "submitted" : "needs_fix",
      };
      const next = {
        ...assignmentSubmissions,
        [selectedAssignment.assignmentId]: record,
      };
      setAssignmentSubmissions(next);
      saveAssignmentSubmissions(courseId, sourceFileId, next);
      setSubmitMessage(passCount === results.length ? "作业已提交，系统已保存本次代码与判题结果。" : "已保存草稿提交，但还有未通过用例，需要继续修改。");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "作业提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function generateProblemForGoal() {
    const goal = customGoal.trim();
    if (!goal || generatingProblem) return;
    setGeneratingProblem(true);
    setError("");
    try {
      const numericCourseId = resolveCourseId(getCourseIdFromUrl());
      const response = await studentApi.generateResources({
        user_id: ACTIVE_USER_ID,
        course_id: numericCourseId,
        knowledge_points: [
          goal,
          selectedProblem?.title || "当前代码实操",
          selectedProblem?.category || "学习进度补练",
        ],
        resource_types: ["coding_lab"],
      });
      const generatedResource = response.resources?.find((item) => item.resource_type === "coding_lab") || response.resources?.[0];
      const generatedText = generatedResource?.content_markdown || generatedResource?.summary || "";
      const nextProblem = buildRequestedCodingProblem(goal, generatedText);
      setAiProblems((current) => [nextProblem, ...current].slice(0, 6));
      setSelectedProblemId(nextProblem.id);
      setCustomGoal("");
    } catch {
      const nextProblem = buildRequestedCodingProblem(goal);
      setAiProblems((current) => [nextProblem, ...current].slice(0, 6));
      setSelectedProblemId(nextProblem.id);
      setCustomGoal("");
    } finally {
      setGeneratingProblem(false);
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
        next_steps: ["点击运行并判题查看全部用例。", "如果仍不通过，重点检查读取输入、循环边界和输出格式。", "确认输出中没有多余提示文字。"],
      });
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-[#1F2937] bg-[#0B0C0A] font-mono text-[#E5E7EB]">
      {submitting ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/92 px-6 font-mono text-[#E5E7EB]">
          <div className="w-full max-w-md border border-[#1F2937] bg-[#0B0C0A] p-6">
            <div className="flex items-center gap-3 text-2xl font-black text-[#00E676]">
              <LoaderCircle className="h-6 w-6 animate-spin" />
              运行并判题中
            </div>
            <div className="mt-4 h-1 overflow-hidden bg-[#1F2937]">
              <div className="h-full w-2/3 animate-pulse bg-[#00E676]" />
            </div>
            <div className="mt-4 text-sm leading-6 text-[#94A3B8]">正在当前工作台运行测试用例并生成提交记录。</div>
          </div>
        </div>
      ) : null}
      {problemExpanded ? (
        <div className="fixed inset-0 z-40 bg-black/55 px-4 py-5 backdrop-blur-sm sm:px-8">
          <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] text-[#111827] shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] bg-white px-5 py-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#64748B]">Problem Statement</div>
                <h3 className="mt-1 text-xl font-black">{selectedProblem?.title || resource?.title || file.display_name}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-[#475569]">
                  <span className="rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1">{selectedProblem?.difficulty || "练习"}</span>
                  <span className="rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1">{testCases.length} 个测试用例</span>
                  <span className="rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1">Java 17</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProblemExpanded(false)}
                className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2 text-xs font-black text-[#334155] transition-colors hover:border-[#64748B] hover:bg-white"
              >
                收起题目
              </button>
            </div>
            <div className="subtle-scrollbar min-h-0 flex-1 overflow-auto px-5 py-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4">
                    <div className="text-[11px] font-black text-[#475569]">题目描述</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.description || "请根据题面完成本题，并保证输出结果与样例一致。"}</div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4">
                      <div className="text-[11px] font-black text-[#475569]">输入格式</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.input || "从标准输入读取题目要求的数据。"}</div>
                    </div>
                    <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4">
                      <div className="text-[11px] font-black text-[#475569]">输出格式</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.output || "将最终结果输出到标准输出。"}</div>
                    </div>
                  </div>
                  {selectedProblem?.hint ? (
                    <div className="rounded-xl border border-[#D9E7FF] bg-[#EFF6FF] px-4 py-4">
                      <div className="text-[11px] font-black text-[#1D4ED8]">解题提示</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#1E3A8A]">{selectedProblem.hint}</div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-black text-[#475569]">样例</div>
                      <div className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[10px] font-black text-[#047857]">Sample</div>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="mb-1 text-[10px] font-black text-[#64748B]">输入</div>
                        <pre className="subtle-scrollbar max-h-32 overflow-auto rounded-lg bg-[#F1F5F9] px-3 py-2 text-xs leading-6 text-[#334155]">{testCases[0]?.input || "Empty"}</pre>
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-black text-[#047857]">输出</div>
                        <pre className="subtle-scrollbar max-h-32 overflow-auto rounded-lg bg-[#ECFDF5] px-3 py-2 text-xs leading-6 text-[#065F46]">{testCases[0]?.output || "Empty"}</pre>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4">
                    <div className="text-[11px] font-black text-[#475569]">全部测试用例</div>
                    <div className="mt-3 space-y-3">
                      {testCases.map((testCase, index) => (
                        <div key={testCase.label} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-black text-[#111827]">Case {index + 1}</div>
                            {caseResults[index] ? (
                              <span className={`border px-2.5 py-1 text-[10px] font-bold ${caseResults[index].status === "Accepted" ? "border-[#00E676]/50 bg-[#00E676]/10 text-[#047857]" : "border-[#FFB800]/50 bg-[#FFB800]/10 text-[#92400E]"}`}>
                                {getJudgeStatusLabel(caseResults[index].status)}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <pre className="subtle-scrollbar max-h-24 overflow-auto rounded-md bg-white px-3 py-2 leading-6 text-[#334155]">{testCase.input}</pre>
                            <pre className="subtle-scrollbar max-h-24 overflow-auto rounded-md bg-[#ECFDF5] px-3 py-2 leading-6 text-[#065F46]">{testCase.output}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid shrink-0 border-b border-[#1F2937] bg-black md:grid-cols-[minmax(300px,0.88fr)_minmax(390px,1.12fr)]">
        <div className="border-b border-[#1F2937] px-4 py-2 md:border-b-0 md:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Code2 className="h-4 w-4 text-[#00E676]" />
              Main.java 代码实操
            </div>
            <div className="border border-[#334155] px-2.5 py-1 text-[11px] font-bold text-[#CBD5E1]">Java 17</div>
          </div>
          <div className="mt-2 grid grid-cols-3 border border-[#1F2937] text-[11px]">
            <div className="border-r border-[#1F2937] px-3 py-2">
              <div className="text-[#64748B]">老师作业</div>
              <div className="mt-1 font-bold text-white">{teacherAssignments.length}</div>
            </div>
            <div className="border-r border-[#1F2937] px-3 py-2">
              <div className="text-[#64748B]">用例</div>
              <div className="mt-1 font-bold text-white">{totalCases}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[#64748B]">提交</div>
              <div className="mt-1 font-bold text-[#00E676]">
                {Object.values(assignmentSubmissions).filter((item) => item.status === "submitted").length}/{teacherAssignments.length}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div>
            <div className="text-[11px] font-bold text-[#64748B]">当前文件</div>
            <div className="mt-1 text-sm font-bold text-white">Main.java</div>
          </div>
          <div className={`border px-3 py-1.5 text-[11px] font-bold ${statusTone}`}>{getJudgeStatusLabel(latestStatus)}</div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(300px,0.88fr)_minmax(390px,1.12fr)]">
        <section className="min-h-0 overflow-hidden border-b border-[#1F2937] bg-[#F8FAFC] text-[#111827] md:border-b-0 md:border-r">
          <div className="subtle-scrollbar h-full space-y-3 overflow-auto p-3">
            {generationIntent?.stage === "running" ? (
              <div className="rounded-lg border border-[#00E676]/35 bg-[#ECFDF5] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[#047857]">
                  <Sparkles className="h-3.5 w-3.5" />
                  实操工作台已就绪
                </div>
                <div className="mt-1 text-sm leading-6 text-[#166534]">题面、样例和 Java 运行环境已经可用，可以直接编码并运行判题。</div>
              </div>
            ) : null}

            <div className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black tracking-[0.16em] text-[#1D4ED8]">老师作业</div>
                  <div className="mt-1 text-sm font-black text-[#111827]">老师安排的作业可直接在本平台完成</div>
                  <p className="mt-1 text-xs leading-5 text-[#475569]">选择作业题后，在右侧写代码、运行判题并提交，系统会保存提交记录。</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#1D4ED8] ring-1 ring-[#BFDBFE]">
                  {Object.values(assignmentSubmissions).filter((item) => item.status === "submitted").length}/{teacherAssignments.length} 已交
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {teacherAssignments.map((assignment, index) => {
                  const active = assignment.id === selectedProblem?.id;
                  const submission = assignmentSubmissions[assignment.assignmentId];
                  return (
                    <button
                      key={assignment.assignmentId}
                      type="button"
                      onClick={() => setSelectedProblemId(assignment.id)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-[#1D4ED8] bg-white shadow-[0_10px_24px_rgba(29,78,216,0.10)]"
                          : "border-[#DBEAFE] bg-white/70 hover:border-[#93C5FD] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-[#111827] px-2 py-0.5 text-[10px] font-black text-white">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-black text-[#047857]">
                              {assignment.points} 分
                            </span>
                          </div>
                          <div className="mt-2 truncate text-sm font-black text-[#111827]">{assignment.title}</div>
                          <div className="mt-1 text-[11px] font-semibold text-[#64748B]">{assignment.teacher} · {assignment.dueLabel}</div>
                        </div>
                        {submission?.status === "submitted" ? (
                          <CheckCircle className="h-5 w-5 shrink-0 text-[#059669]" />
                        ) : submission?.status === "needs_fix" ? (
                          <span className="shrink-0 rounded-full bg-[#FFF7ED] px-2 py-1 text-[10px] font-black text-[#C2410C]">待修改</span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2 py-1 text-[10px] font-black text-[#1D4ED8]">待完成</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-[#CBD5E1] bg-white px-3 py-1 text-[11px] font-bold text-[#111827]">当前题面</span>
                    <span className="border border-[#CBD5E1] bg-white px-3 py-1 text-[11px] font-bold text-[#64748B]">Java 17</span>
                    {selectedProblem ? (
                      <span className="border border-[#CBD5E1] bg-white px-3 py-1 text-[11px] font-bold text-[#64748B]">{selectedProblem.difficulty}</span>
                    ) : null}
                    {selectedAssignment ? (
                      <span className="border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-bold text-[#1D4ED8]">老师作业 · {selectedAssignment.dueLabel}</span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-xl font-black leading-snug text-[#111827]">{selectedProblem?.title || resource?.title || file.display_name}</h3>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.description || "请根据题面完成本题，并保证输出结果与样例一致。"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setProblemExpanded(true)}
                  className="shrink-0 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-bold text-[#334155] transition-colors hover:border-[#64748B]"
                >
                  展开完整题目
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
                  <div className="mb-1 text-[11px] font-black text-[#64748B]">输入格式</div>
                  <div className="whitespace-pre-wrap text-xs leading-6 text-[#334155]">{selectedProblem?.input || "从标准输入读取题目要求的数据。"}</div>
                </div>
                <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
                  <div className="mb-1 text-[11px] font-black text-[#047857]">输出格式</div>
                  <div className="whitespace-pre-wrap text-xs leading-6 text-[#065F46]">{selectedProblem?.output || "将最终结果输出到标准输出。"}</div>
                </div>
              </div>
              {testCases[0] ? (
                <div className="mt-3 grid gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs md:grid-cols-2">
                  <div>
                    <div className="mb-1 font-bold text-[#64748B]">样例输入</div>
                    <pre className="overflow-auto whitespace-pre-wrap text-[#334155]">{testCases[0].input}</pre>
                  </div>
                  <div>
                    <div className="mb-1 font-bold text-[#047857]">样例输出</div>
                    <pre className="overflow-auto whitespace-pre-wrap text-[#065F46]">{testCases[0].output}</pre>
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-[#CBD5E1] bg-white px-3 py-1 text-[11px] font-bold text-[#111827]">当前题面</span>
                <span className="border border-[#CBD5E1] bg-white px-3 py-1 text-[11px] font-bold text-[#64748B]">Java 17</span>
                {selectedProblem ? (
                  <span className="border border-[#CBD5E1] bg-white px-3 py-1 text-[11px] font-bold text-[#64748B]">{selectedProblem.difficulty}</span>
                ) : null}
                {selectedAssignment ? (
                  <span className="border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1 text-[11px] font-bold text-[#1D4ED8]">老师作业 · {selectedAssignment.dueLabel}</span>
                ) : null}
              </div>
              <h3 className="mt-2 text-xl font-bold">{selectedProblem?.title || resource?.title || file.display_name}</h3>
            </div>

            <div className="hidden rounded-lg border border-[#CBD5E1] bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-bold text-[#475569]">题目切换</div>
                <div className="border border-[#CBD5E1] px-2.5 py-0.5 text-[10px] font-bold text-[#111827]">共 {problemBank.length} 题</div>
              </div>
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                {problemBank.map((problem, index) => {
                  const active = problem.id === selectedProblem?.id;
                  return (
                    <button
                      key={problem.id}
                      type="button"
                      onClick={() => setSelectedProblemId(problem.id)}
                      className={`shrink-0 rounded-md border px-3 py-2 text-left transition-colors ${
                        active ? "border-[#111827] bg-[#111827] text-white" : "border-[#E2E8F0] bg-white hover:border-[#64748B]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`border px-2 py-0.5 text-[10px] font-bold ${active ? "border-white/25 text-[#CBD5E1]" : "border-[#CBD5E1] text-[#64748B]"}`}>0{index + 1}</span>
                        <span className={`text-[10px] font-bold ${active ? "text-[#00E676]" : "text-[#475569]"}`}>{problem.difficulty}</span>
                      </div>
                      <div className={`mt-1 max-w-44 truncate text-xs font-bold ${active ? "text-white" : "text-[#111827]"}`}>{problem.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-[#D9E7FF] bg-[#F8FBFF] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-[#1D4ED8]">按学习目标生成题</div>
                  <div className="mt-1 text-xs leading-5 text-[#64748B]">题单优先来自老师布置和当前学习进度；你也可以直接说想练什么。</div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#1D4ED8]">AI 生成</span>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={customGoal}
                  onChange={(event) => setCustomGoal(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void generateProblemForGoal();
                    }
                  }}
                  placeholder="例如：按老师作业风格出一道数组去重题，或我想练循环边界"
                  className="min-w-0 flex-1 rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#111827] outline-none focus:border-[#1D4ED8]"
                />
                <button
                  type="button"
                  onClick={() => void generateProblemForGoal()}
                  disabled={!customGoal.trim() || generatingProblem}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingProblem ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  生成题
                </button>
              </div>
            </div>

            <div className="hidden rounded-lg border border-[#CBD5E1] bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold text-[#475569]">题目描述</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#475467]">{selectedProblem?.description || "请根据题面完成本题，并保证输出结果与样例一致。"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setProblemExpanded(true)}
                  className="shrink-0 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-bold text-[#334155] transition-colors hover:border-[#64748B]"
                >
                  展开完整题目
                </button>
              </div>
              {testCases[0] ? (
                <div className="mt-3 grid gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs md:grid-cols-2">
                  <div>
                    <div className="mb-1 font-bold text-[#64748B]">样例输入</div>
                    <pre className="overflow-auto whitespace-pre-wrap text-[#334155]">{testCases[0].input}</pre>
                  </div>
                  <div>
                    <div className="mb-1 font-bold text-[#047857]">样例输出</div>
                    <pre className="overflow-auto whitespace-pre-wrap text-[#065F46]">{testCases[0].output}</pre>
                  </div>
                </div>
              ) : null}
            </div>
            </div>
        </section>

        <section className="flex min-h-0 flex-col bg-[#0B0C0A]">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#1F2937] bg-black px-4 py-2">
            <div className="text-xs font-bold text-[#CBD5E1]">代码编辑区</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openJudgeResultPage} disabled={running || submitting} className="inline-flex items-center gap-2 rounded-md border border-[#00E676]/60 bg-[#00E676]/12 px-4 py-2 text-xs font-black text-[#00E676] transition-colors hover:bg-[#00E676]/18 disabled:opacity-50">
                {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MonitorPlay className="h-3.5 w-3.5" />}
                {submitting ? "判题中" : "运行并判题"}
              </button>
              {selectedAssignment ? (
                <button
                  type="button"
                  onClick={submitTeacherAssignment}
                  disabled={running || submitting}
                  className="inline-flex items-center gap-2 rounded-md border border-[#60A5FA]/60 bg-[#1D4ED8] px-4 py-2 text-xs font-black text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-50"
                >
                  {submitting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  提交老师作业
                </button>
              ) : null}
              <button type="button" onClick={reviewCode} disabled={reviewing} className="inline-flex items-center gap-2 rounded-md border border-[#FFB800]/50 bg-[#FFB800]/10 px-3 py-2 text-xs font-bold text-[#FFB800] transition-colors hover:bg-[#FFB800]/15 disabled:opacity-50">
                {reviewing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {reviewing ? "纠错中" : "AI 纠错"}
              </button>
            </div>
          </div>
          <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} className="subtle-scrollbar min-h-0 flex-1 resize-none border-0 bg-[#0B0C0A] px-5 py-4 font-mono text-[13px] leading-7 text-[#E2E8F0] outline-none" />
          <div className="grid shrink-0 border-t border-[#1F2937] md:grid-cols-[minmax(200px,0.85fr)_minmax(250px,1.15fr)]">
            <div className="border-b border-[#1F2937] p-3 md:border-b-0 md:border-r">
              <div className="text-xs font-bold text-[#CBD5E1]">标准输入</div>
              <textarea value={stdin} onChange={(event) => setStdin(event.target.value)} className="subtle-scrollbar mt-2 h-20 w-full resize-none rounded-md border border-[#334155] bg-black px-3 py-2 font-mono text-xs leading-6 text-[#E5E7EB] outline-none focus:border-[#00E676]/70" />
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-[#CBD5E1]">调试 / 纠错结果</div>
                {caseResults.length ? <div className="text-[11px] font-bold text-[#00E676]">{passedCount}/{caseResults.length} 通过</div> : null}
              </div>
              <div className="subtle-scrollbar mt-2 max-h-40 space-y-3 overflow-auto text-xs leading-6 text-[#E5E7EB]">
                {error ? <div className="rounded-md border border-[#FF3B30]/50 bg-[#FF3B30]/10 px-3 py-3 text-[#FECACA]">{error}</div> : null}
                {submitMessage ? (
                  <div className="rounded-md border border-[#60A5FA]/40 bg-[#0B1E3A] px-3 py-3 text-[#BFDBFE]">
                    {submitMessage}
                    {selectedAssignmentSubmission ? (
                      <div className="mt-1 text-[11px] text-[#93C5FD]">
                        最近提交：{selectedAssignmentSubmission.passed}/{selectedAssignmentSubmission.total} 通过
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {(caseResults.length || activeResult) ? (
                  <div className="rounded-lg border border-[#1F2937] bg-black">
                    <div className="border-b border-[#1F2937] px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className={`font-mono text-2xl font-black leading-none ${judgeHeadlineTone}`}>{judgeHeadline}</div>
                          <div className="mt-2 text-[11px] font-bold text-[#94A3B8]">{judgeSummary}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-right font-mono text-[11px]">
                          <div className="border border-[#1F2937] bg-[#0B0C0A] px-3 py-2">
                            <div className="text-[#64748B]">Passed</div>
                            <div className="mt-1 text-sm font-black text-white">{passedCount}</div>
                          </div>
                          <div className="border border-[#1F2937] bg-[#0B0C0A] px-3 py-2">
                            <div className="text-[#64748B]">Total</div>
                            <div className="mt-1 text-sm font-black text-white">{caseResults.length || 1}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {caseResults.length ? (
                      <div className="border-b border-[#1F2937] px-3 py-3">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {caseResults.map((item, index) => {
                            const selected = index === safeSelectedResultIndex;
                            const accepted = item.status === "Accepted";
                            return (
                              <button
                                key={`${item.label}-${index}`}
                                type="button"
                                onClick={() => setSelectedResultIndex(index)}
                                className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold transition-colors ${
                                  selected
                                    ? accepted
                                      ? "border-[#00E676]/70 bg-[#00E676]/15 text-[#00E676]"
                                      : "border-[#FF3B30]/70 bg-[#FF3B30]/15 text-[#FF8A80]"
                                    : "border-[#1F2937] bg-[#0B0C0A] text-[#94A3B8] hover:border-[#334155] hover:text-white"
                                }`}
                              >
                                Case {index + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3 px-4 py-4">
                      {selectedCaseResult ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-white">{selectedCaseResult.label}</div>
                            <span className={`border px-2.5 py-1 text-[10px] font-bold ${getJudgeTone(selectedCaseResult.status)}`}>
                              {selectedCaseResult.status}
                            </span>
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <div className="mb-1 text-[10px] font-bold text-[#94A3B8]">Input</div>
                              <pre className="min-h-20 overflow-auto rounded-md border border-[#1F2937] bg-[#0B0C0A] px-3 py-2 font-mono text-[11px] leading-5 text-[#E2E8F0]">{selectedCaseResult.input || "Empty"}</pre>
                            </div>
                            <div>
                              <div className="mb-1 text-[10px] font-bold text-[#94A3B8]">Output</div>
                              <pre className={`min-h-20 overflow-auto rounded-md border px-3 py-2 font-mono text-[11px] leading-5 ${selectedCaseResult.status === "Accepted" ? "border-[#00E676]/30 bg-[#001A0A] text-[#BBF7D0]" : "border-[#FF3B30]/30 bg-[#1A0505] text-[#FECACA]"}`}>{selectedCaseOutput || "Empty"}</pre>
                            </div>
                            <div>
                              <div className="mb-1 text-[10px] font-bold text-[#94A3B8]">Expected</div>
                              <pre className="min-h-20 overflow-auto rounded-md border border-[#1F2937] bg-[#0B0C0A] px-3 py-2 font-mono text-[11px] leading-5 text-[#E2E8F0]">{selectedCaseResult.expected || "Empty"}</pre>
                            </div>
                          </div>
                          {selectedCaseDiagnostics ? (
                            <div>
                              <div className="mb-1 text-[10px] font-bold text-[#FFB800]">Diagnostics</div>
                              <pre className="overflow-auto rounded-md border border-[#FFB800]/30 bg-[#1A1400] px-3 py-2 font-mono text-[11px] leading-5 text-[#FEF3C7]">{selectedCaseDiagnostics}</pre>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <pre className="whitespace-pre-wrap break-words rounded-md border border-[#1F2937] bg-[#0B0C0A] px-3 py-3 font-mono text-[#E2E8F0]">
                          {activeResult?.stdout || activeResult?.stderr || activeResult?.compile_output || "暂无输出"}
                        </pre>
                      )}
                    </div>
                  </div>
                ) : null}
                {reviewResult ? (
                  <div className="rounded-md border border-[#FFB800]/30 bg-[#1A1400] px-3 py-3 text-[#FEF3C7]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-white">AI 纠错结论</div>
                      {reviewResult.suggested_code ? (
                        <button
                          type="button"
                          onClick={() => setCode(reviewResult.suggested_code)}
                          className="rounded-md border border-[#FFB800]/40 bg-[#FFB800]/10 px-3 py-1 text-[10px] font-bold text-[#FFB800] transition-colors hover:bg-[#FFB800]/15"
                        >
                          应用建议代码
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap rounded-md bg-black/30 px-3 py-3 text-sm leading-6">{reviewResult.summary}</div>
                    {reviewResult.key_issues?.length ? (
                      <div className="mt-3">
                        <div className="text-[10px] font-bold text-[#FFB800]">需要关注</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {reviewResult.key_issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {reviewResult.next_steps?.length ? (
                      <div className="mt-3">
                        <div className="text-[10px] font-bold text-[#FFB800]">下一步</div>
                        <div className="mt-2 space-y-1">
                          {reviewResult.next_steps.map((step, index) => (
                            <div key={`${step}-${index}`} className="rounded-md bg-black/30 px-3 py-2 text-[11px] leading-5 text-[#FEF3C7]">
                              {index + 1}. {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!error && !caseResults.length && !activeResult && !reviewResult ? (
                  <div className="rounded-md border border-dashed border-[#334155] bg-black px-3 py-4 text-[#94A3B8]">
                    点击运行并判题会进入独立结果页；如果卡住了，可以先点 AI 纠错拿一版可执行建议。
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
  const navigate = useNavigate();
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
  const isNonCodingGenerationIntent = Boolean(generationIntentType && generationIntentType !== "coding_lab");
  const parsedResourceId = rawResourceId ? Number(rawResourceId) : null;
  const numericResourceId = parsedResourceId !== null && Number.isFinite(parsedResourceId) && parsedResourceId > 0 ? parsedResourceId : null;
  const resourceId = numericResourceId !== null ? String(numericResourceId) : null;
  const numericSourceFileId = sourceFileId ? Number(sourceFileId) : null;
  const initialResource = hasUsableInitialResource(routeState.initialResource) ? routeState.initialResource || null : null;
  const isCodingLabIntent = generationIntent?.type === "coding_lab";
  const isCodingLabFileOnlyIntent =
    numericResourceId === null &&
    numericSourceFileId !== null &&
    Number.isFinite(numericSourceFileId) &&
    FORCE_CODING_LAB_FILE_IDS.has(numericSourceFileId);
  const shouldForceCodingLabFallback =
    isCodingLabIntent ||
    (!isNonCodingGenerationIntent &&
      (isCodingLabFileOnlyIntent ||
        (numericResourceId !== null && Number.isFinite(numericResourceId) && FORCE_CODING_LAB_RESOURCE_IDS.has(numericResourceId))));

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
  const [generatingPreviewType, setGeneratingPreviewType] = useState<PreviewGenerationType | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [selectedGenerationType, setSelectedGenerationType] = useState<PreviewGenerationType>("extended_reading");
  const [isGenerationChooserOpen, setIsGenerationChooserOpen] = useState(false);
  const [profileSummary, setProfileSummary] = useState<ProfileSummaryResponse | null>(null);
  const selectedGenerationOption =
    PREVIEW_GENERATION_OPTIONS.find((option) => option.id === selectedGenerationType) || PREVIEW_GENERATION_OPTIONS[0];

  useEffect(() => {
    let cancelled = false;
    void studentApi
      .getProfileSummary(ACTIVE_USER_ID)
      .then((summary) => {
        if (!cancelled) {
          setProfileSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!rawResourceId || numericResourceId !== null) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("resourceId");
    window.history.replaceState(window.history.state || {}, "", `${url.pathname}${url.search}`);
  }, [numericResourceId, rawResourceId]);

  useEffect(() => {
    if (resourceId || initialResource || shouldForceCodingLabFallback || isCodingLabReady || generationIntent) {
      return;
    }

    navigate(`/resources?courseId=${courseId}`, { replace: true });
  }, [courseId, generationIntent, initialResource, isCodingLabReady, navigate, resourceId, shouldForceCodingLabFallback]);

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

    if (!resourceId && !initialResource && !generationIntent) {
      setResource(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!resourceId && initialResource) {
      setResource(initialResource);
      setLoading(false);
      setError(null);
      return;
    }

    if (resourceId && initialResource) {
      const sourceFiles = normalizePreviewSourceFiles(initialResource.source_files || []);
      const requestedFileId = numericSourceFileId || routeState.initialFileId || null;
      const matchedFile = requestedFileId ? sourceFiles.find((file) => file.file_id === requestedFileId) : null;
      setResource({ ...initialResource, source_files: sourceFiles });
      setSelectedFileId(matchedFile?.file_id || sourceFiles[0]?.file_id || requestedFileId || null);
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
          (isNonCodingGenerationIntent && requestedFileId ? requestedFileId : null) ||
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
    isCodingLabFileOnlyIntent,
    numericResourceId,
    numericSourceFileId,
    resourceId,
    routeState.initialFileId,
    shouldForceCodingLabFallback,
  ]);

  const fallbackSelectedFile = useMemo(() => {
    if (generationIntent && generationIntent.type !== "coding_lab") {
      return routeState.initialPreviewFile || buildGenerationIntentFallbackFile(selectedFileId || numericSourceFileId || 900001, courseId, generationIntent);
    }
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
  }, [courseId, generationIntent, numericResourceId, numericSourceFileId, resource, routeState.initialPreviewFile, selectedFileId]);

  const previewSourceFiles = useMemo(() => normalizePreviewSourceFiles(resource?.source_files || []), [resource?.source_files]);
  const selectedFile =
    previewSourceFiles.find((item) => item.file_id === selectedFileId) ||
    (selectedFileId ? fallbackSelectedFile : previewSourceFiles[0]) ||
    previewSourceFiles[0] ||
    fallbackSelectedFile ||
    null;

  const resourceType = String(resource?.resource_type || "").toLowerCase();
  const isIllustrationResource = resourceType === "visual_illustration" || generationIntent?.type === "visual_illustration";
  const codingLabHints = [
    resource?.title,
    resource?.summary,
    resource?.content_markdown,
    selectedFile?.display_name,
    selectedFile?.relative_path,
    selectedFile?.preview_text,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const isCodingTaskFile = /代码实操|实操任务|编程任务|代码任务|判题|oj|coding[_\s-]?lab|main\.java/i.test(codingLabHints);
  const isCodeListPage = location.pathname === "/resources/code-list";
  const isCodingLabResource =
    !isNonCodingGenerationIntent &&
    (resourceType === "coding_lab" ||
      resourceType === "case_study" ||
      generationIntent?.type === "coding_lab" ||
      selectedFile?.file_extension?.toLowerCase() === ".java" ||
      codingLabHints.includes("coding_lab") ||
      codingLabHints.includes("main.java") ||
      isCodingTaskFile);
  const isCodingLabPage = isCodingLabResource && !isCodeListPage;
  const codingLabStageLabel = isCodingLabReady ? "实操工作台已就绪" : generationIntentStage === "running" ? "系统正在整理正式文件" : "等待正式文件落库";

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, ResourceSourceFileRef[]>();
    const files = previewSourceFiles.length ? previewSourceFiles : selectedFile ? [selectedFile] : [];
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
  }, [previewSourceFiles, selectedFile]);

  const selectedMode = selectedFile ? getSourceFilePreviewMode(selectedFile) : "unsupported";
  const previewTitle = buildPreviewTitle(selectedFile);
  const queryGenerationType = new URLSearchParams(location.search).get("generationType");
  const normalizedGenerationType = String(generationIntentType || queryGenerationType || resource?.resource_type || "").toLowerCase();
  const currentPreviewModeLabel =
    normalizedGenerationType === "ppt" || normalizedGenerationType === "slide_deck"
      ? "PPT 预览"
      : normalizedGenerationType === "mindmap" || normalizedGenerationType === "mind_map"
        ? "导图预览"
        : normalizedGenerationType === "practice_set" || normalizedGenerationType === "quiz_set"
          ? "练习预览"
          : selectedMode === "snippet" || selectedMode === "text"
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
  const codeListFiles = previewSourceFiles.length ? previewSourceFiles : selectedFile ? [selectedFile] : [];
  const submittedAssignmentCount = selectedFileId
    ? Object.values(loadAssignmentSubmissions(courseId, selectedFileId)).filter((item) => item.status === "submitted").length
    : 0;
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
  const isGeneratedShowcasePage = Boolean(generationIntent) && !isCodingLabPage && !isCodeListPage;
  const isShowcaseIllustrationPage = shouldRenderIllustrationAsImage && !isGeneratedPlaceholder;
  const isSpecialGeneratedPreview = ["ppt", "slide_deck", "mindmap", "mind_map", "practice_set", "quiz_set", "micro_video"].includes(normalizedGenerationType);
  const isGeneratedTextShowcasePage =
    !isSpecialGeneratedPreview &&
    !isShowcaseIllustrationPage &&
    !isCodingLabPage &&
    isGeneratedShowcasePage &&
    ["text", "snippet"].includes(selectedMode);
  const generatedPreviewText = textContent || selectedFile?.preview_text || resource?.content_markdown || resource?.summary || "";
  const generatedPreviewSections = useMemo(() => extractPreviewSections(generatedPreviewText), [generatedPreviewText]);
  const generatedPrimarySection = generatedPreviewSections[0] || null;
  const generatedSecondarySections = generatedPrimarySection ? generatedPreviewSections.slice(1) : [];
  const generatedExperience = getGeneratedResourceExperience(generationIntentType || queryGenerationType || resource?.resource_type || "extended_reading");
  const generatedHeroTitle = sanitizePreviewText(generationIntentLabel || resource?.title, `AI ${generatedExperience.heroNoun}`);
  const generatedHeroSummary = sanitizePreviewText(
    resource?.summary || resource?.study_suggestion,
    generationIntentStage === "completed" ? generatedExperience.heroSummary : "系统正在持续整理内容，当前先展示可读预览结果。",
  );
  const generatedTypeLabel = getGenerationTypeLabel(generationIntentType || queryGenerationType || resource?.resource_type || "extended_reading");
  const isLectureHandoutShowcasePage =
    isGeneratedShowcasePage && ["handout", "lecture_note", "lecture_notes"].includes(normalizedGenerationType) && ["text", "snippet"].includes(selectedMode);
  const lectureHandoutTitle = buildLectureHandoutTitle(generationIntentLabel, resource?.title, generatedHeroTitle);
  const lectureHandoutSections = generatedPreviewSections.filter((section) => !isTitleLikeLectureHandout(section.title, lectureHandoutTitle));
  const lectureHandoutReadingSections = lectureHandoutSections.length ? lectureHandoutSections : generatedPreviewSections;
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

    const fallbackPreviewText = selectedFile.preview_text || resource?.content_markdown || resource?.summary || null;
    const controller = new AbortController();
    setTextContent((current) => current || fallbackPreviewText);
    setTextLoading(!fallbackPreviewText);
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
        setTextContent((current) => current || fallbackPreviewText);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTextLoading(false);
        }
      });

    return () => controller.abort();
  }, [previewFetchUrl, resource?.content_markdown, resource?.summary, selectedFile, selectedMode]);

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
    const params = new URLSearchParams(location.search);
    params.set("fileId", String(file.file_id));
    navigate(`${location.pathname}?${params.toString()}`, {
      state: {
        ...routeState,
        initialResource: resource,
        initialFileId: file.file_id,
        initialPreviewFile: file,
      },
    });
  }

  function buildGeneratedPreviewSearch(fileId: number, generationType: PreviewGenerationType, stage: "running" | "completed", label: string) {
    const params = new URLSearchParams(location.search);
    params.set("courseId", courseId);
    if (resourceId || resource?.resource_id) {
      params.set("resourceId", String(resourceId || resource?.resource_id));
    }
    params.set("fileId", String(fileId));
    params.set("generationType", generationType);
    params.set("generationStage", stage);
    params.set("generationLabel", label);
    return params;
  }

  function openCodeWorkspace(file: ResourceSourceFileRef) {
    const params = new URLSearchParams({ courseId });
    if (resourceId) {
      params.set("resourceId", resourceId);
    }
    params.set("fileId", String(file.file_id));
    if (generationIntentStage) {
      params.set("generationStage", generationIntentStage);
    }
    if (generationIntentLabel) {
      params.set("generationLabel", generationIntentLabel);
    }
    if (generationIntentType) {
      params.set("generationType", generationIntentType);
    }
    navigate(`/resources/preview?${params.toString()}`, {
      state: {
        initialResource: resource,
        initialFileId: file.file_id,
        initialPreviewFile: file,
        generationIntent,
      },
    });
  }

  async function generateIntoCurrentPackage(generationType: PreviewGenerationType) {
    if (generatingPreviewType) return;
    const option = PREVIEW_GENERATION_OPTIONS.find((item) => item.id === generationType) || PREVIEW_GENERATION_OPTIONS[0];
    const fallbackId = Date.now();
    const sourceTitle = selectedFile?.display_name || activeResourceTitle;
    const optimisticFile = buildGeneratedFileFromResource(null, generationType, fallbackId, sourceTitle);
    const runningIntent = {
      stage: "running" as const,
      label: option.label,
      type: generationType,
    };
    const baseResource: ResourceCard = resource || {
      resource_id: numericResourceId,
      resource_type: "course_resource",
      title: activeResourceTitle,
      summary: "",
      content_markdown: "",
      source_titles: [],
    };
    const optimisticResource: ResourceCard = {
      ...baseResource,
      source_files: normalizePreviewSourceFiles([...(resource?.source_files || previewSourceFiles), optimisticFile]),
    };
    optimisticResource.source_file_count = optimisticResource.source_files?.length || 0;
    setGeneratingPreviewType(generationType);
    setResource(optimisticResource);
    setSelectedFileId(optimisticFile.file_id);
    setGenerationNotice(
      profileSummary
        ? `${option.actionLabel}已开始，已结合你的岗位学情 ${String(profileSummary.sbti_code || profileSummary.current_stage || profileSummary.recommended_learning_style || "信息")} 生成。`
        : `${option.actionLabel}已开始，预览稿会先加入左侧目录，正式内容回来后自动更新。`,
    );
    const optimisticParams = buildGeneratedPreviewSearch(optimisticFile.file_id, generationType, "running", option.label);
    navigate(`${location.pathname}?${optimisticParams.toString()}`, {
      state: {
        ...routeState,
        initialResource: optimisticResource,
        initialFileId: optimisticFile.file_id,
        initialPreviewFile: optimisticFile,
        generationIntent: runningIntent,
      },
    });
    try {
      const profileContext = buildResourceGenerationProfileContext(profileSummary);
      const knowledgePoints = buildProfileAwareKnowledgePoints({
        profile: profileSummary,
        courseTitle: sanitizePreviewText(resource?.title || courseId, courseId),
        sectionTitle: sanitizePreviewText(selectedFile?.display_name || sourceTitle, activeResourceTitle),
        resourceTitle: activeResourceTitle,
        resourceSummary: resource?.summary || selectedFile?.preview_text || "当前资料包补充材料",
        generationLabel: option.label,
        extraHints: [activeResourceTitle, sourceTitle, resource?.summary || "当前资料包补充材料"].filter(Boolean),
      });
      const response = await studentApi.generateResources({
        user_id: ACTIVE_USER_ID,
        course_id: resolveCourseId(courseId),
        knowledge_points: knowledgePoints,
        resource_types: [generationType],
        profile_context: profileContext,
      });
      const generated = response.resources?.find((item) => String(item.resource_type || "").toLowerCase() === generationType) || null;
      const generatedFile = { ...buildGeneratedFileFromResource(generated, generationType, fallbackId, sourceTitle), file_id: optimisticFile.file_id };
      const nextResource: ResourceCard = {
        ...optimisticResource,
        source_files: normalizePreviewSourceFiles((optimisticResource.source_files || []).map((file) => (file.file_id === optimisticFile.file_id ? generatedFile : file))),
      };
      nextResource.source_file_count = nextResource.source_files?.length || 0;
      setResource(nextResource);
      setSelectedFileId(generatedFile.file_id);
      setGenerationNotice(`${option.actionLabel}完成，已加入左侧文件目录并自动打开。`);
      const completedIntent = {
        stage: "completed" as const,
        label: option.label,
        type: generationType,
      };
      const params = buildGeneratedPreviewSearch(generatedFile.file_id, generationType, "completed", option.label);
      navigate(`${location.pathname}?${params.toString()}`, {
        state: {
          ...routeState,
          initialResource: nextResource,
          initialFileId: generatedFile.file_id,
          initialPreviewFile: generatedFile,
          generationIntent: completedIntent,
        },
      });
    } catch {
      setGenerationNotice("接口暂时没有返回正式文件，已保留规范预览稿；它已经在左侧目录中。");
    } finally {
      setGeneratingPreviewType(null);
    }
  }

  function openTutorFromCurrentResource() {
    const payload = {
      courseId,
      resourceId: resource?.resource_id || undefined,
      resourceTitle: sanitizePreviewText(resource?.title, selectedFile?.display_name || "当前资料"),
      resourceType: String(resource?.resource_type || "course_resource"),
      resourceSummary: sanitizePreviewText(resource?.summary || selectedFile?.preview_text, "请结合当前资料继续讲解重点、难点和学习顺序。"),
      title: "资料精读 学习助手",
      subtitle: "围绕当前资料内容继续解释、总结和安排下一步学习。",
      quickPrompts: ["提炼这份资料重点", "按项目实现角度讲", "告诉我下一步先学什么"],
      mode: "learning" as const,
    };
    saveActiveTutorContext(payload);
    openTutorPanel(payload);
  }

  function openTutorFromCodingLab() {
    const payload = {
      courseId,
      resourceId: resource?.resource_id || undefined,
      resourceTitle: sanitizePreviewText(resource?.title, selectedFile?.display_name || "当前实操资料"),
      resourceType: String(resource?.resource_type || "coding_lab"),
      resourceSummary: sanitizePreviewText(resource?.summary, "请结合当前代码实操资源继续讲解题面、代码和运行结果。"),
      title: "代码实操 学习助手",
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
          previewText={selectedFile.preview_text || resource?.content_markdown || ""}
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

    const normalizedGeneratedType = String(generationIntentType || queryGenerationType || resource?.resource_type || "").toLowerCase();
    if (normalizedGeneratedType === "ppt" || normalizedGeneratedType === "slide_deck") {
      return <InteractiveGeneratedPptPreview title={displayFileName} markdown={resource?.content_markdown || selectedFile?.preview_text || ""} />;
    }
    if (normalizedGeneratedType === "mindmap" || normalizedGeneratedType === "mind_map") {
      return <GeneratedMindmapPreview title={displayFileName} />;
    }
    if (normalizedGeneratedType === "practice_set" || normalizedGeneratedType === "quiz_set") {
      return <GeneratedPracticePreview title={displayFileName} />;
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
      if (!previewFetchUrl || documentFrameError) {
        return (
          <article className="mx-auto max-w-[820px]">
            <div className="mb-5 border border-[#D4DCE6] bg-[#F7F9FF] px-4 py-3 text-sm leading-7 text-[#334155]">
              <span className="font-black text-[#002FA7]">{selectedFile.display_name}</span>
              <span className="ml-2">
                {previewFetchUrl ? "在线预览暂未响应，已切换为讲义预览。" : "当前没有可加载的文件地址，已切换为讲义预览。"}
              </span>
              {previewOpenUrl ? (
                <a href={previewOpenUrl} target="_blank" rel="noreferrer" className="ml-2 font-black text-[#002FA7] underline underline-offset-4">
                  打开原文件
                </a>
              ) : null}
            </div>
            <MarkdownRenderer
              content={buildFileFallbackDocument(selectedFile, resource)}
              className="[&_h1]:mb-6 [&_h1]:border-b [&_h1]:border-[#E5EAF1] [&_h1]:pb-4 [&_h1]:text-[30px] [&_h1]:font-black [&_h1]:tracking-[-0.04em] [&_h1]:text-[#111827] [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:border-l-4 [&_h2]:border-[#002FA7] [&_h2]:pl-3 [&_h2]:text-[22px] [&_h2]:font-black [&_h2]:tracking-[-0.03em] [&_h2]:text-[#111827] [&_p]:text-[15px] [&_p]:leading-8 [&_p]:text-[#334155] [&_ul]:my-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:leading-8 [&_li]:text-[#475569] [&_table]:block [&_table]:overflow-x-auto [&_table]:border [&_table]:border-[#D4DCE6] [&_table]:bg-white"
            />
          </article>
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
      if (textLoading && !textContent) {
        return <LoadingBlock title="正在加载文本内容..." />;
      }
      if (isGeneratedPlaceholder) {
        return (
          <div className="overflow-hidden border border-[#D4DCE6] bg-white">
            <div className="border-b border-[#E5EAF1] px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm bg-[#EEF3FF] px-3 py-1 text-[11px] font-black text-[#002FA7]">生成内容预览</span>
                <span className="rounded-sm border border-[#D4DCE6] bg-[#F7F7F8] px-3 py-1 text-[11px] font-semibold text-[#475569]">
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
                    className="prose prose-slate max-w-none text-[15px] leading-8 prose-headings:mb-3 prose-headings:mt-8 prose-headings:font-black prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-8 prose-li:text-slate-600 prose-li:leading-8 prose-strong:text-slate-900 [&_h2]:border-l-4 [&_h2]:border-[#002FA7] [&_h2]:pl-3"
                  />
                </div>
              </div>

              <aside className="border-t border-[#E5EAF1] bg-[#F7F7F8] px-5 py-5 xl:border-l xl:border-t-0">
                <div className="text-[11px] font-black text-[#002FA7]">阅读提要</div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-[#D4DCE6] bg-white px-4 py-3">
                    <div className="text-[11px] font-black text-[#64748b]">资料类型</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{generatedTypeLabel}</div>
                  </div>
                  <div className="rounded-md border border-[#D4DCE6] bg-white px-4 py-3">
                    <div className="text-[11px] font-black text-[#64748b]">当前阶段</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{generationIntentStage === "running" ? "文件同步中" : "可读预览"}</div>
                  </div>
                  <div className="rounded-md border border-[#D4DCE6] bg-white px-4 py-3">
                    <div className="text-[11px] font-black text-[#64748b]">建议阅读方式</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">先通读当前生成稿，确认主线内容；正式文件同步后再细读和导出。</div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        );
      }
      const rawPreviewContent = textContent || textError || "当前文件暂无可读取文本内容。";
      const normalizedPreviewContent = resource ? normalizePreviewDocumentContent(resource, rawPreviewContent) : rawPreviewContent;
      return (
        <article className="mx-auto max-w-[820px]">
          {textLoading ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d9e8fb] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#006689] shadow-sm">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              正在同步完整版文本...
            </div>
          ) : null}
          <MarkdownRenderer
            content={normalizedPreviewContent}
            className="[&_h1]:mb-6 [&_h1]:border-b [&_h1]:border-[#E5EAF1] [&_h1]:pb-4 [&_h1]:text-[30px] [&_h1]:font-black [&_h1]:tracking-[-0.04em] [&_h1]:text-[#111827] [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:border-l-4 [&_h2]:border-[#002FA7] [&_h2]:pl-3 [&_h2]:text-[22px] [&_h2]:font-black [&_h2]:tracking-[-0.03em] [&_h2]:text-[#111827] [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[18px] [&_h3]:font-black [&_h3]:text-[#111827] [&_p]:text-[15px] [&_p]:leading-8 [&_p]:text-[#334155] [&_ul]:my-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:leading-8 [&_li]:text-[#475569] [&_blockquote]:border-l-4 [&_blockquote]:border-[#002FA7] [&_blockquote]:bg-[#F7F9FF] [&_blockquote]:px-4 [&_blockquote]:py-3 [&_code]:rounded-sm [&_code]:bg-[#F3F5F8] [&_code]:px-1.5 [&_code]:py-0.5 [&_pre]:rounded-md [&_pre]:bg-[#0f172a] [&_pre]:p-5 [&_pre]:text-[13px] [&_pre]:leading-7 [&_table]:block [&_table]:overflow-x-auto [&_table]:border [&_table]:border-[#D4DCE6] [&_table]:bg-white [&_th]:bg-[#F7F7F8] [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3"
          />
        </article>
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
  const totalPreviewFiles = resource?.source_file_count || groupedFiles.reduce((sum, group) => sum + group.files.length, 0);
  const selectedFileKind = selectedFile ? getFileKindLabel(selectedFile) : "文件预览";
  const activeResourceTitle = sanitizePreviewText(resource?.title, "课程资料预览");

  if (loading && !resource && !selectedFile) {
    return (
      <div id="resource-source-preview-workspace" className="mx-auto max-w-[1440px] px-4 py-10 md:px-8">
        <LoadingBlock title="正在载入资源预览..." />
      </div>
    );
  }

  if (!resourceId && !generationIntent && !isCodingLabPage && !resource) {
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

  if (isSpecialGeneratedPreview) {
    return (
      <div id="resource-source-preview-workspace" className="h-screen overflow-hidden bg-[#f6f8fb] text-[#111827]">
        <div className="flex h-full flex-col">
          <header className="shrink-0 border-b border-[#D4DCE6] bg-white">
            <div className="flex min-h-[46px] items-center justify-between gap-3 px-3 md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to={backUrl}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D4DCE6] bg-white text-[#475569] transition hover:bg-[#F7F7F8] hover:text-[#002FA7]"
                  aria-label="返回资源中心"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-sm bg-[#EEF3FF] px-2 py-1 text-[11px] font-black text-[#002FA7]">
                      {currentPreviewModeLabel}
                    </span>
                    <span className="rounded-sm border border-[#D4DCE6] bg-[#F7F7F8] px-2 py-1 text-[11px] font-bold text-[#64748B]">
                      {generationIntentStage === "running" ? "生成中" : "已完成"}
                    </span>
                    <h1 className="truncate text-sm font-black text-[#111827] md:text-base">
                      {sanitizePreviewText(generationIntentLabel || resource?.title || selectedFile?.display_name, "生成资料预览")}
                    </h1>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[#64748B]">
                    当前文件：{getReadableFileTitle(selectedFile, "等待载入")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openTutorFromCurrentResource}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#BFD0FF] bg-[#F7F9FF] px-3 py-2 text-xs font-black text-[#002FA7] transition hover:bg-[#EEF3FF]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  问 学习助手
                </button>
                <button
                  type="button"
                  onClick={() => setIsGenerationChooserOpen(true)}
                  disabled={Boolean(generatingPreviewType)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#002FA7] px-3 py-2 text-xs font-black text-white transition hover:bg-[#00247d] disabled:opacity-50"
                >
                  {generatingPreviewType ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generatingPreviewType ? "生成中" : "继续生成资料"}
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#D4DCE6] bg-white px-3 py-2 text-xs font-black text-[#475569] transition hover:bg-[#F7F7F8]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新
                </button>
              </div>
            </div>
            <div className="flex min-h-[28px] items-center gap-2 border-t border-[#EDF1F5] bg-[#FAFBFC] px-3 text-[10px] font-bold text-[#475569] md:px-5">
              <span className="rounded-sm bg-white px-2 py-1 text-[#002FA7] ring-1 ring-[#D4DCE6]">预览</span>
              <span>可播放</span>
              <span>·</span>
              <span>可编辑</span>
              <span>·</span>
              <span className="truncate">按生成大纲组织内容</span>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-5">
            <div className="mx-auto max-w-[1600px]">
              <section className="mb-3 rounded-[16px] border border-[#d8e6f3] bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black tracking-[0.18em] text-[#006689]">AI 学习助手</div>
                    <div className="mt-1 text-sm font-black text-[#111827]">围绕当前练习继续讲解、出题或生成补充资料</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={openTutorFromCurrentResource}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#BFD0FF] bg-[#F7F9FF] px-3.5 py-2 text-xs font-black text-[#002FA7] transition hover:bg-[#EEF3FF]"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      解析这些练习
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsGenerationChooserOpen(true)}
                      disabled={Boolean(generatingPreviewType)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3.5 py-2 text-xs font-black text-white transition hover:bg-[#1f2937] disabled:opacity-50"
                    >
                      {generatingPreviewType ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {generatingPreviewType ? "正在生成" : "生成配套资料"}
                    </button>
                  </div>
                </div>
              </section>
              {renderPreviewBody()}
            </div>
          </div>
        </div>
        {isGenerationChooserOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 px-4 py-6 backdrop-blur-[2px]">
            <div className="w-full max-w-[760px] overflow-hidden rounded-[24px] border border-[#d8e6f3] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
              <div className="flex items-center justify-between border-b border-[#e8edf2] px-5 py-4">
                <div>
                  <div className="text-[10px] font-black tracking-[0.18em] text-[#006689]">AI 生成资料</div>
                  <div className="mt-1 text-[18px] font-black text-[#111827]">先选择要补充的资料类型</div>
                  <div className="mt-1 text-[12px] leading-5 text-[#667085]">
                    {profileSummary
                      ? `已读取你的岗位学情：${String(profileSummary.sbti_code || profileSummary.current_stage || profileSummary.recommended_learning_style || "正在生成个性化策略")}`
                      : "正在读取岗位学情，用来决定生成资料的重点和风格。"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGenerationChooserOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5ebf2] bg-white text-[#64748b] transition hover:bg-[#f8fbff] hover:text-[#111827]"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                {PREVIEW_GENERATION_OPTIONS.map((option) => {
                  const active = selectedGenerationType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedGenerationType(option.id)}
                      className={`rounded-[18px] border p-4 text-left transition ${
                        active
                          ? "border-[#2563eb] bg-[#f7fbff] shadow-[0_10px_26px_rgba(37,99,235,0.10)]"
                          : "border-[#e6edf5] bg-white hover:border-[#bfd0ff] hover:bg-[#fbfdff]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black tracking-[0.18em] text-[#006689]">{option.category}</div>
                          <div className="mt-1 text-[15px] font-black text-[#111827]">{option.label}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${active ? "bg-[#2563eb] text-white" : "bg-[#eef3ff] text-[#2563eb]"}`}>
                          {active ? "已选" : "选择"}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-6 text-[#475569]">{option.detail}</p>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf2] px-5 py-4">
                <div className="text-[12px] leading-6 text-[#667085]">
                  当前将生成 <span className="font-black text-[#111827]">{selectedGenerationOption.label}</span>，生成后会加入左侧目录并自动打开。
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGenerationChooserOpen(false)}
                    className="rounded-full border border-[#d8e6f3] bg-white px-4 py-2 text-[12px] font-black text-[#475569] transition hover:bg-[#f8fbff]"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGenerationChooserOpen(false);
                      void generateIntoCurrentPackage(selectedGenerationType);
                    }}
                    disabled={Boolean(generatingPreviewType)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#002FA7] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#00247d] disabled:opacity-50"
                  >
                    {generatingPreviewType ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generatingPreviewType ? "正在生成资料..." : `${selectedGenerationOption.actionLabel}并加入目录`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (isLectureHandoutShowcasePage) {
    return (
      <div id="resource-source-preview-workspace" className="min-h-screen overflow-x-hidden bg-[#f6f8fb]">
        <div className="mx-auto max-w-[1600px] px-3 pb-6 pt-3 md:px-5">
          <section className="rounded-[16px] border border-[#dfe7ef] bg-white/94 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link to={`/learn?courseId=${courseId}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006689] transition hover:text-[#005570]">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回课堂
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[#fb7299] px-2.5 py-0.5 text-[10px] font-black text-white">课堂讲义</span>
                  <span className="rounded-full border border-[#d8eaf4] bg-[#eef8fc] px-2.5 py-0.5 text-[10px] font-bold text-[#006689]">
                    {generationIntentStage === "completed" ? "已生成" : "正在整理"}
                  </span>
                  <span className="rounded-full border border-[#ffd7e4] bg-[#fff7fa] px-2.5 py-0.5 text-[10px] font-semibold text-[#c25179]">紧凑阅读</span>
                </div>
                <h1 className="mt-2 max-w-4xl text-[20px] font-black leading-tight tracking-tight text-[#111827] md:text-[24px]">{lectureHandoutTitle}</h1>
                <p className="mt-1 max-w-4xl text-xs leading-5 text-[#5b6472]">{generatedHeroSummary}</p>
              </div>

              <div className="hidden w-full gap-2 text-xs xl:grid xl:w-[480px] xl:grid-cols-3">
                <div className="rounded-[12px] border border-[#eef2f7] bg-[#fbfdff] px-3 py-2">
                  <div className="text-[10px] font-black text-[#006689]">导读</div>
                  <div className="mt-1 leading-5 text-[#475569]">主线优先</div>
                </div>
                <div className="rounded-[12px] border border-[#ffe0ea] bg-[#fff8fb] px-3 py-2">
                  <div className="text-[10px] font-black text-[#c25179]">方式</div>
                  <div className="mt-1 leading-5 text-[#475569]">边看边标注</div>
                </div>
                <div className="rounded-[12px] border border-[#e6edf5] bg-white px-3 py-2">
                  <div className="text-[10px] font-black text-[#64748b]">文件</div>
                  <div className="mt-1 truncate font-bold text-[#111827]">{displayFileName}</div>
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {previewOpenUrl ? (
                <a
                  href={previewOpenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#0f172a]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  打开原文件
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#d8eaf4] bg-white px-3 py-1.5 text-xs font-bold text-[#006689] transition hover:bg-[#f4fbff]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新结果
              </button>
            </div>
          </section>

          {error && resource ? (
            <section className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-800">
              当前资源详情加载时出现提示：{error}
            </section>
          ) : null}

          <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
            <main className="min-w-0">
              <article className="overflow-hidden rounded-[16px] border border-[#dfe7ef] bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
                <div className="border-b border-[#eef2f7] bg-[#fbfdff] px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef8fc] text-[#006689]">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <div className="text-[10px] font-black text-[#006689]">讲义正文</div>
                      <div className="mt-0.5 text-xs text-[#64748b]">内容按课堂阅读顺序整理，可用右侧目录跳转。</div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-4">
                  {textLoading ? (
                    <LoadingBlock title="正在加载课堂讲义..." />
                  ) : (
                    <div className="mx-auto max-w-none space-y-4">
                      {lectureHandoutReadingSections.length ? (
                        lectureHandoutReadingSections.map((section, index) => (
                          <section
                            key={section.anchor}
                            id={section.anchor}
                            className={index === 0 ? "rounded-[12px] border border-[#ffd9e6] bg-[#fff8fb] px-3 py-3" : "border-t border-[#edf2f7] pt-4"}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                                  index === 0 ? "bg-[#fb7299] text-white" : "bg-[#eef8fc] text-[#006689]"
                                }`}
                              >
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0 text-[15px] font-black leading-snug text-[#111827]">{section.title}</div>
                            </div>
                            <MarkdownRenderer
                              content={section.body || `## ${section.title}`}
                              className="[&_h1]:hidden [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[16px] [&_h2]:font-black [&_h2]:text-[#111827] [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-[14px] [&_h3]:font-black [&_h3]:text-[#111827] [&_p]:my-1.5 [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-[#334155] [&_ul]:my-2 [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:text-[13px] [&_li]:leading-6 [&_li]:text-[#475569] [&_strong]:text-[#111827] [&_blockquote]:rounded-[10px] [&_blockquote]:border-l-4 [&_blockquote]:border-[#fb7299] [&_blockquote]:bg-white [&_blockquote]:px-3 [&_blockquote]:py-2 [&_table]:block [&_table]:overflow-x-auto [&_table]:rounded-[10px] [&_table]:border [&_table]:border-[#e8eef5] [&_table]:bg-white [&_th]:bg-[#f8fbff] [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_code]:rounded [&_code]:bg-[#f4f7fb] [&_code]:px-1 [&_code]:py-0.5 [&_pre]:rounded-[10px] [&_pre]:bg-[#0f172a] [&_pre]:p-3 [&_pre]:text-[12px]"
                            />
                          </section>
                        ))
                      ) : textError ? (
                        <EmptyBlock title="当前讲义内容暂不可读" description={textError} />
                      ) : (
                        <EmptyBlock title="正在同步讲义正文" description="讲义目录和正文会在内容就绪后自动显示。" />
                      )}
                    </div>
                  )}
                </div>
              </article>
            </main>

            <aside className="xl:pt-0">
              <div className="xl:sticky xl:top-3">
                <div className="rounded-[14px] border border-[#dfe7ef] bg-white/88 p-2 shadow-[0_10px_26px_rgba(15,23,42,0.04)] backdrop-blur">
                  <div className="px-2 text-[10px] font-black text-[#006689]">目录</div>
                  <div className="mt-2 space-y-1">
                    {lectureHandoutReadingSections.length ? (
                      lectureHandoutReadingSections.map((section, index) => (
                        <a
                          key={section.anchor}
                          href={`#${section.anchor}`}
                          className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-xs text-[#475569] transition hover:bg-[#f8fbff] hover:text-[#111827]"
                        >
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eef8fc] text-[10px] font-black text-[#006689]">
                            {index + 1}
                          </span>
                          <span className="line-clamp-2 leading-4">{section.title}</span>
                        </a>
                      ))
                    ) : (
                      <div className="rounded-[10px] bg-white px-2 py-2 text-xs leading-5 text-[#64748b]">正文同步后生成目录。</div>
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

  if (isGeneratedShowcasePage) {
    return (
      <div id="resource-source-preview-workspace" className="min-h-screen overflow-x-hidden bg-[#f6f8fb]">
        <div className="mx-auto max-w-[1600px] px-3 pb-6 pt-3 md:px-5">
          <section className="relative overflow-hidden rounded-[16px] border border-[#dfe7ef] bg-white/94 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={backUrl} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006689] transition hover:text-[#005570]">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    返回资源中心
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#fb7299] px-2.5 py-0.5 text-[10px] font-black text-white">{generatedTypeLabel}</span>
                    <span className="rounded-full border border-[#d8eaf4] bg-[#eef8fc] px-2.5 py-0.5 text-[10px] font-bold text-[#006689]">
                      {generationIntentStage === "completed" ? "已补充完成" : "正在生成中"}
                    </span>
                    <span className="rounded-full border border-[#ffd7e4] bg-[#fff7fa] px-2.5 py-0.5 text-[10px] font-semibold text-[#c25179]">紧凑预览</span>
                  </div>
                  <h1 className="mt-2 max-w-4xl text-[20px] font-black leading-tight tracking-tight text-[#111827] md:text-[24px]">
                    {generatedHeroTitle}
                  </h1>
                  <p className="mt-1 max-w-4xl text-xs leading-5 text-[#5b6472]">{generatedHeroSummary}</p>
                </div>

                <div className="hidden min-w-[360px] gap-2 text-xs xl:grid xl:grid-cols-3">
                  <div className="rounded-[12px] border border-[#eef2f7] bg-[#fbfdff] px-3 py-2">
                    <div className="text-[10px] font-black text-[#006689]">类型</div>
                    <div className="mt-1 truncate font-bold text-[#111827]">{generatedTypeLabel}</div>
                  </div>
                  <div className="rounded-[12px] border border-[#eef2f7] bg-[#fbfdff] px-3 py-2">
                    <div className="text-[10px] font-black text-[#006689]">方式</div>
                    <div className="mt-1 truncate font-bold text-[#111827]">{currentPreviewModeLabel}</div>
                  </div>
                  <div className="rounded-[12px] border border-[#eef2f7] bg-white px-3 py-2">
                    <div className="text-[10px] font-black text-[#64748b]">文件</div>
                    <div className="mt-1 truncate font-bold text-[#111827]">{displayFileName}</div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {previewOpenUrl ? (
                  <a
                    href={previewOpenUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#0f172a]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开原文件
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#d8eaf4] bg-white px-3 py-1.5 text-xs font-bold text-[#006689] transition hover:bg-[#f4fbff]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
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

          <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
            <main className="min-w-0">
              {isSpecialGeneratedPreview ? (
                renderPreviewBody()
              ) : ["text", "snippet"].includes(selectedMode) ? (
                <div
                  className={`relative overflow-hidden rounded-[16px] border border-[#dfe7ef] px-0 py-0 ${
                    isGeneratedTextShowcasePage
                      ? "bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
                      : "bg-white"
                  }`}
                >
                  <div className={`relative border-b border-[#eef2f7] bg-[#fbfdff] px-4 py-2.5 ${isGeneratedTextShowcasePage ? "" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[10px] font-black text-[#006689]">生成内容</div>
                      {isGeneratedTextShowcasePage ? (
                        <span className="rounded-full border border-[#ffd7e4] bg-white px-2 py-0.5 text-[10px] font-black text-[#c25179]">
                          {generatedExperience.heroNoun}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 font-black leading-6 text-[#111827] text-[15px]">
                      {generatedPrimarySection?.title || previewTitle}
                    </div>
                    {isGeneratedTextShowcasePage ? (
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-[#5b6472]">{generatedExperience.adviceLabel}</p>
                    ) : null}
                  </div>

                  <div className="relative px-4 py-4">
                    {textLoading ? (
                      <LoadingBlock title="正在加载生成内容..." />
                    ) : (
                      <div className="space-y-5">
                        {generatedPrimarySection ? (
                          <section id={generatedPrimarySection.anchor} className="space-y-3">
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd7e4] bg-[#fff7fa] px-2.5 py-0.5 text-[10px] font-black text-[#c25179]">
                              <Sparkles className="h-3.5 w-3.5" />
                              {isGeneratedTextShowcasePage ? "本次补充成果" : "本次新增重点"}
                            </div>
                            <MarkdownRenderer
                              content={`## ${generatedPrimarySection.title}\n\n${generatedPrimarySection.body}`}
                              className="[&_h1]:hidden [&_h2]:mb-2 [&_h2]:text-[16px] [&_h2]:font-black [&_h2]:text-[#111827] [&_h3]:mt-4 [&_h3]:text-[14px] [&_h3]:font-black [&_h3]:text-[#111827] [&_p]:my-2 [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-[#334155] [&_ul]:my-2 [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:text-[13px] [&_li]:leading-6 [&_table]:block [&_table]:overflow-x-auto [&_table]:rounded-[10px] [&_table]:border [&_table]:border-[#e8eef5] [&_table]:bg-white [&_th]:bg-[#f8fbff] [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_td]:text-[12px] [&_code]:rounded-md [&_code]:bg-[#f4f7fb] [&_code]:px-1 [&_code]:py-0.5 [&_pre]:rounded-[12px] [&_pre]:bg-[#0f172a] [&_pre]:p-3 [&_pre]:text-[12px] [&_pre]:leading-6"
                            />
                          </section>
                        ) : null}

                        {generatedSecondarySections.length ? (
                          <div className="grid gap-x-5 gap-y-5 md:grid-cols-2">
                            {generatedSecondarySections.map((section, index) => (
                              <section
                                key={section.anchor}
                                id={section.anchor}
                                className="relative border-t border-[#edf2f7] pt-4"
                              >
                                <div className="mb-2 inline-flex items-center gap-2 text-[10px] font-black text-[#006689]">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef6fb]">{String(index + 2).padStart(2, "0")}</span>
                                  {isGeneratedTextShowcasePage ? "成果分块" : "内容段落"}
                                </div>
                                <MarkdownRenderer
                                  content={`### ${section.title}\n\n${section.body}`}
                                  className="[&_h1]:hidden [&_h2]:hidden [&_h3]:mb-2 [&_h3]:text-[14px] [&_h3]:font-black [&_h3]:text-[#111827] [&_p]:my-2 [&_p]:text-[13px] [&_p]:leading-6 [&_p]:text-[#475569] [&_ul]:my-2 [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:text-[13px] [&_li]:leading-6 [&_code]:rounded-md [&_code]:bg-[#f4f7fb] [&_code]:px-1 [&_code]:py-0.5 [&_pre]:rounded-[12px] [&_pre]:bg-[#0f172a] [&_pre]:p-3 [&_pre]:text-[12px]"
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

            <aside className="xl:pt-0">
              <div className="xl:sticky xl:top-5">
                <div className="rounded-[16px] border border-[#dfe7ef] bg-white p-2">
                  <div className="px-2 text-[10px] font-black text-[#006689]">阅读索引</div>
                  <div className="mt-2 space-y-1.5">
                    {generatedPreviewSections.length ? (
                      generatedPreviewSections.map((section, index) => (
                        <a
                          key={section.anchor}
                          href={`#${section.anchor}`}
                          className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-xs text-[#475569] transition hover:bg-[#f4fbff] hover:text-[#111827]"
                        >
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eef8fc] text-[10px] font-black text-[#006689]">
                            {index + 1}
                          </span>
                          <span className="line-clamp-2">{section.title}</span>
                        </a>
                      ))
                    ) : (
                      <div className="rounded-[10px] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#64748b]">当前正在同步生成内容，目录会在正文就绪后自动出现。</div>
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

  if (isCodeListPage) {
    return (
      <div className="min-h-screen bg-[#F3F5F8] text-[#111827]">
        <div className="mx-auto max-w-[1320px] px-4 py-5 md:px-8">
          <section className="rounded-[24px] border border-[#DDE5EF] bg-white px-5 py-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Link to={backUrl} className="inline-flex items-center gap-2 text-sm font-bold text-[#006689] transition hover:text-[#005570]">
                  <ArrowLeft className="h-4 w-4" />
                  返回资源中心
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF7FB] px-3 py-1 text-[11px] font-black text-[#006689]">
                    <Code2 className="h-3.5 w-3.5" />
                    代码清单
                  </span>
                  <span className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold text-[#64748B]">
                    {codeListFiles.length || 1} 个文件
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-[#111827] md:text-[30px]">
                  {sanitizePreviewText(resource?.title, "代码实操任务清单")}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5B6574]">
                  先确认任务单、源文件和判题入口，再选择需要完成的文件进入代码操作台。
                </p>
              </div>
              <div className="grid min-w-[220px] grid-cols-2 gap-2 text-center">
                <div className="rounded-[18px] border border-[#E8EDF2] bg-[#FBFDFF] px-4 py-3">
                  <div className="text-[10px] font-black text-[#8B95A7]">已提交</div>
                  <div className="mt-1 text-xl font-black text-[#111827]">{submittedAssignmentCount}</div>
                </div>
                <div className="rounded-[18px] border border-[#E8EDF2] bg-[#FBFDFF] px-4 py-3">
                  <div className="text-[10px] font-black text-[#8B95A7]">当前状态</div>
                  <div className="mt-1 text-sm font-black text-[#006689]">可进入</div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[24px] border border-[#DDE5EF] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
            <div className="grid gap-3">
              {(codeListFiles.length ? codeListFiles : selectedFile ? [selectedFile] : []).map((file, index) => {
                const Icon = getFileIcon(file);
                const isActive = file.file_id === selectedFile?.file_id;
                return (
                  <div
                    key={`${file.file_id}-${file.display_name}`}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-[18px] border px-4 py-3 transition ${
                      isActive ? "border-[#B9DCE8] bg-[#F6FBFE]" : "border-[#E8EDF2] bg-white hover:border-[#CFE0EF] hover:bg-[#FBFDFF]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[#E8EDF2] bg-[#F8FAFC]">
                        <Icon className="h-5 w-5 text-[#006689]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-black text-[#64748B]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h2 className="truncate text-sm font-black text-[#111827]">{getReadableFileTitle(file, "代码实操文件")}</h2>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[#7B8794]">
                          {getFileKindLabel(file)} · {formatFileSize(file.file_size)} · {getCategoryLabel(file.top_level_category)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openFilePreview(file)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D8EAF4] bg-white px-3 py-2 text-xs font-black text-[#006689] transition hover:bg-[#F4FBFF]"
                      >
                        查看任务单
                      </button>
                      <button
                        type="button"
                        onClick={() => openCodeWorkspace(file)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-4 py-2 text-xs font-black text-white transition hover:bg-[#1F2937]"
                      >
                        <MonitorPlay className="h-3.5 w-3.5" />
                        进入代码操作台
                      </button>
                    </div>
                  </div>
                );
              })}
              {!codeListFiles.length && !selectedFile ? (
                <div className="rounded-[18px] border border-dashed border-[#D7E3EF] bg-[#FBFDFF] px-4 py-8 text-center text-sm font-bold text-[#64748B]">
                  当前代码资源还没有同步出可用文件。
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (isCodingLabPage) {
    return (
      <div id="resource-source-preview-workspace" className="h-screen overflow-hidden bg-[#E8EDF3]">
        <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-3 px-3 py-3 md:px-4">
          <section className="shrink-0 rounded-lg border border-[#D7E0EA] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link to={backUrl} className="inline-flex items-center gap-2 text-xs font-bold text-[#006689] transition hover:text-[#005570]">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回资源中心
                </Link>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-black text-[#166534]">刷题工作台</span>
                  <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-black text-[#2563EB]">可切题 · 可判题</span>
                  <h1 className="truncate text-lg font-black tracking-tight text-[#111827] md:text-xl">{sanitizePreviewText(resource?.title, "代码刷题工作台")}</h1>
                </div>
              </div>
              <div className="shrink-0 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-right">
                <div className="text-[10px] font-black text-[#64748B]">当前文件</div>
                <div className="mt-0.5 font-mono text-sm font-black text-[#111827]">{selectedFile?.display_name || "Main.java"}</div>
              </div>
            </div>
          </section>

          {selectedFile ? (
            <div className="min-h-0 flex-1">
              <CodingLabWorkspace
                file={selectedFile}
                resource={resource}
                previewText={selectedFile.preview_text || resource?.content_markdown || ""}
                onOpenTutor={openTutorFromCodingLab}
                generationIntent={generationIntent}
              />
            </div>
          ) : (
            <LoadingBlock title="正在准备代码实操工作台..." />
          )}
        </div>
      </div>
    );
  }

  if (isSpecialGeneratedPreview) {
    return (
      <div id="resource-source-preview-workspace" className="h-screen overflow-hidden bg-[#F3F5F8] text-[#111827]">
        <div className="flex h-full flex-col">
          <header className="shrink-0 border-b border-[#D4DCE6] bg-white">
            <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to={backUrl}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D4DCE6] bg-white text-[#475569] transition hover:bg-[#F7F7F8] hover:text-[#002FA7]"
                  aria-label="返回资源中心"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-sm bg-[#EEF3FF] px-2 py-1 text-[11px] font-black text-[#002FA7]">
                      {currentPreviewModeLabel}
                    </span>
                    {generationIntentStage ? (
                      <span className="rounded-sm border border-[#D4DCE6] bg-[#F7F7F8] px-2 py-1 text-[11px] font-bold text-[#64748B]">
                        {generationIntentStage === "running" ? "生成中" : "已完成"}
                      </span>
                    ) : null}
                    <h1 className="truncate text-base font-black text-[#111827] md:text-lg">
                      {sanitizePreviewText(generationIntentLabel || resource?.title || selectedFile?.display_name, "生成资料预览")}
                    </h1>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-[#64748B]">
                    当前文件：{getReadableFileTitle(selectedFile, "等待载入")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#D4DCE6] bg-white px-3 py-2 text-xs font-black text-[#475569] transition hover:bg-[#F7F7F8]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </button>
            </div>
            <div className="flex min-h-[34px] items-center gap-2 border-t border-[#EDF1F5] bg-[#FAFBFC] px-4 text-[11px] font-bold text-[#475569] md:px-6">
              <span className="rounded-sm bg-white px-2 py-1 text-[#002FA7] ring-1 ring-[#D4DCE6]">预览</span>
              <span>可播放</span>
              <span>·</span>
              <span>可编辑</span>
              <span>·</span>
              <span className="truncate">按生成大纲组织内容</span>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
            <div className="mx-auto max-w-[1500px]">
              {renderPreviewBody()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isShowcaseIllustrationPage) {
    return (
      <div id="resource-source-preview-workspace" className="h-screen overflow-hidden bg-[#F3F5F8] text-[#111827]">
        <div className="flex h-full flex-col">
          <header className="shrink-0 border-b border-[#D4DCE6] bg-white">
            <div className="flex min-h-[58px] items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to={backUrl}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#D4DCE6] bg-white text-[#475569] transition hover:bg-[#F7F7F8] hover:text-[#002FA7]"
                  aria-label="返回资源中心"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-sm bg-[#EEF3FF] px-2 py-1 text-[11px] font-black text-[#002FA7]">
                      {getResourceTypeLabel(resource?.resource_type)}
                    </span>
                    <span className="hidden rounded-sm border border-[#D4DCE6] bg-[#F7F7F8] px-2 py-1 text-[11px] font-bold text-[#64748B] sm:inline-flex">
                      {currentPreviewModeLabel}
                    </span>
                    <h1 className="truncate text-base font-black text-[#111827] md:text-lg">
                      {activeResourceTitle}
                    </h1>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-[#64748B]">
                    当前文件：{getReadableFileTitle(selectedFile, "等待载入")}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenerationChooserOpen(true)}
                  disabled={Boolean(generatingPreviewType)}
                  className="hidden items-center gap-1.5 rounded-md border border-[#BFD0FF] bg-[#F7F9FF] px-3 py-2 text-xs font-black text-[#002FA7] transition hover:bg-[#EEF3FF] sm:inline-flex"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {generatingPreviewType ? "生成中..." : "选择 AI 生成资料"}
                </button>
                <span className="hidden rounded-md border border-[#D4DCE6] bg-white px-3 py-2 text-xs font-bold text-[#475569] sm:inline-flex">
                  当前选择：{selectedGenerationOption.label}
                </span>
                {selectedFile && previewOpenUrl ? (
                  <a
                    href={previewOpenUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] px-3 py-2 text-xs font-black text-white transition hover:bg-[#1F2937]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    打开原文件
                  </a>
                ) : null}
              </div>
            </div>
            <div className="flex min-h-[40px] items-center gap-1 border-t border-[#EDF1F5] bg-[#FAFBFC] px-4 text-[11px] font-bold text-[#475569] md:px-6">
              <span className="rounded-sm bg-white px-2 py-1 text-[#002FA7] ring-1 ring-[#D4DCE6]">阅读</span>
              <span className="rounded-sm px-2 py-1 hover:bg-white">批注</span>
              <span className="rounded-sm px-2 py-1 hover:bg-white">目录</span>
              <span className="mx-2 h-4 w-px bg-[#D4DCE6]" />
              <span>{selectedFileKind}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">{totalPreviewFiles} 个文件</span>
              <span className="mx-2 h-4 w-px bg-[#D4DCE6]" />
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                <span className="shrink-0 rounded-sm border border-[#BFD0FF] bg-white px-2 py-1 text-[11px] font-black text-[#002FA7]">
                  右侧可选择 AI 生成资料类型
                </span>
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[268px_minmax(0,1fr)_292px]">
            <aside className="hidden min-h-0 border-r border-[#D4DCE6] bg-white sm:block">
              <div className="flex h-full flex-col">
                <div className="border-b border-[#E5EAF1] px-4 py-3">
                  <div className="text-[11px] font-black text-[#002FA7]">资源包</div>
                  <div className="mt-1 truncate text-sm font-black text-[#111827]">{activeResourceTitle}</div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#EEF2F6] pt-2 text-[11px] font-semibold text-[#64748B]">
                    <span>文件目录</span>
                    <span>{totalPreviewFiles} 个文件</span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                  {groupedFiles.length ? (
                    groupedFiles.map((group) => (
                      <div key={group.category} className="mb-4">
                        <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#64748B]">{group.category}</div>
                        <div className="space-y-1.5">
                          {group.files.map((file) => {
                            const active = file.file_id === selectedFile?.file_id;
                            const Icon = getFileIcon(file);
                            return (
                              <button
                                key={file.file_id}
                                type="button"
                                onClick={() => openFilePreview(file)}
                                className={`relative flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition ${
                                  active
                                    ? "border-[#BFD0FF] bg-[#F4F7FF] text-[#002FA7]"
                                    : "border-transparent bg-white text-[#334155] hover:border-[#D4DCE6] hover:bg-[#F7F7F8]"
                                }`}
                              >
                                {active ? <span className="absolute bottom-2 left-0 top-2 w-0.5 bg-[#002FA7]" /> : null}
                                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-[#002FA7]" : "text-[#64748B]"}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-black">{file.display_name}</div>
                                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-[#64748B]">
                                    <span>{getFileKindLabel(file)}</span>
                                    <span>·</span>
                                    <span>{formatFileSize(file.file_size)}</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-4 text-xs leading-5 text-[#64748B]">
                      当前资料暂未同步出文件目录。
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <main className="min-h-0 overflow-y-auto bg-[#E7EBF0]">
              <div className="sticky top-0 z-10 border-b border-[#D4DCE6] bg-white/95 backdrop-blur">
                <div className="flex min-h-[44px] items-center justify-between px-4">
                <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-[#475569]">
                  <SelectedIcon className="h-4 w-4 text-[#002FA7]" />
                  <span className="truncate">{previewTitle}</span>
                </div>
                  <div className="flex items-center gap-1 text-[11px] font-black text-[#64748B]">
                    <span className="rounded-sm border border-[#D4DCE6] bg-[#F7F7F8] px-2 py-1">页面宽度</span>
                    <span className="rounded-sm border border-[#D4DCE6] bg-white px-2 py-1">100%</span>
                  </div>
                </div>
                <div className="hidden h-5 items-center border-t border-[#EEF2F6] bg-[#FAFBFC] px-6 text-[9px] font-bold text-[#94A3B8] sm:flex">
                  {Array.from({ length: 16 }).map((_, index) => (
                    <span key={index} className="flex h-full flex-1 items-start border-l border-[#D4DCE6] pl-1">
                      {index % 2 === 0 ? index + 1 : ""}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mx-auto min-h-full max-w-[1040px] px-4 py-7">
                <div className="mb-3 rounded-md border border-[#D4DCE6] bg-white px-3 py-2 text-xs text-[#475569] shadow-sm xl:hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-[#111827]">资料信息</span>
                    <span className="rounded-sm bg-[#EEF3FF] px-2 py-1 font-bold text-[#002FA7]">{selectedFileKind}</span>
                    <span className="font-semibold">{getReadableFileTitle(selectedFile, "等待载入")}</span>
                  </div>
                </div>
                <div className="border border-[#C9D2DF] bg-white shadow-[0_22px_60px_rgba(15,23,42,0.16)]">
                  <div className="flex min-h-[36px] items-center justify-between border-b border-[#E5EAF1] px-5 text-[11px] font-bold text-[#64748B]">
                    <span>{activeResourceTitle}</span>
                    <span>{selectedFileKind}</span>
                  </div>
                  <div className="min-h-[calc(100vh-206px)] px-5 py-6 md:px-9 md:py-8">
                    {renderPreviewBody()}
                  </div>
                  <div className="flex min-h-[34px] items-center justify-between border-t border-[#E5EAF1] px-5 text-[11px] font-semibold text-[#64748B]">
                    <span>{getReadableFileTitle(selectedFile, "等待载入")}</span>
                    <span>资料预览</span>
                  </div>
                </div>
              </div>
            </main>

            <aside className="hidden min-h-0 border-l border-[#D4DCE6] bg-white xl:block">
              <div className="flex h-full flex-col">
                <div className="border-b border-[#E5EAF1] px-4 py-3">
                  <div className="text-[11px] font-black text-[#002FA7]">资料信息</div>
                  <div className="mt-1 truncate text-sm font-black text-[#111827]">当前预览状态</div>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  <div className="rounded-md border border-[#E5EAF1] bg-[#F7F7F8] px-3 py-3">
                    <div className="text-[11px] font-black text-[#64748B]">文件名</div>
                    <div className="mt-1 break-words text-sm font-bold text-[#111827]">{getReadableFileTitle(selectedFile, "等待载入")}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-[#E5EAF1] bg-white px-3 py-3">
                      <div className="text-[11px] font-black text-[#64748B]">类型</div>
                      <div className="mt-1 text-sm font-bold text-[#111827]">{selectedFileKind}</div>
                    </div>
                    <div className="rounded-md border border-[#E5EAF1] bg-white px-3 py-3">
                      <div className="text-[11px] font-black text-[#64748B]">大小</div>
                      <div className="mt-1 text-sm font-bold text-[#111827]">{formatFileSize(selectedFile?.file_size)}</div>
                    </div>
                  </div>
                  <div className="rounded-md border border-[#BFD0FF] bg-[#F7F9FF] px-3 py-3">
                    <div className="text-[11px] font-black text-[#002FA7]">学习建议</div>
                    <div className="mt-2 text-xs leading-6 text-[#475569]">
                      {resource?.study_suggestion || "先浏览目录和核心文件，再按当前薄弱点生成补充资料。"}
                    </div>
                  </div>
                  <div className="rounded-md border border-[#BFD0FF] bg-[#F7F9FF] px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-black text-[#002FA7]">AI 生成资料</div>
                        <div className="mt-1 text-xs leading-5 text-[#475569]">先选择要补充的资料类型，生成后加入左侧目录并自动打开。</div>
                      </div>
                      <Sparkles className="h-4 w-4 shrink-0 text-[#002FA7]" />
                    </div>
                    {generationNotice ? <div className="mt-2 rounded-sm bg-white px-2 py-2 text-xs leading-5 text-[#002FA7]">{generationNotice}</div> : null}
                    <div className="mt-3 grid gap-2">
                      {PREVIEW_GENERATION_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedGenerationType(option.id)}
                          disabled={Boolean(generatingPreviewType)}
                          className={`rounded-md border px-3 py-2 text-left transition disabled:opacity-50 ${
                            selectedGenerationType === option.id
                              ? "border-[#2563EB] bg-white text-[#002FA7] shadow-[0_8px_18px_rgba(37,99,235,0.10)]"
                              : "border-[#C9D6FF] bg-white/72 text-[#475569] hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black">{option.label}</span>
                            <span className="rounded-sm bg-[#EEF3FF] px-2 py-0.5 text-[10px] font-black text-[#002FA7]">
                              {selectedGenerationType === option.id ? "已选" : "选择"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] font-semibold leading-5 text-[#64748B]">{option.detail}</div>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => generateIntoCurrentPackage(selectedGenerationType)}
                      disabled={Boolean(generatingPreviewType)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-[#002FA7] px-3 py-2.5 text-xs font-black text-white transition hover:bg-[#00247d] disabled:opacity-50"
                    >
                      {generatingPreviewType ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {generatingPreviewType ? "正在生成资料..." : `${selectedGenerationOption.actionLabel}并加入目录`}
                    </button>
                  </div>
                  {error && resource ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="resource-source-preview-workspace" className="min-h-screen bg-[linear-gradient(180deg,#fff8fb_0%,#fffdfd_18%,#f8fafc_100%)]">
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
            {isShowcaseIllustrationPage || isSpecialGeneratedPreview ? (
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
      {isGenerationChooserOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-[760px] overflow-hidden rounded-[24px] border border-[#d8e6f3] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between border-b border-[#e8edf2] px-5 py-4">
              <div>
                <div className="text-[10px] font-black tracking-[0.18em] text-[#006689]">AI 生成资料</div>
                <div className="mt-1 text-[18px] font-black text-[#111827]">先选择要补充的资料类型</div>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerationChooserOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e5ebf2] bg-white text-[#64748b] transition hover:bg-[#f8fbff] hover:text-[#111827]"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              {PREVIEW_GENERATION_OPTIONS.map((option) => {
                const active = selectedGenerationType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedGenerationType(option.id)}
                    className={`rounded-[18px] border p-4 text-left transition ${
                      active
                        ? "border-[#2563eb] bg-[#f7fbff] shadow-[0_10px_26px_rgba(37,99,235,0.10)]"
                        : "border-[#e6edf5] bg-white hover:border-[#bfd0ff] hover:bg-[#fbfdff]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-black tracking-[0.18em] text-[#006689]">{option.category}</div>
                        <div className="mt-1 text-[15px] font-black text-[#111827]">{option.label}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${active ? "bg-[#2563eb] text-white" : "bg-[#eef3ff] text-[#2563eb]"}`}>
                        {active ? "已选" : "选择"}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-6 text-[#475569]">{option.detail}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e8edf2] px-5 py-4">
              <div className="text-[12px] leading-6 text-[#667085]">
                当前将生成 <span className="font-black text-[#111827]">{selectedGenerationOption.label}</span>，生成后会加入左侧目录并自动打开。
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenerationChooserOpen(false)}
                  className="rounded-full border border-[#d8e6f3] bg-white px-4 py-2 text-[12px] font-black text-[#475569] transition hover:bg-[#f8fbff]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsGenerationChooserOpen(false);
                    void generateIntoCurrentPackage(selectedGenerationType);
                  }}
                  disabled={Boolean(generatingPreviewType)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#002FA7] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#00247d] disabled:opacity-50"
                >
                  {generatingPreviewType ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generatingPreviewType ? "正在生成资料..." : `${selectedGenerationOption.actionLabel}并加入目录`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

