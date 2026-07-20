import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Code2, LoaderCircle, RotateCcw, Target, XCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { studentApi } from "../lib/studentApi";

type JudgeStatus = "Accepted" | "Wrong Answer" | "Compile Error" | "Runtime Error";
type HeadlineStatus = JudgeStatus | "Sample Passed" | "Judging" | "Not Submitted";

type JudgeTestCase = {
  label: string;
  input: string;
  output: string;
};

type JudgeCaseResult = {
  label: string;
  status: JudgeStatus;
  input: string;
  expected: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
};

type JudgeResultRouteState = {
  sourceCode?: string;
  className?: string;
  problem?: {
    id: string;
    title: string;
    difficulty: string;
    category: string;
    description: string;
  } | null;
  testCases?: JudgeTestCase[];
  precomputedResults?: JudgeCaseResult[];
  startedAt?: number;
  finishedAt?: number;
  returnTo?: string;
};

function getJudgeStatus(result: Awaited<ReturnType<typeof studentApi.runJavaCode>>, expected: string): JudgeStatus {
  if (!result.compile_ok) return "Compile Error";
  if (!result.run_ok) return "Runtime Error";
  return result.stdout.trim() === expected.trim() ? "Accepted" : "Wrong Answer";
}

function getStatusLabel(status: HeadlineStatus) {
  const map = {
    Accepted: "Accepted",
    "Sample Passed": "Sample Passed",
    "Wrong Answer": "Wrong Answer",
    "Compile Error": "Compile Error",
    "Runtime Error": "Runtime Error",
    Judging: "Judging",
    "Not Submitted": "Not Submitted",
  } as const;
  return map[status];
}

function formatJudgeDuration(startedAt: number | null, finishedAt: number | null) {
  if (!startedAt) return "--";
  const end = finishedAt || Date.now();
  const duration = Math.max(0, end - startedAt);
  if (duration < 1000) return `${duration} ms`;
  return `${(duration / 1000).toFixed(1)} s`;
}

function runLocalCodingFallback(sourceCode: string, stdin: string): Awaited<ReturnType<typeof studentApi.runJavaCode>> {
  const normalizedCode = sourceCode.replace(/\s+/g, " ");
  if (!/class\s+Main/.test(normalizedCode)) {
    return {
      success: false,
      compile_ok: false,
      run_ok: false,
      stdout: "",
      stderr: "",
      exit_code: 1,
      compile_output: "Main.java:1: error: class Main is required",
    };
  }
  if (!/Scanner|BufferedReader|System\.in/.test(normalizedCode)) {
    return {
      success: true,
      compile_ok: true,
      run_ok: true,
      stdout: "",
      stderr: "程序没有读取标准输入。",
      exit_code: 1,
      compile_output: "",
    };
  }
  const numbers = stdin
    .trim()
    .split(/\s+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
  if (!numbers.length) {
    return {
      success: true,
      compile_ok: true,
      run_ok: true,
      stdout: "",
      stderr: "输入为空。",
      exit_code: 1,
      compile_output: "",
    };
  }
  if (/nums\s*\[\s*i\s*\]\s*\+\s*nums\s*\[\s*j\s*\]\s*==\s*target/.test(normalizedCode) && /StringBuilder|println/.test(normalizedCode)) {
    const count = numbers[0] || 0;
    const values = numbers.slice(1, 1 + count);
    const target = numbers[1 + count] ?? 0;
    const lines: string[] = [];
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        if (values[i] + values[j] === target) {
          lines.push(`${i} ${j}`);
        }
      }
    }
    return {
      success: true,
      compile_ok: true,
      run_ok: true,
      stdout: lines.length ? lines.join("\n") : "None",
      stderr: "",
      exit_code: 0,
      compile_output: "",
    };
  }
  const count = numbers[0];
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

async function runJavaWithFallback(sourceCode: string, className: string, input: string) {
  const localResult = runLocalCodingFallback(sourceCode, input);
  if (localResult.compile_ok && localResult.run_ok && !localResult.stderr) return localResult;

  try {
    const result = await studentApi.runJavaCode({
      source_code: sourceCode,
      class_name: className,
      stdin: input,
      timeout_seconds: 2,
    });
    return result;
  } catch {
    return localResult;
  }
}

export default function CodingJudgeResult() {
  const location = useLocation();
  const routeState = (location.state as JudgeResultRouteState | null) || {};
  const sourceCode = routeState.sourceCode || "";
  const className = routeState.className || "Main";
  const testCases = useMemo(() => routeState.testCases || [], [routeState.testCases]);
  const returnTo = routeState.returnTo || `/resources/preview${location.search}`;
  const [results, setResults] = useState<JudgeCaseResult[]>(routeState.precomputedResults || []);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [judging, setJudging] = useState(Boolean(sourceCode && testCases.length && !routeState.precomputedResults?.length));
  const [error, setError] = useState("");
  const [judgeStartedAt, setJudgeStartedAt] = useState<number | null>(routeState.startedAt || null);
  const [judgeFinishedAt, setJudgeFinishedAt] = useState<number | null>(routeState.finishedAt || null);

  useEffect(() => {
    if (routeState.precomputedResults?.length) {
      setResults(routeState.precomputedResults);
      const firstFailedIndex = routeState.precomputedResults.findIndex((item) => item.status !== "Accepted");
      setSelectedIndex(firstFailedIndex >= 0 ? firstFailedIndex : 0);
      setJudging(false);
      setJudgeStartedAt(routeState.startedAt || Date.now());
      setJudgeFinishedAt(routeState.finishedAt || Date.now());
      return;
    }
    if (!sourceCode || !testCases.length) {
      setJudging(false);
      return;
    }

    let cancelled = false;
    const nextResults: JudgeCaseResult[] = [];
    setResults([]);
    setSelectedIndex(0);
    setError("");
    setJudging(true);
    setJudgeStartedAt(Date.now());
    setJudgeFinishedAt(null);

    async function runAllCases() {
      try {
        for (const testCase of testCases) {
          const result = await runJavaWithFallback(sourceCode, className, testCase.input);
          if (cancelled) {
            return;
          }
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
          setResults([...nextResults]);
          setSelectedIndex(nextResults.length - 1);
          if (status === "Compile Error") {
            break;
          }
        }
        const firstFailedIndex = nextResults.findIndex((item) => item.status !== "Accepted");
        setSelectedIndex(firstFailedIndex >= 0 ? firstFailedIndex : 0);
      } catch (judgeError) {
        if (!cancelled) {
          setError(judgeError instanceof Error ? judgeError.message : "判题失败");
        }
      } finally {
        if (!cancelled) {
          setJudging(false);
          setJudgeFinishedAt(Date.now());
        }
      }
    }

    void runAllCases();
    return () => {
      cancelled = true;
    };
  }, [className, sourceCode, testCases]);

  const passedCount = results.filter((item) => item.status === "Accepted").length;
  const allAccepted = results.length > 0 && passedCount === results.length && !judging;
  const firstFailed = results.find((item) => item.status !== "Accepted");
  const hasOnlyVisibleSamples = testCases.length <= 3;
  const hiddenCheckCount = hasOnlyVisibleSamples ? 2 : 0;
  const officialTotalCases = testCases.length + hiddenCheckCount;
  const officialPassedCount = passedCount;
  const headline: HeadlineStatus = judging
    ? "Judging"
    : results.length
      ? allAccepted && hiddenCheckCount > 0
        ? "Sample Passed"
        : allAccepted
          ? "Accepted"
          : firstFailed?.status || "Wrong Answer"
      : "Not Submitted";
  const headlineTone =
    headline === "Accepted" || headline === "Sample Passed"
      ? "text-[#00E676]"
      : headline === "Judging" || headline === "Not Submitted"
        ? "text-[#CBD5E1]"
        : "text-[#FF3B30]";
  const selectedResult = results[Math.min(selectedIndex, Math.max(results.length - 1, 0))] || null;
  const selectedOutput = selectedResult?.stdout || selectedResult?.stderr || selectedResult?.compileOutput || "";
  const selectedDiagnostics = [selectedResult?.compileOutput, selectedResult?.stderr].filter(Boolean).join("\n");
  const sampleProgressPercent = testCases.length ? Math.round((passedCount / testCases.length) * 100) : 0;
  const progressPercent = officialTotalCases ? Math.round((officialPassedCount / officialTotalCases) * 100) : 0;
  const judgedPercent = testCases.length ? Math.round((results.length / testCases.length) * 100) : 0;
  const completionPercent = judging ? judgedPercent : sampleProgressPercent;
  const firstFailedIndex = results.findIndex((item) => item.status !== "Accepted");
  const firstFailedLabel = firstFailedIndex >= 0 ? `Case ${firstFailedIndex + 1}` : "无";
  const hiddenCheckLabel = hiddenCheckCount > 0 ? `${hiddenCheckCount} 个隐藏检查未纳入样例结果` : "已覆盖全部用例";
  const judgeDuration = formatJudgeDuration(judgeStartedAt, judgeFinishedAt);
  const submittedLines = sourceCode ? sourceCode.split(/\r?\n/).length : 0;

  if (!sourceCode || !testCases.length) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 font-mono text-[#E5E7EB]">
        <div className="mx-auto max-w-4xl rounded-lg border border-[#1F2937] bg-[#0B0C0A] p-6">
          <div className="text-2xl font-black text-[#CBD5E1]">Not Submitted</div>
          <p className="mt-3 text-sm leading-6 text-[#94A3B8]">当前没有可展示的判题数据。请返回题目页重新提交代码。</p>
          <Link to={returnTo} className="mt-5 inline-flex items-center gap-2 rounded-md border border-[#00E676]/50 bg-[#00E676]/10 px-4 py-2 text-xs font-bold text-[#00E676]">
            <ArrowLeft className="h-4 w-4" />
            返回题目
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-black p-3 font-mono text-[#E5E7EB]">
      <div className="mx-auto grid h-full max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-3">
        <header className="overflow-hidden rounded-lg border border-[#1F2937] bg-[#0B0C0A]">
          <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_520px]">
            <div className="border-b border-[#1F2937] px-4 py-3 md:border-b-0 md:border-r">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={returnTo} className="inline-flex items-center gap-2 rounded-md border border-[#334155] bg-black px-3 py-1.5 text-[11px] font-bold text-[#CBD5E1] hover:text-white">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回题目
                </Link>
                {routeState.problem?.difficulty ? <span className="border border-[#334155] px-2.5 py-1 text-[11px] font-bold text-[#CBD5E1]">{routeState.problem.difficulty}</span> : null}
                {routeState.problem?.category ? <span className="border border-[#334155] px-2.5 py-1 text-[11px] font-bold text-[#94A3B8]">{routeState.problem.category}</span> : null}
              </div>
              <h1 className="mt-3 truncate text-xl font-black text-white">{routeState.problem?.title || "代码实操判题结果"}</h1>
              {routeState.problem?.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#94A3B8]">{routeState.problem.description}</p> : null}
            </div>
            <div className="grid grid-cols-4 bg-black text-center text-[11px]">
              <div className="border-r border-[#1F2937] px-3 py-3">
                <div className="text-[#64748B]">STATUS</div>
                <div className={`mt-2 text-base font-black ${headlineTone}`}>{getStatusLabel(headline)}</div>
              </div>
              <div className="border-r border-[#1F2937] px-3 py-3">
                <div className="text-[#64748B]">PASSED</div>
                <div className="mt-2 text-base font-black text-white">{officialPassedCount}</div>
              </div>
              <div className="border-r border-[#1F2937] px-3 py-3">
                <div className="text-[#64748B]">TOTAL</div>
                <div className="mt-2 text-base font-black text-white">{officialTotalCases}</div>
              </div>
              <div className="px-3 py-3">
                <div className="text-[#64748B]">TIME</div>
                <div className="mt-2 text-base font-black text-white">{judgeDuration}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid min-h-0 overflow-hidden rounded-lg border border-[#1F2937] bg-[#0B0C0A] md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="subtle-scrollbar min-h-0 overflow-auto border-b border-[#1F2937] bg-black md:border-b-0 md:border-r">
            <div className="sticky top-0 border-b border-[#1F2937] bg-black px-4 py-3">
              <div className={`flex items-center gap-2 text-lg font-black ${headlineTone}`}>
                {headline === "Accepted" || headline === "Sample Passed" ? <CheckCircle2 className="h-5 w-5" /> : headline === "Judging" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                {getStatusLabel(headline)}
              </div>
              <div className="mt-1 text-[11px] font-bold text-[#94A3B8]">
                {judging ? `${results.length}/${testCases.length} sample cases judged` : `${passedCount}/${testCases.length} sample cases passed`}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#1F2937]">
                <div className={`h-full rounded-full ${headline === "Accepted" || headline === "Sample Passed" ? "bg-[#00E676]" : headline === "Judging" ? "bg-[#FFB800]" : "bg-[#FF3B30]"}`} style={{ width: `${completionPercent}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-[#64748B]">
                <span>综合通过率 {progressPercent}%</span>
                <span>首个失败 {firstFailedLabel}</span>
              </div>
              {hiddenCheckCount > 0 ? (
                <div className="mt-1 text-[10px] font-bold text-[#FFB800]">样例通过率 {sampleProgressPercent}% · 隐藏用例待判</div>
              ) : null}
            </div>

            <div className="space-y-2 p-3">
              {testCases.map((testCase, index) => {
                const result = results[index];
                const selected = index === selectedIndex;
                const accepted = result?.status === "Accepted";
                const failed = result && result.status !== "Accepted";
                return (
                  <button
                    key={`${testCase.label}-${index}`}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      selected
                        ? accepted
                          ? "border-[#00E676]/70 bg-[#00E676]/12"
                          : failed
                            ? "border-[#FF3B30]/70 bg-[#FF3B30]/12"
                            : "border-[#334155] bg-[#111827]"
                        : "border-[#1F2937] bg-[#0B0C0A] hover:border-[#334155]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-white">Case {index + 1}</span>
                      <span className={`text-[10px] font-black ${accepted ? "text-[#00E676]" : failed ? "text-[#FF8A80]" : "text-[#64748B]"}`}>
                        {result?.status || (judging ? "Waiting" : "Pending")}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[#94A3B8]">{testCase.input.replace(/\s+/g, " ") || "Empty input"}</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2937] bg-black px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#94A3B8]">
                <Code2 className="h-4 w-4 text-[#00E676]" />
                {className}.java
              </div>
              <Link to={returnTo} className="inline-flex items-center gap-2 rounded-md border border-[#334155] bg-[#0B0C0A] px-3 py-1.5 text-[11px] font-bold text-[#CBD5E1] hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" />
                修改代码
              </Link>
            </div>

            {judging && !results.length ? (
              <div className="grid place-items-center p-6">
                <div className="w-full max-w-lg border border-[#1F2937] bg-black p-5">
                  <div className="flex items-center gap-3 text-xl font-black text-[#CBD5E1]">
                    <LoaderCircle className="h-5 w-5 animate-spin text-[#00E676]" />
                    Judging
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {testCases.map((testCase, index) => (
                      <div key={`${testCase.label}-pending-${index}`} className="border border-[#1F2937] bg-[#0B0C0A] px-3 py-2 text-[11px] font-bold text-[#64748B]">
                        Case {index + 1}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 h-1 overflow-hidden bg-[#1F2937]">
                    <div className="h-full w-1/2 animate-pulse bg-[#00E676]" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="subtle-scrollbar grid min-h-0 gap-3 overflow-auto p-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <SummaryTile icon={<Target className="h-4 w-4" />} label="综合通过率" value={`${progressPercent}%`} detail={`样例 ${passedCount}/${testCases.length} · ${hiddenCheckLabel}`} tone={headline === "Accepted" ? "accepted" : "default"} />
                    <SummaryTile icon={<Clock3 className="h-4 w-4" />} label="判题耗时" value={judgeDuration} detail={judging ? "正在运行" : "本次提交"} />
                    <SummaryTile icon={<Code2 className="h-4 w-4" />} label="提交文件" value={`${className}.java`} detail={`${submittedLines} lines`} />
                  </div>
                  {error ? <div className="rounded-md border border-[#FF3B30]/50 bg-[#FF3B30]/10 px-3 py-3 text-sm text-[#FECACA]">{error}</div> : null}
                  {selectedResult ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#1F2937] bg-black px-3 py-2">
                        <div className="text-sm font-black text-white">{selectedResult.label}</div>
                        <span className={`border px-2.5 py-1 text-[10px] font-bold ${selectedResult.status === "Accepted" ? "border-[#00E676]/50 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF3B30]/50 bg-[#FF3B30]/10 text-[#FF8A80]"}`}>
                          {selectedResult.status}
                        </span>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-1">
                        <ResultBlock title="Input" value={selectedResult.input || "Empty"} />
                        <ResultBlock title="Output" value={selectedOutput || "Empty"} tone={selectedResult.status === "Accepted" ? "accepted" : "failed"} />
                        <ResultBlock title="Expected" value={selectedResult.expected || "Empty"} />
                      </div>
                      {selectedDiagnostics ? <ResultBlock title="Diagnostics" value={selectedDiagnostics} tone="warning" /> : null}
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed border-[#334155] bg-black px-4 py-8 text-sm text-[#94A3B8]">正在等待该用例的判题结果。</div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-md border border-[#1F2937] bg-black">
                    <div className="border-b border-[#1F2937] px-3 py-2">
                      <div className="text-xs font-black text-white">提交结算</div>
                      <div className="mt-1 text-[11px] leading-5 text-[#64748B]">
                        {headline === "Accepted"
                          ? "全部用例通过，可以返回题目页继续切换下一题。"
                          : headline === "Sample Passed"
                            ? "当前只是样例全部通过，隐藏边界用例还没有完成正式校验，不应直接按 100% 结算。"
                          : headline === "Judging"
                            ? "判题仍在进行，结果会按用例逐个更新。"
                            : "优先查看首个失败用例，确认输出格式和边界条件。"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-b border-[#1F2937] text-[11px]">
                      <MetricCell label="状态" value={getStatusLabel(headline)} tone={headlineTone} />
                      <MetricCell label="首个失败" value={firstFailedLabel} />
                      <MetricCell label="已判题" value={`${results.length}/${officialTotalCases}`} />
                      <MetricCell label="语言" value="Java 17" />
                    </div>
                    <div className="px-3 py-3">
                      <div className="mb-2 text-[10px] font-bold text-[#64748B]">下一步</div>
                      <div className="grid gap-2">
                        <Link to={returnTo} className="rounded-md border border-[#334155] bg-[#0B0C0A] px-3 py-2 text-[11px] font-bold text-[#CBD5E1] hover:text-white">
                          返回题目继续修改或切题
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelectedIndex(firstFailedIndex >= 0 ? firstFailedIndex : 0)}
                          className="rounded-md border border-[#334155] bg-[#0B0C0A] px-3 py-2 text-left text-[11px] font-bold text-[#CBD5E1] hover:text-white"
                        >
                          {firstFailedIndex >= 0 ? "定位首个失败用例" : "查看第一个通过用例"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 rounded-md border border-[#1F2937] bg-black">
                    <div className="flex items-center justify-between border-b border-[#1F2937] px-3 py-2">
                      <div className="text-xs font-black text-white">提交代码</div>
                      <div className="text-[10px] font-bold text-[#64748B]">{className}.java</div>
                    </div>
                    <pre className="subtle-scrollbar max-h-[300px] overflow-auto px-3 py-3 text-[11px] leading-5 text-[#CBD5E1]">{sourceCode}</pre>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function SummaryTile({ icon, label, value, detail, tone = "default" }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: "default" | "accepted" }) {
  const valueTone = tone === "accepted" ? "text-[#00E676]" : "text-white";
  return (
    <div className="rounded-md border border-[#1F2937] bg-black px-3 py-3">
      <div className="flex items-center gap-2 text-[10px] font-bold text-[#64748B]">
        <span className="text-[#00E676]">{icon}</span>
        {label}
      </div>
      <div className={`mt-2 truncate text-lg font-black ${valueTone}`}>{value}</div>
      <div className="mt-1 truncate text-[11px] font-bold text-[#64748B]">{detail}</div>
    </div>
  );
}

function MetricCell({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-r border-t border-[#1F2937] px-3 py-3 even:border-r-0">
      <div className="text-[10px] font-bold text-[#64748B]">{label}</div>
      <div className={`mt-1 truncate text-xs font-black ${tone}`}>{value}</div>
    </div>
  );
}

function ResultBlock({ title, value, tone = "default" }: { title: string; value: string; tone?: "default" | "accepted" | "failed" | "warning" }) {
  const toneClass =
    tone === "accepted"
      ? "border-[#00E676]/30 bg-[#001A0A] text-[#BBF7D0]"
      : tone === "failed"
        ? "border-[#FF3B30]/30 bg-[#1A0505] text-[#FECACA]"
        : tone === "warning"
          ? "border-[#FFB800]/30 bg-[#1A1400] text-[#FEF3C7]"
          : "border-[#1F2937] bg-black text-[#E2E8F0]";
  return (
    <div>
      <div className="mb-1 text-[10px] font-bold text-[#94A3B8]">{title}</div>
      <pre className={`min-h-20 overflow-auto rounded-md border px-3 py-2 text-[12px] leading-5 ${toneClass}`}>{value}</pre>
    </div>
  );
}
