<template>
  <div class="mainWrapper">
    <div class="container banner fx">
      <div class="categorys bg-wt">
        <ClassCategory :data="classCategorys" />
      </div>
      <Swiper :data="imags" />
    </div>

    <div class="bg-wt pd-tp-30">
      <OpenClass title="平台公开演示" class="container bg-wt" :data="demoCourses" />
    </div>

    <div class="pd-tp-30">
      <OpenClass title="赛题演示课程" class="container" :data="newCourses" />
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
import { getClassCategorys, getRecommendClassList } from "@/api/class.js";

const classCategorys = ref([]);
const imags = ref([]);
const demoCourses = ref([]);
const newCourses = ref([]);
const bestCourses = ref([]);

onMounted(() => {
  getClassCategoryData();
  getCourseBlocks();
});

const getClassCategoryData = async () => {
  try {
    const res = await getClassCategorys();
    if (res.code === 200) {
      classCategorys.value = res.data || [];
      return;
    }
    ElMessage({ message: res.msg || "分类加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "分类加载失败", type: "error" });
  }
};

const getCourseBlocks = async () => {
  try {
    const [freeRes, newRes, bestRes] = await Promise.all([
      getRecommendClassList("free"),
      getRecommendClassList("new"),
      getRecommendClassList("best"),
    ]);

    demoCourses.value = freeRes.code === 200 ? freeRes.data || [] : [];
    newCourses.value = newRes.code === 200 ? newRes.data || [] : [];
    bestCourses.value = bestRes.code === 200 ? bestRes.data || [] : [];
  } catch (error) {
    ElMessage({ message: "课程内容加载失败", type: "error" });
  }
};
</script>

<style lang="scss" scoped>
.mainWrapper {
  .banner {
    padding: 20px 0;

    .categorys {
      position: relative;
      width: 236px;
      height: 388px;
      border-radius: 8px;
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
    border-radius: 18px;
    padding: 24px 32px;
    color: #fff;
    background: linear-gradient(135deg, #114c7a 0%, #177f89 100%);
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
