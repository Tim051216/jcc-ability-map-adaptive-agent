<template>
  <div class="mainWrapper">
    <div class="container banner fx">
      <div class="categorys">
        <ClassCategory :data="classCategorys" />
      </div>
      <Swiper :data="images" />
    </div>

    <div class="bg-wt pd-tp-30">
      <OpenClass title="平台公开演示" class="container bg-wt" :data="demoCourses" />
    </div>

    <div class="globalTopBanner a3ListBanner">
      <div class="bannerInner">
        <div class="bannerEyebrow">A3 课程展示页</div>
        <div class="bannerTitle">课程清单已切换为更适合赛题讲解、演示验收和前端联调的 A3 版本</div>
      </div>
    </div>

    <div class="bg-wt pd-tp-30">
      <OpenClass title="项目实战专题" class="container bg-wt" :data="bestCourses" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import ClassCategory from "@/components/ClassCategory.vue";
import OpenClass from "@/pages/main/components/OpenClass.vue";
import Swiper from "./components/Swiper.vue";
import { getClassCategorys, getRecommendClassList, normalizeCategoryData } from "@/api/class.js";

const classCategorys = ref([]);
const demoCourses = ref([]);
const bestCourses = ref([]);

const images = [
  {
    eyebrow: "A3 课程导览",
    title: "从首页到课程列表，统一为赛题化演示表达",
    desc: "这里展示的是更适合答辩现场介绍、课程筛选和项目能力讲解的内容版式。",
    badge: "课程总览",
    background: "linear-gradient(135deg, #0f766e 0%, #2563eb 58%, #1e293b 100%)",
  },
  {
    eyebrow: "前台体验优化",
    title: "列表页也不再只是堆卡片，而是具备结构、层次和展示重点",
    desc: "让课程推荐、专题呈现和演示讲解有更清晰的主次关系，减少原项目痕迹。",
    badge: "A3 Portal",
    background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #14b8a6 100%)",
  },
];

onMounted(() => {
  getClassCategoryData();
  getCourseBlocks();
});

const getClassCategoryData = async () => {
  try {
    const res = await getClassCategorys();
    if (res.code === 200) {
      classCategorys.value = normalizeCategoryData(res.data || []);
      return;
    }
    ElMessage({ message: res.msg || "分类加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "分类加载失败", type: "error" });
  }
};

const getCourseBlocks = async () => {
  try {
    const [freeRes, bestRes] = await Promise.all([getRecommendClassList("free"), getRecommendClassList("best")]);
    demoCourses.value = freeRes.code === 200 ? freeRes.data || [] : [];
    bestCourses.value = bestRes.code === 200 ? bestRes.data || [] : [];
  } catch (error) {
    ElMessage({ message: "课程内容加载失败", type: "error" });
  }
};
</script>

<style lang="scss" scoped>
.mainWrapper {
  .banner {
    padding: 26px 0 20px;

    .categorys {
      position: relative;
      width: 236px;
      height: 388px;
      border-radius: 24px;
      z-index: 9;
    }
  }

  .globalTopBanner {
    width: 100%;
    min-width: 1152px;
    max-width: 2560px;
    overflow: hidden;
  }
}

.a3ListBanner {
  padding: 12px 24px 0;

  .bannerInner {
    max-width: 1180px;
    margin: 0 auto;
    border-radius: 24px;
    padding: 26px 32px;
    color: #fff;
    background: linear-gradient(135deg, #114c7a 0%, #177f89 100%);
    box-shadow: 0 18px 36px rgba(17, 76, 122, 0.18);
  }

  .bannerEyebrow {
    font-size: 12px;
    letter-spacing: 0.08em;
    opacity: 0.9;
  }

  .bannerTitle {
    margin-top: 10px;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.4;
  }
}
</style>
