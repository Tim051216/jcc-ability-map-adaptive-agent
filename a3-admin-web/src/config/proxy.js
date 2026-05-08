export default {
  local: {
    // 本地开发通过 Vite 代理转发到网关，避免浏览器跨域
    host: '/api',
    // 本地开发暂不单独配置 CDN
    cdn: '',
  },
  development: {
    // 上游演示环境同样通过 Vite 代理转发，便于直接运行
    host: '/api',
    // 演示环境 CDN 路径
    cdn: '',
  },
  mock: {
    // mock 模式仍通过代理转发，避免浏览器跨域
    host: '/api',
    cdn: '',
  },
  test: {
    // 测试环境接口地址
    host: 'https://tjxt-admin-t.itheima.net/api',
    // 测试环境 CDN 路径
    cdn: '',
  },
  product: {
    // 兼容原始项目的预发布接口
    host: 'https://service-bv448zsw-1257786608.gz.apigw.tencentcs.com',
    // 预发布环境 CDN 路径
    cdn: '',
  },
  pro: {
    // 上游正式环境接口地址
    host: 'https://tjxt-api.itheima.net',
    // 正式环境 CDN 路径
    cdn: '',
  },
};
