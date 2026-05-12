<template>
  <header class="headerShell">
    <div class="headerCard">
      <div class="headerMain">
        <div class="breadcrumbBlock">
          <div class="eyebrow">A3 Learning Admin</div>
          <div class="titleRow">
            <h1 class="pageTitle">{{ currentTitle }}</h1>
            <span v-if="isHome" class="sceneBadge">多智能体学习运营总览</span>
          </div>
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item
              v-for="item in breadcrumbs"
              :key="item.path"
              :to="item.clickable ? { path: item.path } : undefined"
            >
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="headerActions">
          <div v-if="isHome" class="statusCard">
            <span class="statusDot"></span>
            <div>
              <strong>演示环境运行正常</strong>
              <p>画像、路径、资源生成链路可直接演示</p>
            </div>
          </div>

          <div v-if="isToken" class="userCard">
            <router-link to="/my/index" class="userLink">
              <img class="headIcon" :src="userInfo.icon" :onerror="onerrorImg" alt="" />
              <div class="userMeta">
                <span class="userName">{{ userInfo.name || "admin" }}</span>
                <span class="userRole">系统管理员</span>
              </div>
            </router-link>
            <button class="logoutBtn" type="button" @click="goLogin">
              <img src="@/assets/out.png" alt="" class="out" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted, ref, watchEffect } from "vue";
import defaultImage from "@/assets/icon.jpeg";
import { useUserStore } from "@/store";
import router from "@/router";
import { useRoute } from "vue-router";
import { TOKEN_NAME } from "@/config/global";

const store = useUserStore();
const userInfo = ref({});
const isToken = ref(false);
const route = useRoute();

onMounted(() => {
  isToken.value = Boolean(sessionStorage.getItem(TOKEN_NAME));
});

watchEffect(() => {
  userInfo.value = store.getUserInfo || {};
});

const isHome = computed(() => route.path === "/main/index" || route.path === "/");

const breadcrumbs = computed(() => {
  const matched = route.matched
    .filter((item) => item.meta?.title)
    .map((item, index, list) => ({
      path: item.path,
      title: item.meta.title,
      clickable: index !== list.length - 1,
    }));

  if (route.meta?.fmeta) {
    const hasParent = matched.some((item) => item.path === route.meta.fmeta.path);
    if (!hasParent) {
      matched.splice(Math.max(matched.length - 1, 0), 0, {
        path: route.meta.fmeta.path,
        title: route.meta.fmeta.title,
        clickable: true,
      });
    }
  }

  if (!matched.length) {
    return [{ path: "/", title: "管理概览", clickable: false }];
  }

  return matched;
});

const currentTitle = computed(() => {
  const last = breadcrumbs.value[breadcrumbs.value.length - 1];
  return last?.title || "管理概览";
});

const goLogin = () => {
  router.push("/login");
};

const onerrorImg = () => {
  userInfo.value.icon = defaultImage;
};
</script>

<style lang="scss" scoped>
.headerShell {
  position: fixed;
  top: 0;
  left: var(--layout-sidebar-width);
  right: 0;
  z-index: 998;
  padding: 18px 24px 0;
}

.headerCard {
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 44px rgba(17, 24, 39, 0.08);
}

.headerMain {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: var(--layout-header-height);
  padding: 14px 22px;
}

.breadcrumbBlock {
  min-width: 0;
}

.eyebrow {
  margin-bottom: 4px;
  color: var(--color-font9);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.pageTitle {
  color: var(--color-font7);
  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;
}

.sceneBadge {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 122, 69, 0.12) 0%, rgba(255, 181, 71, 0.24) 100%);
  color: #7b3d23;
  font-size: 12px;
  font-weight: 600;
}

.breadcrumb {
  margin-top: 6px;
}

.headerActions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}

.statusCard {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 260px;
  padding: 10px 14px;
  border: 1px solid rgba(31, 169, 113, 0.14);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(240, 253, 247, 0.95) 0%, rgba(235, 250, 242, 0.95) 100%);

  strong {
    display: block;
    color: #11643f;
    font-size: 13px;
  }

  p {
    color: #4b7b63;
    font-size: 12px;
  }
}

.statusDot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1fa971;
  box-shadow: 0 0 0 6px rgba(31, 169, 113, 0.14);
  flex-shrink: 0;
}

.userCard {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-left: 6px;
}

.userLink {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-font7);
}

.headIcon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.12);
}

.userMeta {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.userName {
  color: var(--color-font7);
  font-size: 14px;
  font-weight: 700;
}

.userRole {
  color: var(--color-font9);
  font-size: 12px;
}

.logoutBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 14px;
  background: #fff4ee;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    background: #ffe6db;
    transform: translateY(-1px);
  }
}

.out {
  width: 18px;
  height: 18px;
}
</style>
