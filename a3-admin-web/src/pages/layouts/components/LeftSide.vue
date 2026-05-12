<template>
  <aside class="LeftSider fx-fd-col">
    <div class="sidebarGlow sidebarGlowTop"></div>
    <div class="sidebarGlow sidebarGlowBottom"></div>

    <div @click="() => $router.push('/')" class="logo cursor fx-ct fx-fd-col">
      <div class="brandMark">A3</div>
      <div class="brandText">
        <strong>A3 学习平台</strong>
        <span>后台管理中心</span>
      </div>
    </div>

    <div class="navSummary">
      <span class="navSummaryLabel">导航总览</span>
      <strong>{{ basePath.length + 1 }} 个业务入口</strong>
      <p>围绕学习画像、路径规划、资源生成和运营管理展开</p>
    </div>

    <div class="nav">
      <el-menu
        :default-active="activeIndex"
        :default-openeds="defaultOpeneds"
        class="menuPanel"
        :unique-opened="true"
        @open="handleOpen"
        @close="handleClose"
        @select="handleSelect"
      >
        <div class="first-menu">
          <el-menu-item index="99" :key="99" @click="goPath(`/`)">
            <i class="iconfont" v-html="basePath[0]?.meta?.icon"></i>
            <span>管理概览</span>
          </el-menu-item>
        </div>
        <el-sub-menu v-for="(item, index) in basePath" :key="index" :index="index.toString()">
          <template #title>
            <i class="iconfont" v-html="item.meta.icon"></i>
            <span>{{ item.meta.title }}</span>
          </template>
          <el-menu-item
            v-for="(it, ind) in item.children"
            :key="ind"
            :index="`${index}-${ind}`"
            @click="goPath(`${it.path}`)"
          >
            {{ it.meta.title }}
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </div>
  </aside>
</template>

<script setup>
import { ref, watchEffect } from "vue";
import { useRoute } from "vue-router";
import router, { asyncRouterList } from "@/router";
import { catchDataesStore, useUserStore } from "@/store";

const routers = asyncRouterList;
const route = useRoute();
const store = catchDataesStore();
const useStore = useUserStore();

const activeIndex = ref("99");
const defaultOpeneds = ref([]);

const getMenuList = (list, basePath) => {
  if (!list) {
    return [];
  }

  return list
    .map((item) => {
      const path = basePath ? `${basePath}/${item.path}` : item.path;
      return {
        path,
        title: item.meta?.title,
        icon: item.meta?.icon || "",
        children: getMenuList(item.children, path),
        meta: item.meta,
        redirect: item.redirect,
      };
    })
    .filter((item) => item.meta && item.meta.hidden !== true);
};

const basePath = getMenuList(routers);

const goPath = (path) => {
  useStore.setTabNumber(0);
  router.push(path);
};

const handleOpen = (key) => {
  defaultOpeneds.value = [key];
  store.setDefaultOpeneds(key);
};

const handleClose = (key) => {
  store.setDefaultOpeneds(key);
};

const handleSelect = (key) => {
  store.setDefaultIndex(key);
};

watchEffect(() => {
  if (!basePath.length) {
    return;
  }

  const path = route.path.toString();
  if (path === "/main/index" || path === "/") {
    activeIndex.value = "99";
    return;
  }

  const currentPath = route.meta?.fmeta?.path || path;

  basePath.forEach((item, index) => {
    const regA = new RegExp(item.path);
    if (currentPath.search(regA) !== -1) {
      defaultOpeneds.value = [index.toString()];
      item.children.forEach((val, ind) => {
        if (val.path === currentPath) {
          activeIndex.value = `${index}-${ind}`;
        }
      });
    }
  });
});
</script>

<style lang="scss" scoped>
.LeftSider {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 999;
  width: var(--layout-sidebar-width);
  height: 100vh;
  padding: 26px 18px 22px;
  overflow: hidden;
  background:
    linear-gradient(180deg, #fffaf5 0%, #f8efe6 54%, #f3e8dd 100%);
  border-right: 1px solid rgba(124, 92, 68, 0.08);
  box-shadow: 14px 0 36px rgba(17, 24, 39, 0.06);

  &::before {
    content: "";
    position: absolute;
    inset: 14px;
    border-radius: 34px;
    border: 1px solid rgba(255, 255, 255, 0.65);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.14) 100%);
    pointer-events: none;
  }
}

.sidebarGlow {
  position: absolute;
  border-radius: 50%;
  filter: blur(10px);
  opacity: 0.8;
}

.sidebarGlowTop {
  top: -56px;
  left: -28px;
  width: 150px;
  height: 150px;
  background: rgba(255, 122, 69, 0.22);
}

.sidebarGlowBottom {
  right: -36px;
  bottom: 90px;
  width: 120px;
  height: 120px;
  background: rgba(255, 181, 71, 0.18);
}

.logo,
.navSummary,
.nav {
  position: relative;
  z-index: 1;
}

.logo {
  gap: 14px;
  margin: 8px 8px 22px;
  padding: 18px 16px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}

.brandMark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  border-radius: 26px;
  background: linear-gradient(135deg, #ffaf69 0%, #ff7a45 52%, #f05e34 100%);
  color: #fff;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 1px;
  box-shadow: 0 20px 36px rgba(255, 122, 69, 0.24);
}

.brandText {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  color: #42291d;

  strong {
    font-size: 20px;
    line-height: 1.1;
  }

  span {
    color: rgba(66, 41, 29, 0.72);
    font-size: 12px;
    letter-spacing: 0.12em;
  }
}

.navSummary {
  margin: 0 8px 16px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(122, 74, 47, 0.08);
  color: #5e4333;

  strong {
    display: block;
    margin-top: 4px;
    color: #3b2419;
    font-size: 18px;
  }

  p {
    margin-top: 6px;
    color: rgba(94, 67, 51, 0.76);
    font-size: 12px;
    line-height: 1.5;
  }
}

.navSummaryLabel {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.nav {
  flex: 1;
  min-height: 0;
  padding: 10px 8px 0;
}

.menuPanel {
  height: 100%;
  padding: 10px 0 18px;
  overflow: auto;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 28px;
  backdrop-filter: blur(12px);
}

.first-menu {
  margin-bottom: 4px;
}

:deep(.el-menu) {
  background-color: transparent;
  border-right: 0;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 46px;
  margin: 4px 12px;
  border-radius: 16px;
  color: #5f4a3d;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

:deep(.el-menu-item) {
  padding-left: 20px !important;
}

:deep(.el-sub-menu__title) {
  padding-left: 20px !important;
}

:deep(.el-sub-menu .el-menu-item) {
  margin-left: 20px;
  padding-left: 44px !important;
  width: calc(100% - 32px);
  min-width: 0;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background: rgba(255, 122, 69, 0.12);
  color: var(--color-btnbackground);
}

:deep(.el-menu-item.is-active),
:deep(.is-active > .el-sub-menu__title) {
  background: linear-gradient(90deg, #ff8f61 0%, #ff7441 100%);
  color: #fff;
  box-shadow: 0 12px 28px rgba(255, 122, 69, 0.22);
}

:deep(.el-sub-menu__icon-arrow) {
  margin-top: -2px;
  color: currentColor;
}

.iconfont {
  margin-right: 12px;
  font-size: 18px;
}
</style>
