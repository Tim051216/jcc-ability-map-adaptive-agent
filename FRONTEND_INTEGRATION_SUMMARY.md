# 前端接入总结

## 当前口径

- 当前默认学生端前端：`a3-student-react-web`
- 学生端默认本地端口：`3002`
- 当前默认管理端前端：`a3-admin-web`
- 管理端默认本地端口：`3004`
- `a3-portal-web` 已降级为 legacy 学生端前端，仅保留历史代码参考

## 当前建议

- 学生端开发、联调、验收默认进入 `a3-student-react-web`
- 管理端开发、联调、验收默认进入 `a3-admin-web`
- 旧的 `a3-portal-web` 不再作为默认入口，不再承担新的功能交付

## 验证

- `npm install` in `a3-admin-web`
- `npm run dev` in `a3-admin-web`
- `npm install` in `a3-student-react-web`
- `npm run dev` in `a3-student-react-web`
- 本地默认页面端口：`http://127.0.0.1:3004`、`http://127.0.0.1:3002`
