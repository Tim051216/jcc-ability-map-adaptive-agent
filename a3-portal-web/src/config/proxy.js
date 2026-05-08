const sharedApiHost = "/api";

export default {
  local: {
    // 本地开发统一通过 Vite 代理转发到后端网关。
    host: sharedApiHost,
    cdn: "",
  },
  development: {
    // 演示环境继续复用同一代理入口，避免写死外部来源地址。
    host: sharedApiHost,
    cdn: "",
  },
  mock: {
    host: sharedApiHost,
    cdn: "",
  },
  test: {
    // 非本地部署时，可由网关、反向代理或环境层统一接管 /api。
    host: sharedApiHost,
    cdn: "",
  },
  product: {
    host: sharedApiHost,
    cdn: "",
  },
};
