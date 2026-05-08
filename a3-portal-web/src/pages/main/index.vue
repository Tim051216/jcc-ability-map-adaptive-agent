<template>
  <div class="mainWrapper">
    <div class="container heroSection fx">
      <div class="categorys">
        <ClassCategory :data="classCategorys" />
      </div>
      <Swiper :data="imags" />
    </div>

    <div v-if="interest.size > 0" class="container">
      <Interest :data="interest" :key="intKey" @setInterest="setInterest" />
    </div>

    <div class="sectionShell sectionLight">
      <OpenClass title="最新接入课程" class="container" :data="freeClassData" />
    </div>

    <div class="globalTopBanner a3ShowcaseBanner">
      <div class="bannerInner">
        <div class="bannerCopy">
          <div class="bannerEyebrow">A3 赛题演示链路</div>
          <div class="bannerTitle">从课程推荐到学习互动，聚焦可展示、可验收、可联调</div>
          <div class="bannerDesc">
            当前版本优先保障前端演示和赛题验收体验，后续可以继续接回真实网关、认证、用户与学习服务。
          </div>
          <div class="bannerActions">
            <router-link class="primaryAction" to="/main/ai-demo">进入 AI 协同演示页</router-link>
            <div class="actionHint">可直接展示 intent、agent trace、学习计划与资源生成结果</div>
          </div>
        </div>
        <div class="bannerStats">
          <div class="statCard">
            <div class="statValue">3</div>
            <div class="statLabel">核心演示链路</div>
          </div>
          <div class="statCard">
            <div class="statValue">A3</div>
            <div class="statLabel">赛题化门户表达</div>
          </div>
          <div class="statCard">
            <div class="statValue">Demo</div>
            <div class="statLabel">前后台联调友好</div>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <AiPathEntry />
    </div>


    <div class="sectionShell">
      <OpenClass title="项目实战专题" class="container" :data="goodClassData" />
    </div>

    <div class="sectionShell">
      <OpenClass title="持续更新内容" class="container" :data="newClassData" />
    </div>

    <div class="interest">
      <el-dialog v-model="interestDialog" width="80%" :show-close="false">
        <template #header="{ close }">
          <div class="dialogHead fx-sb">
            <div>
              <span class="titleClass marg-rt-10">设置学习兴趣</span>
              <span class="ft-cl-des">打造你的专属智能学习平台</span>
            </div>
            <div class="butCont fx">
              <span class="bt-grey marg-rt-15" @click="close">下次再说</span>
              <span class="bt" @click="saveInterest">保存设置</span>
            </div>
          </div>
        </template>
        <CheckInterest :data="classCategorys" :initValue="interest" @setInterestList="setInterestList" />
      </el-dialog>
    </div>

    <div class="floatCont fx-fd-col fx-ct">
      <router-link to="/main/coupon" class="couponEntry">
        <img src="@/assets/coup.png" alt="" />
      </router-link>
      <div class="cont">
        <img src="@/assets/btn_backtop.png" alt="" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { dataCacheStore, isLogin } from "@/store";
import { getClassCategorys, getInterests, getRecommendClassList, normalizeCategoryData, setInterests } from "@/api/class.js";
import ClassCategory from "@/components/ClassCategory.vue";
import CheckInterest from "./components/CheckInterest.vue";
import AiPathEntry from "./components/AiPathEntry.vue";
import Interest from "./components/Interest.vue";
import OpenClass from "./components/OpenClass.vue";
import Swiper from "./components/Swiper.vue";

const dataCache = dataCacheStore();

const classCategorys = ref([]);
const freeClassData = ref([]);
const interestDialog = ref(false);
const goodClassData = ref([]);
const newClassData = ref([]);
const interest = ref(new Set());
const interestCatch = ref(new Set());
const intKey = ref(1);

const imags = [
  {
    eyebrow: "A3 赛题演示链路",
    title: "面向验收的课程学习演示闭环",
    desc: "从课程推荐进入搜索与详情，再继续到学习和练习页面，不依赖完整后端也能稳定完成整条展示链路。",
    meta: "首页 -> 搜索 -> 详情 -> 学习 -> 练习",
    background: "linear-gradient(135deg, #1f4f8a 0%, #235d9f 45%, #2a8f7e 100%)",
  },
  {
    eyebrow: "前端优先验收",
    title: "真实服务不稳定时，页面也能继续看、继续验",
    desc: "通过演示数据兜底，先保证路由、登录态、组件渲染和交互过程可检查、可讲解、可复现。",
    meta: "先验页面结构，再逐步切回真实服务",
    background: "linear-gradient(135deg, #253b80 0%, #3b82f6 52%, #0ea5a4 100%)",
  },
  {
    eyebrow: "A3 交付节奏",
    title: "先稳住演示，再回接真实联调",
    desc: "当前 portal 先确保展示效果和验收体验，后续可按网关、认证、用户、学习服务的顺序逐步接回真实链路。",
    meta: "先演示，后联调",
    background: "linear-gradient(135deg, #0f766e 0%, #1d4ed8 58%, #1e293b 100%)",
  },
];

onMounted(async () => {
  getClassCategoryData();
  getFreeClassListData();
  getGoodClassListData();
  getNewClassListData();
  if (await isLogin()) {
    getInterestData();
  }
});

const getClassCategoryData = async () => {
  try {
    const res = await getClassCategorys();
    if (res.code === 200) {
      classCategorys.value = normalizeCategoryData(res.data || []);
      dataCache.setCourseClassDataes(classCategorys.value);
      return;
    }
    ElMessage({ message: "分类信息加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "分类信息加载失败", type: "error" });
  }
};

const setInterest = (value) => {
  interestCatch.value = new Set(interest.value);
  interestDialog.value = value;
};

const getFreeClassListData = async () => {
  try {
    const res = await getRecommendClassList("free");
    if (res.code === 200) {
      freeClassData.value = res.data || [];
      return;
    }
    ElMessage({ message: "最新课程加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "最新课程加载失败", type: "error" });
  }
};

const getGoodClassListData = async () => {
  try {
    const res = await getRecommendClassList("best");
    if (res.code === 200) {
      goodClassData.value = res.data || [];
      return;
    }
    ElMessage({ message: "专题课程加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "专题课程加载失败", type: "error" });
  }
};

const getNewClassListData = async () => {
  try {
    const res = await getRecommendClassList("new");
    if (res.code === 200) {
      newClassData.value = res.data || [];
      return;
    }
    ElMessage({ message: "更新内容加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "更新内容加载失败", type: "error" });
  }
};

const getInterestData = async () => {
  try {
    const res = await getInterests();
    if (res.code === 200) {
      if ((res.data || []).length === 0) {
        interestDialog.value = true;
      }
      interest.value = new Set(res.data || []);
      return;
    }
    interestDialog.value = true;
  } catch (error) {
    ElMessage({ message: "兴趣列表获取失败", type: "error" });
  }
};

const setInterestList = (list) => {
  interestCatch.value = list;
};

const saveInterest = async () => {
  let ids = "";
  for (const value of interestCatch.value) {
    const current = typeof value === "string" ? value : value.id;
    ids = ids ? `${ids},${current}` : `${current}`;
  }

  if (!ids) {
    ElMessage({
      message: "请先选择学习兴趣，再保存设置",
      type: "warning",
    });
    return;
  }

  try {
    const res = await setInterests({ interestedIds: ids });
    if (res.code === 200) {
      ElMessage({ message: "学习兴趣已保存", type: "success" });
      await getInterestData();
      intKey.value += 1;
      interestDialog.value = false;
      return;
    }
    ElMessage({ message: "学习兴趣保存失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "学习兴趣保存失败", type: "error" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
<style lang="scss" scoped>
.mainWrapper {
  position: relative;
}

.heroSection {
  align-items: stretch;
}

.sectionShell {
  padding-top: 34px;
}

.sectionLight {
  padding-top: 36px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(248, 250, 252, 0.9));
}

.a3ShowcaseBanner {
  padding: 8px 24px 0;

  .bannerInner {
    display: flex;
    justify-content: space-between;
    gap: 28px;
    max-width: 1180px;
    margin: 0 auto;
    border-radius: 28px;
    padding: 34px 36px;
    color: #fff;
    background:
      radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 28%),
      linear-gradient(135deg, #0f4c81 0%, #146c94 45%, #1f9d7a 100%);
    box-shadow: 0 22px 40px rgba(21, 64, 92, 0.2);
  }

  .bannerCopy {
    max-width: 760px;
  }

  .bannerEyebrow {
    display: inline-flex;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    letter-spacing: 0.08em;
    background: rgba(255, 255, 255, 0.16);
  }

  .bannerTitle {
    margin-top: 14px;
    font-size: 34px;
    font-weight: 800;
    line-height: 1.32;
  }

  .bannerDesc {
    margin-top: 12px;
    max-width: 760px;
    line-height: 1.9;
    color: rgba(255, 255, 255, 0.88);
  }

  .bannerActions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 24px;
    flex-wrap: wrap;
  }

  .primaryAction {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 220px;
    height: 50px;
    padding: 0 24px;
    border-radius: 999px;
    background: #fff;
    color: #1258a8;
    font-weight: 700;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
      color: #1258a8;
      transform: translateY(-2px);
      box-shadow: 0 16px 28px rgba(18, 88, 168, 0.22);
    }
  }

  .actionHint {
    color: rgba(255, 255, 255, 0.82);
    line-height: 1.7;
  }

  .bannerStats {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 14px;
    min-width: 240px;
  }

  .statCard {
    padding: 18px 18px 16px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(10px);
  }

  .statValue {
    font-size: 30px;
    font-weight: 800;
  }

  .statLabel {
    margin-top: 8px;
    font-size: 14px;
    font-weight: 700;
  }
}
</style>
