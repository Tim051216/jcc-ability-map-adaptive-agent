import { createApp } from "vue";
import "swiper/scss";
import "swiper/scss/pagination";
import App from "./App.vue";
import "@/style/font_style/iconfont.css";
import "@/style/index.scss";

const renderBootstrapShell = () => {
  const root = document.getElementById("app");
  if (!root || root.childNodes.length) {
    return;
  }

  root.innerHTML = `
    <div style="min-height:100vh;padding:32px 16px;background:linear-gradient(180deg,#f8fbff 0%,#edf3fb 100%);font-family:'Microsoft YaHei',sans-serif;color:#172033;">
      <div style="max-width:1200px;margin:0 auto;">
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0 20px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#0f6adf 0%,#28b381 100%);color:#fff;font-size:22px;font-weight:700;">A3</div>
          <div>
            <div style="font-size:24px;font-weight:700;">A3 智能学习平台</div>
            <div style="margin-top:4px;font-size:13px;color:#64748b;">后台页面加载中，请稍候...</div>
          </div>
        </div>
        <div style="border-radius:28px;background:#ffffff;padding:28px;box-shadow:0 20px 50px rgba(15,23,42,0.08);">
          <div style="display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:999px;background:#dbeafe;color:#2563eb;font-size:13px;font-weight:700;">后台联调</div>
          <div style="margin-top:20px;height:22px;width:min(420px,100%);border-radius:999px;background:linear-gradient(90deg,#e2e8f0 0%,#f8fafc 50%,#e2e8f0 100%);"></div>
          <div style="margin-top:14px;height:16px;width:min(760px,100%);border-radius:999px;background:#eef2f7;"></div>
          <div style="margin-top:10px;height:16px;width:min(680px,92%);border-radius:999px;background:#eef2f7;"></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:24px;">
            <div style="height:128px;border-radius:22px;background:#f8fbff;border:1px solid #e8eef6;"></div>
            <div style="height:128px;border-radius:22px;background:#f8fbff;border:1px solid #e8eef6;"></div>
            <div style="height:128px;border-radius:22px;background:#f8fbff;border:1px solid #e8eef6;"></div>
            <div style="height:128px;border-radius:22px;background:#f8fbff;border:1px solid #e8eef6;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const safeParseStorageItem = (storage, key) => {
  const raw = storage.getItem(key);
  if (!raw || typeof raw !== "string") {
    return;
  }

  const normalized = raw.trim();
  if (!normalized || !["{", "["].includes(normalized[0])) {
    return;
  }

  try {
    JSON.parse(normalized);
  } catch (error) {
    storage.removeItem(key);
  }
};

const cleanupPersistedState = () => {
  // 清理格式损坏的持久化状态，避免 pinia 和路由初始化阶段被异常数据阻塞。
  const keys = ["user", "userInfo", "notification", "permission", "tabs-router", "tabsRouter"];
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    keys.forEach((key) => safeParseStorageItem(storage, key));
  });
};

const preloadA3Routes = () => {
  const loaders = [
    () => import("@/pages/learningPath/index.vue"),
    () => import("@/pages/learningProfile/index.vue"),
    () => import("@/pages/resourceCenter/index.vue"),
    () => import("@/pages/learningReport/index.vue"),
    () => import("@/pages/learningCalendar/index.vue"),
    () => import("@/pages/wrongQuestion/index.vue"),
    () => import("@/pages/evaluation/index.vue"),
    () => import("@/pages/evaluation/exam.vue"),
    () => import("@/pages/evaluation/report.vue"),
  ];

  const run = () => {
    loaders.forEach((load) => {
      load().catch(() => undefined);
    });
  };

  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 1500 });
    return;
  }

  window.setTimeout(run, 300);
};

const getInitialHashLocation = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const hash = window.location.hash || "";
  if (!hash.startsWith("#/")) {
    return "";
  }

  return hash.slice(1) || "/";
};

const syncInitialHashRoute = async (router) => {
  const target = getInitialHashLocation();
  if (!target) {
    await router.isReady();
    return;
  }

  await router.isReady();

  const expected = router.resolve(target);
  const current = router.currentRoute.value;
  if (!expected.name) {
    return;
  }

  if (current.fullPath === expected.fullPath && current.name === expected.name) {
    return;
  }

  await router.replace(expected.fullPath);
};

const bootstrap = async () => {
  cleanupPersistedState();

  const [{ store }, { default: router }] = await Promise.all([
    import("./store"),
    import("./router"),
    import("./permission"),
  ]);

  const app = createApp(App);
  app.use(store);
  app.use(router);
  app.mount("#app");
  await syncInitialHashRoute(router);
  preloadA3Routes();
};

renderBootstrapShell();
bootstrap().catch((error) => {
  console.error("A3 bootstrap failed:", error);
  const root = document.getElementById("app");
  if (root) {
    root.innerHTML = `
      <div style="padding: 48px; font-family: 'Microsoft YaHei', sans-serif; color: #172033;">
        <h2 style="margin: 0 0 16px;">A3 应用启动失败</h2>
        <p style="margin: 0; line-height: 1.8;">请刷新页面后重试，若仍失败请检查前端依赖和路由初始化日志。</p>
      </div>
    `;
  }
});
