# 04-作品源码

本目录放置 AI 数据标注实训智能体的最终验收源码、规则库、候选知识目录、自动化检查和启动说明。核心入口为 `a3-student-react-web/src/pages/AIAnnotationAgent.tsx`，3 条核心规则位于 `src/data/aiAnnotationRules.ts`，K001–K060 共 60 条候选知识条目位于 `src/data/aiAnnotationKnowledge.ts`。

源码清单见 `AI数据标注实训智能体-源码清单.md`；本地启动使用 `scripts/start-ai-annotation.ps1`，默认访问 `/annotation-agent`。提交前需运行 lint、build、smoke 和材料审计，并把结果放入补充材料。

封包后的官方目录映射为 `04-作品代码/source/`。评审机解压后可在该目录执行：

```powershell
Set-Location .\04-作品代码\source\a3-student-react-web
npm ci
npm run lint
npm run build
npm run smoke:ai-annotation-agent
```

需要直接启动页面时，从预提交包根目录运行
`powershell -NoProfile -ExecutionPolicy Bypass -File .\04-作品代码\source\scripts\start-ai-annotation.ps1`；脚本默认使用 3002 端口。

严禁将密钥、`.env`、数据库、日志、`tmp/`、`node_modules/`、构建缓存、未授权原始图片或个人敏感信息放入源码包。历史工程文件如仍在工作区，仅供开发兼容，不作为本次 AI 作品源码清单的一部分。
