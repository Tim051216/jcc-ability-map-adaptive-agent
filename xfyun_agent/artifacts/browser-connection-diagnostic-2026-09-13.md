# Browser connection diagnostic (2026-09-13)

## Read-only checks

- Browser runtime initialized successfully with `scripts/browser-client.mjs`.
- Browser inventory exposes Chrome and Edge extension backends plus Codex In-app Browser.
- Chrome and Edge extension `openTabs()`/`tabs.list()` fail before tab discovery with `unsupported Codex auth method: apikey`.
- The native-host manifest exists at `C:\\Users\\Administrator\\AppData\\Local\\OpenAI\\extension\\com.openai.codexextension.json`.
- A fresh diagnostic now reports the Chrome native-messaging registry value present and valid:
  `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.openai.codexextension` (`correct: true`).
- Chrome User Data exists and the ChatGPT extension is installed and enabled in the `Default` profile.
- Chrome is running. Despite these healthy local checks, the Browser Runtime still rejects extension tab discovery with `unsupported Codex auth method: apikey`; the remaining fault is the Codex session authentication mode, not local extension installation.

## In-app Browser fallback

- IAB browser can create a tab and load:
  `https://agent.xfyun.cn/agentbuilder/work_flow/661895/arrange`
- Page title: `讯飞星辰Agent平台-一站式智能体开发平台`
- Visible state: workflow `软件开发岗位能力自适应教练`, `编辑中`, `已自动保存`, and `更新发布` button.
- Existing visible nodes include `开始`, `结束`, `大模型_1`, `知识库_1`, and `软件开发岗位能力插件_1`.
- The plugin node exposes inputs `refresh`, `professional_group`, `core_job`, `source_urls` and outputs including `fetched_count`, `sample_count`, `skills`, `alerts`, `recommendations`, and `optimization_plan`.
- No WebMCP tools are exposed by the page.

## Read-only Trace check

- The workflow's Trace log page showed a latest successful run on 2026-09-13 from 10:47:23 to 10:47:48 (24.79 s).
- The workflow detail page's published-version table showed `暂无数据` at the time of inspection.
- Identifiers and response bodies were intentionally omitted from this record.

No credentials, tokens, or session data were read or recorded. No write action, upload, publish, or workflow mutation was performed.
