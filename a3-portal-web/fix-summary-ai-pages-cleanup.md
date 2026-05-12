# AI 页面赛题化清洗总结

## problem
- `ai-profile`、`ai-resources`、`ai-report` 三页仍残留旧项目乱码文案，页面展示不适合赛题验收。
- 部分页面过度依赖后端原始回包，一旦接口返回脏文本或暂不可用，前端就会直接暴露问题。

## root cause
- 页面源码本身仍存在历史 mojibake 文本，不是单纯终端编码显示问题。
- 缺少统一的前端兜底数据和文本清洗逻辑，导致页面稳定性不足。

## changes
- 重写 [index.vue](F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web\src\pages\learningProfile\index.vue) 为赛题化学习画像页。
- 重写 [index.vue](F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web\src\pages\resourceCenter\index.vue) 为赛题化资源推荐页。
- 重写 [index.vue](F:\A3-cnsoftbei\a3-learning-agent-system\a3-portal-web\src\pages\learningReport\index.vue) 为赛题化学习报告页。
- 为三页补充本地 fallback 演示数据、文本清洗和接口失败兜底逻辑。

## verification
- 执行 `npm run build` 通过。
- 浏览器实测 `#/main/ai-profile`、`#/main/ai-resources`、`#/main/ai-report` 为正常中文展示。
- 浏览器控制台无错误、无乱码 DOM。
