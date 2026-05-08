<template>
  <div class="LeftNav">
    <router-link
      v-for="item in personalRoute"
      :key="item.path"
      class="fx-sb font-bt2"
      :class="{ active: activeClass(item) }"
      :to="resolvePersonalPath(item.path)"
    >
      <span>{{ item.meta.title }}</span>
      <i class="iconfont" v-html="item.meta.icon"></i>
    </router-link>
    <a class="fx-sb font-bt2" @click="logout">
      <span>&#x9000;&#x51FA;&#x767B;&#x5F55;</span>
      <i class="iconfont">&#xe60c;</i>
    </a>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { userLogout } from "@/api/user";
import { useUserStore } from "@/store";

const store = useUserStore();
const route = useRoute();
const router = useRouter();
const personalRoute = ref([]);
const currentPath = ref("");

const activeClass = computed(() => (item) => {
  const reg = new RegExp(`^${item.meta.active}`);
  return reg.test(currentPath.value);
});

const resolvePersonalPath = (path) => {
  return path.startsWith("/") ? path : `/personal/main/${path}`;
};

const refreshRoutes = () => {
  const currentRoute = router.currentRoute.value;
  const personalMainRoute = currentRoute.matched.find((item) => item.name === "personalMain");
  personalRoute.value = (personalMainRoute?.children || []).filter((item) => item.meta && !item.meta.hidden);
  currentPath.value = route.path.split("/").at(-1) || "";
};

onMounted(() => {
  refreshRoutes();
});

watchEffect(() => {
  refreshRoutes();
});

const logout = () => {
  userLogout()
    .then((res) => {
      if (res.code === 200) {
        store.logout();
        location.href = "/";
      }
    })
    .catch(() => {});
};
</script>

<style lang="scss" scoped>
.LeftNav {
  width: 190px;
  height: fit-content;
  background: #ffffff;
  border-radius: 8px;
  margin-right: 20px;

  a {
    width: 100%;
    padding: 13px 15px 13px 20px;
    border-bottom: 1px solid #eeeeee;
    font-size: 14px;
    line-height: 32px;

    i {
      font-size: 30px;
    }
  }

  .active {
    color: var(--color-main);
  }
}
</style>
