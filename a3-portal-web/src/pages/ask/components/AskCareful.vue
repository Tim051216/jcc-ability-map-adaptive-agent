<template>
  <div class="askCareful">
    <div class="tit">提问注意事项</div>
    <div>
      <p>发布问答前，建议先确认问题描述是否完整。</p>
      <p>1. 请避免发布与课程学习和赛题演示无关的广告、交易或推广内容。</p>
      <p>2. 尽量在标题和描述里写清场景、报错现象、已尝试的方法，方便他人快速理解问题。</p>
      <p>3. 如果是演示环境中的问题，建议同时说明对应页面和复现步骤，方便后续联调排查。</p>
    </div>
  </div>
</template>

<script setup></script>

<style lang="scss" scoped>
.askCareful {
  width: 344px;
  height: min-content;
  background: #ffffff;
  border-radius: 8px;
  padding: 30px;
  line-height: 22px;
  font-size: 14px;

  .but {
    border-bottom: solid 1px var(--color-background1);
    padding: 0 50px 30px 50px;
    margin-bottom: 30px;
  }

  p {
    margin: 28px 0;
  }

  .tit {
    font-weight: 600;
    font-size: 20px;
  }
}
</style>
