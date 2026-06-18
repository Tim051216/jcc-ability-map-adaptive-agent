import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SmokeTask = {
  name: string;
  script: string;
};

type SmokeResult = {
  name: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  passed: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS: SmokeTask[] = [
  { name: "resource-center", script: "smoke-resource-center.ts" },
  { name: "resource-course-bundle", script: "smoke-resource-course-bundle.ts" },
  { name: "resource-supplements", script: "smoke-resource-supplements.ts" },
  { name: "resource-supplement-content", script: "smoke-resource-supplement-content.ts" },
  { name: "resource-learn", script: "smoke-resource-learn.ts" },
  { name: "resource-preview", script: "smoke-resource-preview.ts" },
];

function runTask(task: SmokeTask): Promise<SmokeResult> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", path.join(__dirname, task.script)], {
      cwd: path.resolve(__dirname, ".."),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      resolve({
        name: task.name,
        exitCode,
        stdout,
        stderr,
        passed: exitCode === 0,
      });
    });
  });
}

async function main() {
  const results: SmokeResult[] = [];

  for (const task of TASKS) {
    // Surface each task as it runs so local use feels transparent.
    console.log(`\n[smoke-resources] running ${task.name} ...`);
    const result = await runTask(task);
    results.push(result);
    process.stdout.write(result.stdout);
    if (result.stderr.trim()) {
      process.stderr.write(result.stderr);
    }
  }

  const passed = results.filter((item) => item.passed).length;
  const failed = results.length - passed;

  console.log(
    JSON.stringify(
      {
        summary: {
          total: results.length,
          passed,
          failed,
        },
        tasks: results.map((item) => ({
          name: item.name,
          exitCode: item.exitCode,
          passed: item.passed,
        })),
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
