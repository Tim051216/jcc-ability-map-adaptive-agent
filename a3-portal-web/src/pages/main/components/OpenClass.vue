<template>
  <div class="openClass">
    <MainTitle class="marg-bt-20" :title="displayTitle" :subtitle="displaySubtitle" />
    <div class="classCont fx-wp">
      <ClassCards
        v-for="(item, index) in data"
        :key="index"
        class="items marg-bt-20"
        :data="item"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import MainTitle from "@/components/MainTitle.vue";
import ClassCards from "@/components/ClassCards.vue";

const props = defineProps({
  title: {
    type: String,
    default: "模块标题",
  },
  data: {
    type: Array,
    default: () => [],
  },
});

const titleMap = {
  最新接入课程: {
    title: "最新接入课程",
    subtitle: "优先展示适合现场演示、功能联调和赛题讲解的学习内容。",
  },
  项目实战专题: {
    title: "项目实战专题",
    subtitle: "围绕 AI 学习助手、个性化推荐与学习闭环的重点专题。",
  },
  持续更新内容: {
    title: "持续更新内容",
    subtitle: "保留后续可继续迭代、补图和增强交互的内容区域。",
  },
  平台公开演示: {
    title: "平台公开演示",
    subtitle: "更适合直接展示产品外观、功能路径和系统完整性的内容集合。",
  },
  赛题演示课程: {
    title: "赛题演示课程",
    subtitle: "围绕 A3 赛题语境整理后的课程呈现方式与演示顺序。",
  },
};

const displayTitle = computed(() => titleMap[props.title]?.title || props.title);
const displaySubtitle = computed(() => titleMap[props.title]?.subtitle || "精选课程内容");
</script>

<style lang="scss" scoped>
.openClass {
  padding-bottom: 40px;

  .classCont {
    justify-content: flex-start;
    gap: 20px;

    .items {
      margin-right: 0;
      width: calc(25% - 15px);
    }
  }
}
</style>
