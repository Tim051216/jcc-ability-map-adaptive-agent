# AI 数据标注实训智能体源码清单

## 运行入口

| 项目 | 路径 |
|---|---|
| React 页面 | `a3-student-react-web/src/pages/AIAnnotationAgent.tsx` |
| 规则库 | `a3-student-react-web/src/data/aiAnnotationRules.ts` |
| 候选知识目录 | `a3-student-react-web/src/data/aiAnnotationKnowledge.ts`（K001–K060，共 60 条） |
| 路由与独立页面壳 | `a3-student-react-web/src/App.tsx` |
| 启动脚本 | `scripts/start-ai-annotation.ps1` |
| 浏览器回归 | `a3-student-react-web/scripts/smoke-ai-annotation-agent.ts` |
| 交付审计 | `a3-student-react-web/scripts/audit-ai-annotation-deliverables.ts` |
| 提交前外部证据预检 | `a3-student-react-web/scripts/audit-ai-annotation-submission.ts` |
| 预提交包验真 | `scripts/verify-ai-annotation-package.ps1` |

## 复现命令

```powershell
Set-Location .\a3-student-react-web
npm ci
npm run lint
npm run build
npm run smoke:ai-annotation-agent
npm run audit:ai-annotation-deliverables
npm run audit:ai-annotation-submission
powershell -NoProfile -ExecutionPolicy Bypass -File ..\scripts\verify-ai-annotation-package.ps1 -ArchivePath ..\output\<最新预提交包>.zip
```

## 建议纳入源码包的内容

- `src/pages/AIAnnotationAgent.tsx`
- `src/data/aiAnnotationRules.ts`
- `src/data/aiAnnotationKnowledge.ts` 与 `../AI数据标注实训智能体-知识库目录.md`
- `src/App.tsx` 与 `vite.config.ts`
- `package.json`、锁文件和 TypeScript 配置
- `scripts/smoke-ai-annotation-agent.ts`
- `scripts/audit-ai-annotation-deliverables.ts`
- `scripts/audit-ai-annotation-submission.ts`（默认报告缺口；`-- --strict` 作为真人材料齐备后的门禁）
- `scripts/verify-ai-annotation-package.ps1`（解包后核对必需文件、SHA-256 和禁止内容）
- `scripts/start-ai-annotation.ps1`
- 本目录 README、根目录 AI 版改造基线和 Demo 指南

## 不得纳入源码包的内容

- `.env`、模型密钥、访问令牌、密码和个人信息
- `node_modules/`、`dist/`、本地数据库和运行日志
- `tmp/`、上传文件、浏览器缓存和未授权原始图片
- 未取得再分发授权的整本标准 PDF
- 把 AI 模拟反馈改名为真实用户反馈

最终压缩包应由 `scripts/package-ai-annotation.ps1` 生成并使用其 manifest 核对排除项。
