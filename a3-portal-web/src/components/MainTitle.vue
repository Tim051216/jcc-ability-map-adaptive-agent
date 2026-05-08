<template>
  <div class="mainTitle fx">
    <div class="titleBlock">
      <div class="titleText">{{ title }}</div>
      <div v-if="subtitle" class="subtitle">{{ subtitle }}</div>
    </div>
    <div v-if="more" class="more ft-14" @click="() => $router.push(moreUrl)">
      查看全部
      <i class="iconfont zhy-btn_more" style="font-size: 24px"></i>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: "课程专题",
  },
  subtitle: {
    type: String,
    default: "",
  },
  more: {
    type: Boolean,
    default: true,
  },
  moreUrl: {
    type: String,
    default: "/search/index",
  },
});
</script>

<style lang="scss" scoped>
.mainTitle {
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  color: #19232b;

  .titleBlock {
    position: relative;
    padding-left: 18px;

    &::before {
      content: "";
      position: absolute;
      left: 0;
      top: 6px;
      width: 6px;
      height: 26px;
      border-radius: 999px;
      background: linear-gradient(180deg, #0f766e 0%, #2563eb 100%);
      box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
    }
  }

  .titleText {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.02em;
  }

  .subtitle {
    margin-top: 6px;
    font-size: 13px;
    color: #6b7280;
    line-height: 1.6;
  }

  .more {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    color: #2563eb;
    cursor: pointer;
    transition: transform 0.2s ease, color 0.2s ease;

    &:hover {
      color: #0f766e;
      transform: translateX(2px);
    }
  }
}
</style>
