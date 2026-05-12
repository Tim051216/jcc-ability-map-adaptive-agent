<template>
  <div class="success container bg-wt fx-fd-col fx-ct">
    <IconSuccess />
    <div class="title">提交成功</div>
    <div class="ft-14 marg-bt-20 ft-cl-des">
      你的内容已经提交成功，后续可以继续回到课程链路中查看学习与互动效果。
    </div>
    <div class="ask bt ft-14" @click="goBack">返回首页</div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import IconSuccess from "@/assets/icon_success.svg";

const router = useRouter();

const goBack = () => {
  router.push("/main/index");
};
</script>

<style lang="scss">
.success {
  margin: 30px auto 40px auto;
  border-radius: 8px;

  .title {
    font-weight: 600;
    font-size: 24px;
    margin: 20px 20px 10px 20px;
  }

  .ask {
    width: 122px;
    height: 36px;
    line-height: 36px;
  }
}
</style>
