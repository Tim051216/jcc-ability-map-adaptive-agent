<!-- 登录页面 -->
<template>
  <div class="loginWrapper fx-fd-col fx-sb">
    <video autoplay loop muted="" preload class="loginVideo">
      <source src="@/assets/login.mp4" type="video/mp4">
     </video>
    <div class="fx-1 fx-al-ct">
      <div class="login">
        <div class="title">
          <img src="@/assets/logo.png" alt="" width="198" height="60" srcset="">
        </div>
        <LoginPass v-if="act == 'pass'"></LoginPass>
      </div>
    </div>
  </div>
</template>
<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
// 组件
// 用户登录组件
import LoginPass from "./components/LoginPass.vue";
import { clearDevSession, ensureDevSession, isDevAuthEnabled } from "@/utils/devAuth";
// ------定义方法------
// 选中方法
const act = ref("pass");
const route = useRoute();
const router = useRouter();
// 切换登录方式
const changeLoginType = (type) => {
  act.value = type;
};

function redirectWithDevSession() {
  if (!isDevAuthEnabled()) {
    clearDevSession();
    return;
  }
  ensureDevSession();
  const target = route.query.redirect || "/main/index";
  if (route.fullPath !== target) {
    router.replace(target);
  }
}

redirectWithDevSession();

onMounted(() => {
  nextTick(() => {
    redirectWithDevSession();
  });
});

watch(
  () => route.fullPath,
  () => {
    redirectWithDevSession();
  },
  { immediate: true }
);
</script>
<style lang="scss" src="./index.scss"></style>
