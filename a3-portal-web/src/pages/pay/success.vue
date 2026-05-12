<template>
  <div class="successWrapper container bg-wt">
    <div class="successCont">
      <div><img src="@/assets/icon_success.png" width="72" height="72" alt="" /></div>
      <div class="tit">支付成功</div>
      <div class="order">订单 ID：{{ route.query.order || "A3-DEMO-ORDER" }}</div>
      <div class="desc">课程采购流程已经走通，你现在可以继续查看订单页，或者返回首页继续验收其他高频页面。</div>
      <div class="actionRow">
        <span class="bt actionBtn" @click="router.push('/personal/main/myOrder')">查看订单</span>
        <span class="bt actionBtn secondary" @click="router.push('/main/index')">返回首页</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
</script>

<style lang="scss" src="./index.scss"></style>
<style lang="scss" scoped>
.desc {
  margin-top: 12px;
  line-height: 24px;
  color: #80878c;
  text-align: center;
}

.actionRow {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.actionBtn {
  min-width: 122px;
  text-align: center;
}

.secondary {
  background: #eef1f4 !important;
  color: #33404a !important;
}
</style>
