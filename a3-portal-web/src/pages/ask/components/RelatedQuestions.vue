<template>
  <div class="relatedQuestions">
    <div class="but">
      <span class="bt bt-round" @click="() => { $router.push({ path: '/ask', query: { id, title } }); }">发起新问题</span>
    </div>
    <div class="tit">相关问题</div>
    <div>
      <p>A3 演示模式下为什么部分页面可以直接进入？</p>
      <p>课程学习链路验收时，前端和后端联调应该先做哪一段？</p>
      <p>如果本地演示数据和真实服务返回不一致，应该怎么处理？</p>
      <p>答辩时怎样解释“先演示、后联调”的阶段性方案更清晰？</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  id: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "",
  },
});
</script>

<style lang="scss" scoped>
.relatedQuestions {
  width: 344px;
  height: fit-content;
  background: #ffffff;
  border-radius: 8px;
  padding: 30px;
  line-height: 24px;
  margin-top: 30px;
  font-size: 14px;

  .but {
    border-bottom: solid 1px var(--color-background1);
    padding: 0 50px 30px 50px;
    margin-bottom: 30px;
  }

  p {
    margin: 20px 0;
  }

  .tit {
    font-weight: 600;
    font-size: 20px;
  }
}
</style>
