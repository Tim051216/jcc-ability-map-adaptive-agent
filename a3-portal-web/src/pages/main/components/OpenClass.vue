<template>
  <div class="openClass">
    <MainTitle class="marg-bt-20" :title="displayTitle" />
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
  "新课推荐": "赛题演示课程",
  "精品好课": "项目实战专题",
  "精品新课": "最新接入课程",
  "直播公开课": "平台公开演示",
};

const displayTitle = computed(() => titleMap[props.title] || props.title);
</script>

<style lang="scss" scoped>
.openClass {
  padding-bottom: 40px;

  .classCont {
    justify-content: flex-start;

    .items {
      margin-right: 20px;
      width: calc(25% - 15px);
    }

    .items:nth-child(4n) {
      margin-right: 0;
    }
  }
}
</style>
