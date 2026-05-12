<template>
  <div class="mainWrapper">
    <div class="container heroSection fx">
      <div class="categorys">
        <ClassCategory :data="classCategorys" />
      </div>
      <Swiper :data="images" />
    </div>

    <div v-if="interest.size > 0" class="container">
      <Interest :data="interest" :key="intKey" @setInterest="setInterest" />
    </div>

    <div class="sectionShell sectionLight">
      <OpenClass title="免费入门课程" class="container" :data="freeClassData" />
    </div>

    <div class="globalTopBanner a3ShowcaseBanner">
      <div class="bannerInner">
        <div class="bannerCopy">
          <div class="bannerEyebrow">A3 赛题展示链路</div>
          <div class="bannerTitle">从课程推荐到学习互动，聚焦可展示、可验收、可联调的学生端学习闭环</div>
          <div class="bannerDesc">
            当前版本优先保障前端演示与验收体验，学生端已经可以串起学习兴趣、课程推荐、课程学习、问答互动与支付结果等高频页面。
          </div>
          <div class="bannerActions">
            <router-link class="primaryAction" to="/main/ai-path">进入个性化学习路径</router-link>
            <div class="actionHint">可直接演示学习路径推进、资源推荐收藏、学习报告同步和智能助教补链能力。</div>
          </div>
        </div>
        <div class="bannerStats">
          <div class="statCard">
            <div class="statValue">8+</div>
            <div class="statLabel">高频成品页面</div>
          </div>
          <div class="statCard">
            <div class="statValue">A3</div>
            <div class="statLabel">学生端统一表达</div>
          </div>
          <div class="statCard">
            <div class="statValue">闭环</div>
            <div class="statLabel">前后链路可继续联调</div>
          </div>
        </div>
      </div>
    </div>

    <div class="container">
      <AiPathEntry />
    </div>


    <div class="sectionShell">
      <OpenClass title="精选实战课程" class="container" :data="goodClassData" />
    </div>

    <div class="sectionShell">
      <OpenClass title="最新上架课程" class="container" :data="newClassData" />
    </div>

    <div class="interest">
      <el-dialog v-model="interestDialog" width="80%" :show-close="false">
        <template #header="{ close }">
          <div class="dialogHead fx-sb">
            <div>
              <span class="titleClass marg-rt-10">设置学习兴趣</span>
              <span class="ft-cl-des">完善你的学习方向，便于系统推荐更贴合的课程内容。</span>
            </div>
            <div class="butCont fx">
              <span class="bt-grey marg-rt-15" @click="close">稍后再说</span>
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

const images = [
  {
    eyebrow: "A3 赛题展示链路",
    title: "面向答辩验收的课程学习展示闭环",
    desc: "从首页课程推荐进入搜索和详情，再继续到学习与练习页面，不依赖完整后端也能稳定完成整条展示链路。",
    meta: "首页 -> 搜索 -> 详情 -> 学习 -> 练习",
    background: "linear-gradient(135deg, #1f4f8a 0%, #235d9f 45%, #2a8f7e 100%)",
    to: "/search/index",
    actionText: "进入课程搜索",
  },
  {
    eyebrow: "前端优先验收",
    title: "服务暂不稳定时，页面仍可继续看、继续讲、继续验",
    desc: "通过演示数据兜底，先保障路由、登录态、组件渲染和交互过程可检查、可讲解、可复现。",
    meta: "先验页面结构，再逐步切回真实服务",
    background: "linear-gradient(135deg, #253b80 0%, #3b82f6 52%, #0ea5a4 100%)",
    to: "/main/ai-tutor",
    actionText: "进入智能辅导",
  },
  {
    eyebrow: "A3 交付节奏",
    title: "先稳住演示，再回接真实联调",
    desc: "当前 portal 先确保展示效果和验收体验，后续可按网关、认证、用户、学习服务的顺序逐步接回真实链路。",
    meta: "先演示，后联调",
    background: "linear-gradient(135deg, #0f766e 0%, #1d4ed8 58%, #1e293b 100%)",
    to: "/main/ai-path",
    actionText: "进入学习路径",
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
    ElMessage({ message: "免费课程加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "免费课程加载失败", type: "error" });
  }
};

const getGoodClassListData = async () => {
  try {
    const res = await getRecommendClassList("best");
    if (res.code === 200) {
      goodClassData.value = res.data || [];
      return;
    }
    ElMessage({ message: "精选课程加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "精选课程加载失败", type: "error" });
  }
};

const getNewClassListData = async () => {
  try {
    const res = await getRecommendClassList("new");
    if (res.code === 200) {
      newClassData.value = res.data || [];
      return;
    }
    ElMessage({ message: "最新课程加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "最新课程加载失败", type: "error" });
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
      message: "请先选择学习兴趣，再保存设置。",
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
  padding-top: 26px;

  .categorys {
    position: relative;
    width: 236px;
    height: 388px;
    border-radius: 24px;
    z-index: 9;
  }
}

.sectionShell {
  padding-top: 24px;
}

.sectionLight {
  background: linear-gradient(180deg, #f7fbff 0%, #ffffff 100%);
}

.globalTopBanner {
  width: 100%;
  min-width: 1152px;
  max-width: 2560px;
  overflow: hidden;
  padding: 18px 24px 0;
}

.a3ShowcaseBanner {
  .bannerInner {
    max-width: 1180px;
    margin: 0 auto;
    border-radius: 28px;
    padding: 32px;
    color: #fff;
    display: flex;
    justify-content: space-between;
    gap: 28px;
    background: linear-gradient(135deg, #113e67 0%, #176f86 52%, #1d4ed8 100%);
    box-shadow: 0 22px 42px rgba(17, 62, 103, 0.18);
  }

  .bannerCopy {
    max-width: 760px;
  }

  .bannerEyebrow {
    font-size: 12px;
    letter-spacing: 0.08em;
    opacity: 0.92;
  }

  .bannerTitle {
    margin-top: 14px;
    font-size: 30px;
    font-weight: 700;
    line-height: 1.45;
  }

  .bannerDesc {
    margin-top: 14px;
    line-height: 1.9;
    color: rgba(255, 255, 255, 0.88);
  }

  .bannerActions {
    margin-top: 22px;
  }

  .primaryAction {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 204px;
    padding: 0 18px;
    height: 42px;
    border-radius: 999px;
    color: #123b5f;
    font-weight: 700;
    background: #fff;
  }

  .actionHint {
    margin-top: 12px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.78);
  }

  .bannerStats {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 220px;
  }

  .statCard {
    padding: 18px 20px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(10px);
  }

  .statValue {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.1;
  }

  .statLabel {
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.86);
  }
}
</style>
