import { writeFile } from "node:fs/promises";

const baseUrl = "https://scenic-but-acquisition-criterion.trycloudflare.com";
const query = new URLSearchParams({
  refresh: "true",
  professional_group: "软件技术专业群",
  core_job: "软件开发工程师",
});

const requests = [
  {
    name: "industry",
    method: "GET",
    url: `${baseUrl}/api/v1/xa-competition/industry/jobs-analysis?${query}`,
  },
  {
    name: "ability",
    method: "POST",
    url: `${baseUrl}/api/v1/xa-competition/job-ability/generate`,
    body: {
      job_name: "软件开发工程师",
      professional_group: "软件技术专业群",
      observed_skills: ["Java", "Python", "接口开发", "软件测试", "持续集成"],
      typical_tasks: ["分析业务需求并编写任务卡", "完成接口开发与联调", "执行测试并持续交付"],
    },
  },
  {
    name: "task",
    method: "POST",
    url: `${baseUrl}/api/v1/xa-competition/learning-task/generate`,
    body: {
      work_task: "完成接口开发与联调",
      job_name: "软件开发工程师",
      professional_group: "软件技术专业群",
      industry_context: "软件产业链",
      ability_focus: ["接口开发", "联调测试"],
    },
  },
  {
    name: "adaptive",
    method: "POST",
    url: `${baseUrl}/api/v1/xa-competition/adaptive-learning/recommend`,
    body: {
      goal: "三天提升软件开发岗位能力",
      goal_scene: "岗位实训",
      job_name: "软件开发工程师",
      assessment_scores: { K01: 62, K02: 74, K03: 86, K04: 68 },
      ability_labels: {
        K01: "任务理解与规划",
        K02: "规范操作与安全",
        K03: "工具实践与交付",
        K04: "质量复盘与迁移",
      },
      completed_skills: [],
    },
  },
];

const capturedAt = new Date().toISOString();
const calls = {};
for (const request of requests) {
  const started = Date.now();
  let status = null;
  let response;
  let error = null;
  try {
    const result = await fetch(request.url, {
      method: request.method,
      headers: request.body ? { "content-type": "application/json" } : undefined,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    status = result.status;
    const text = await result.text();
    try {
      response = JSON.parse(text);
    } catch {
      response = text;
    }
  } catch (caught) {
    error = String(caught);
  }
  calls[request.name] = {
    method: request.method,
    url: request.url,
    status,
    elapsed_ms: Date.now() - started,
    request: request.body ?? null,
    response: response ?? null,
    error,
  };
  console.log(`${request.name}: ${status ?? "ERR"} (${calls[request.name].elapsed_ms} ms)`);
}

const output = {
  captured_at: capturedAt,
  timezone: "Asia/Shanghai",
  base_url: baseUrl,
  calls,
};
await writeFile(
  "F:/A3-cnsoftbei/a3-learning-agent-system/xfyun_agent/artifacts/xa-api-results-latest.json",
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);
console.log("saved xa-api-results-latest.json");
