<template>
  <div class="mainWrapper">
    <div class="container banner fx" style="overflow: hidden">
      <div class="categorys bg-wt">
        <ClassCategory :data="classCategorys" />
      </div>
      <Swiper :data="imags" />
    </div>

    <div v-if="interest.size > 0" class="container">
      <Interest :data="interest" :key="intKey" @setInterest="setInterest" />
    </div>

    <div class="pd-tp-30 bg-wt">
      <OpenClass title="&#x6700;&#x65B0;&#x63A5;&#x5165;&#x8BFE;&#x7A0B;" class="container" :data="freeClassData" />
    </div>

    <div class="globalTopBanner a3ShowcaseBanner" style="display: block">
      <div class="bannerInner">
        <div class="bannerEyebrow">&#x0041;&#x0033;&#x0020;&#x8D5B;&#x9898;&#x6F14;&#x793A;&#x94FE;&#x8DEF;</div>
        <div class="bannerTitle">&#x4ECE;&#x8BFE;&#x7A0B;&#x63A8;&#x8350;&#x5230;&#x5B66;&#x4E60;&#x4E92;&#x52A8;&#xFF0C;&#x805A;&#x7126;&#x53EF;&#x5C55;&#x793A;&#x3001;&#x53EF;&#x9A8C;&#x6536;&#x3001;&#x53EF;&#x8054;&#x8C03;</div>
        <div class="bannerDesc">
          &#x5F53;&#x524D;&#x7248;&#x672C;&#x4F18;&#x5148;&#x4FDD;&#x969C;&#x524D;&#x7AEF;&#x6F14;&#x793A;&#x548C;&#x8D5B;&#x9898;&#x9A8C;&#x6536;&#x4F53;&#x9A8C;&#xFF0C;&#x540E;&#x7EED;&#x53EF;&#x4EE5;&#x7EE7;&#x7EED;&#x63A5;&#x56DE;&#x771F;&#x5B9E;&#x7F51;&#x5173;&#x3001;&#x8BA4;&#x8BC1;&#x3001;&#x7528;&#x6237;&#x4E0E;&#x5B66;&#x4E60;&#x670D;&#x52A1;&#x3002;
        </div>
        <div class="bannerActions">
          <router-link class="primaryAction" to="/main/ai-demo">进入 AI 协同演示页</router-link>
          <div class="actionHint">可直接展示 intent、agent trace、学习计划与资源生成结果</div>
        </div>
      </div>
    </div>

    <div class="pd-tp-30">
      <OpenClass title="&#x9879;&#x76EE;&#x5B9E;&#x6218;&#x4E13;&#x9898;" class="container" :data="goodClassData" />
    </div>

    <div class="pd-tp-30">
      <OpenClass title="&#x6301;&#x7EED;&#x66F4;&#x65B0;&#x5185;&#x5BB9;" class="container" :data="newClassData" />
    </div>

    <div class="interest">
      <el-dialog v-model="interestDialog" width="80%" :show-close="false">
        <template #header="{ close }">
          <div class="dialogHead fx-sb">
            <div>
              <span class="titleClass marg-rt-10">&#x8BBE;&#x7F6E;&#x5B66;&#x4E60;&#x5174;&#x8DA3;</span>
              <span class="ft-cl-des">&#x6253;&#x9020;&#x4F60;&#x7684;&#x4E13;&#x5C5E;&#x667A;&#x80FD;&#x5B66;&#x4E60;&#x5E73;&#x53F0;</span>
            </div>
            <div class="butCont fx">
              <span class="bt-grey marg-rt-15" @click="close">&#x4E0B;&#x6B21;&#x518D;&#x8BF4;</span>
              <span class="bt" @click="saveInterest">&#x4FDD;&#x5B58;&#x8BBE;&#x7F6E;</span>
            </div>
          </div>
        </template>
        <CheckInterest :data="classCategorys" :initValue="interest" @setInterestList="setInterestList" />
      </el-dialog>
    </div>

    <div class="floatCont fx-fd-col fx-ct">
      <router-link to="/main/coupon">
        <img src="@/assets/coup.png" coupon alt="" />
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
    eyebrow: "A3 \u8d5b\u9898\u6f14\u793a\u94fe\u8def",
    title: "\u9762\u5411\u9a8c\u6536\u7684\u8bfe\u7a0b\u5b66\u4e60\u6f14\u793a\u95ed\u73af",
    desc: "\u4ece\u8bfe\u7a0b\u63a8\u8350\u8fdb\u5165\u641c\u7d22\u4e0e\u8be6\u60c5\uff0c\u518d\u7ee7\u7eed\u5230\u5b66\u4e60\u548c\u7ec3\u4e60\u9875\u9762\uff0c\u4e0d\u4f9d\u8d56\u5b8c\u6574\u540e\u7aef\u4e5f\u80fd\u7a33\u5b9a\u5b8c\u6210\u6574\u6761\u5c55\u793a\u94fe\u8def\u3002",
    meta: "\u9996\u9875 -> \u641c\u7d22 -> \u8be6\u60c5 -> \u5b66\u4e60 -> \u7ec3\u4e60",
    background: "linear-gradient(135deg, #1f4f8a 0%, #235d9f 45%, #2a8f7e 100%)",
  },
  {
    eyebrow: "\u524d\u7aef\u4f18\u5148\u9a8c\u6536",
    title: "\u771f\u5b9e\u670d\u52a1\u4e0d\u7a33\u5b9a\u65f6\uff0c\u9875\u9762\u4e5f\u80fd\u7ee7\u7eed\u770b\u3001\u7ee7\u7eed\u9a8c",
    desc: "\u901a\u8fc7\u6f14\u793a\u6570\u636e\u515c\u5e95\uff0c\u5148\u4fdd\u8bc1\u8def\u7531\u3001\u767b\u5f55\u6001\u3001\u7ec4\u4ef6\u6e32\u67d3\u548c\u4ea4\u4e92\u8fc7\u7a0b\u53ef\u68c0\u67e5\u3001\u53ef\u8bb2\u89e3\u3001\u53ef\u590d\u73b0\u3002",
    meta: "\u5148\u9a8c\u9875\u9762\u7ed3\u6784\uff0c\u518d\u9010\u6b65\u5207\u56de\u771f\u5b9e\u670d\u52a1",
    background: "linear-gradient(135deg, #253b80 0%, #3b82f6 52%, #0ea5a4 100%)",
  },
  {
    eyebrow: "A3 \u4ea4\u4ed8\u8282\u594f",
    title: "\u5148\u7a33\u4f4f\u6f14\u793a\uff0c\u518d\u56de\u63a5\u771f\u5b9e\u8054\u8c03",
    desc: "\u5f53\u524d portal \u5148\u786e\u4fdd\u5c55\u793a\u6548\u679c\u548c\u9a8c\u6536\u4f53\u9a8c\uff0c\u540e\u7eed\u53ef\u6309\u7f51\u5173\u3001\u8ba4\u8bc1\u3001\u7528\u6237\u3001\u5b66\u4e60\u670d\u52a1\u7684\u987a\u5e8f\u9010\u6b65\u63a5\u56de\u771f\u5b9e\u94fe\u8def\u3002",
    meta: "\u5148\u6f14\u793a\uff0c\u540e\u8054\u8c03",
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
    ElMessage({ message: "\u5206\u7c7b\u4fe1\u606f\u52a0\u8f7d\u5931\u8d25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u5206\u7c7b\u4fe1\u606f\u52a0\u8f7d\u5931\u8d25", type: "error" });
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
    ElMessage({ message: "\u6700\u65b0\u8bfe\u7a0b\u52a0\u8f7d\u5931\u8d25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u6700\u65b0\u8bfe\u7a0b\u52a0\u8f7d\u5931\u8d25", type: "error" });
  }
};

const getGoodClassListData = async () => {
  try {
    const res = await getRecommendClassList("best");
    if (res.code === 200) {
      goodClassData.value = res.data || [];
      return;
    }
    ElMessage({ message: "\u4e13\u9898\u8bfe\u7a0b\u52a0\u8f7d\u5931\u8d25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u4e13\u9898\u8bfe\u7a0b\u52a0\u8f7d\u5931\u8d25", type: "error" });
  }
};

const getNewClassListData = async () => {
  try {
    const res = await getRecommendClassList("new");
    if (res.code === 200) {
      newClassData.value = res.data || [];
      return;
    }
    ElMessage({ message: "\u66f4\u65b0\u5185\u5bb9\u52a0\u8f7d\u5931\u8d25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u66f4\u65b0\u5185\u5bb9\u52a0\u8f7d\u5931\u8d25", type: "error" });
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
    ElMessage({ message: "\u5174\u8da3\u5217\u8868\u83b7\u53d6\u5931\u8d25", type: "error" });
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
      message: "\u8bf7\u5148\u9009\u62e9\u5b66\u4e60\u5174\u8da3\uff0c\u518d\u4fdd\u5b58\u8bbe\u7f6e",
      type: "warning",
    });
    return;
  }

  try {
    const res = await setInterests({ interestedIds: ids });
    if (res.code === 200) {
      ElMessage({ message: "\u5b66\u4e60\u5174\u8da3\u5df2\u4fdd\u5b58", type: "success" });
      await getInterestData();
      intKey.value += 1;
      interestDialog.value = false;
      return;
    }
    ElMessage({ message: "\u5b66\u4e60\u5174\u8da3\u4fdd\u5b58\u5931\u8d25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u5b66\u4e60\u5174\u8da3\u4fdd\u5b58\u5931\u8d25", type: "error" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
<style lang="scss" scoped>
.a3ShowcaseBanner {
  padding: 0 24px;

  .bannerInner {
    max-width: 1180px;
    margin: 0 auto;
    border-radius: 20px;
    padding: 30px 36px;
    color: #fff;
    background: linear-gradient(135deg, #0f4c81 0%, #146c94 45%, #1f9d7a 100%);
    box-shadow: 0 18px 36px rgba(21, 64, 92, 0.18);
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
    font-size: 30px;
    font-weight: 700;
    line-height: 1.35;
  }

  .bannerDesc {
    margin-top: 10px;
    max-width: 760px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.86);
  }

  .bannerActions {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 22px;
    flex-wrap: wrap;
  }

  .primaryAction {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 220px;
    height: 48px;
    padding: 0 22px;
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
}
</style>
