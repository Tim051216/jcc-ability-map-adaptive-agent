const env = import.meta.env;

const API_HOSTS = {
  test: env.VITE_TEST_API_BASE || 'https://tjxt-admin-t.itheima.net/api',
  product:
    env.VITE_PRODUCT_API_BASE ||
    'https://service-bv448zsw-1257786608.gz.apigw.tencentcs.com',
  pro: env.VITE_PRODUCTION_API_BASE || 'https://tjxt-api.itheima.net',
};

export default {
  devlocal: {
    // 本地开发通过 Vite 代理转发到网关，避免浏览器跨域（对应 vite --mode devlocal）
    host: '/api',
    // 本地开发暂不单独配置 CDN
    cdn: '',
  },
  development: {
    // 历史联调环境同样通过 Vite 代理转发，便于直接运行
    host: '/api',
    // 历史联调环境 CDN 路径
    cdn: '',
  },
  mock: {
    // mock 模式仍通过代理转发，避免浏览器跨域
    host: '/api',
    cdn: '',
  },
  test: {
    // 测试环境接口地址
    host: API_HOSTS.test,
    // 测试环境 CDN 路径
    cdn: '',
  },
  product: {
    // 兼容历史预发布环境的接口地址
    host: API_HOSTS.product,
    // 预发布环境 CDN 路径
    cdn: '',
  },
  pro: {
    // 历史正式联调环境接口地址
    host: API_HOSTS.pro,
    // 正式环境 CDN 路径
    cdn: '',
  },
};
