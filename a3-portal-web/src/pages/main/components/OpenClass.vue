<template>
  <div class="openClass">
    <MainTitle class="marg-bt-20" :title="displayTitle" :subtitle="displaySubtitle" />
    <div v-if="data.length > 0" class="classCont fx-wp">
      <ClassCards
        v-for="(item, index) in data"
        :key="index"
        class="items marg-bt-20"
        :data="item"
      />
    </div>
    <div v-else class="emptyState">当前分组暂无课程，稍后可补充真实数据继续演示。</div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import MainTitle from "@/components/MainTitle.vue";
import ClassCards from "@/components/ClassCards.vue";

const props = defineProps({
  title: {
    type: String,
    default: "课程推荐",
  },
  data: {
    type: Array,
    default: () => [],
  },
});

const titleMap = {
  免费入门课程: {
    title: "免费入门课程",
    subtitle: "适合快速浏览平台内容，先看方向、再选课程，最后进入学习演示链路。",
  },
  精选实战课程: {
    title: "精选实战课程",
    subtitle: "围绕 A3 学习平台重点场景整理的推荐课程，更适合现场展示业务深度。",
  },
  最新上架课程: {
    title: "最新上架课程",
    subtitle: "补充近期整理的演示课程内容，方便答辩时展示平台持续扩展能力。",
  },
  课程推荐: {
    title: "课程推荐",
    subtitle: "精选可直接进入详情页和学习页的演示课程内容。",
  },
};

const displayTitle = computed(() => titleMap[props.title]?.title || props.title);
const displaySubtitle = computed(() => titleMap[props.title]?.subtitle || "精选可直接进入详情页和学习页的演示课程内容。");
</script>

<style lang="scss" scoped>
.openClass {
  padding-bottom: 40px;

  .classCont {
    justify-content: flex-start;
    gap: 20px;

    .items {
      width: calc(25% - 15px);
      margin-right: 0;
    }
  }
}

.emptyState {
  padding: 28px 24px;
  border-radius: 16px;
  background: #f7f9fb;
  color: #5b6570;
  line-height: 24px;
}

@media (max-width: 1100px) {
  .openClass {
    .classCont {
      .items {
        width: calc(50% - 10px);
      }
    }
  }
}

@media (max-width: 760px) {
  .openClass {
    .classCont {
      .items {
        width: 100%;
      }
    }
  }
}
</style>
