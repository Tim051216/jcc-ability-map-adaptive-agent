<template>
  <div class="classDetailsWrapper">
    <div class="detailHead">
      <div class="backGround">
        <img :src="baseDetailsData.coverUrl" width="100%" alt="" />
      </div>
      <div class="container">
        <Breadcrumb :data="baseDetailsData.cateNames && baseDetailsData.cateNames.split('/').at(-1)" />
        <div class="topInfo fx">
          <div>
            <img :src="baseDetailsData.coverUrl" width="380" height="234" alt="" />
          </div>
          <div class="fx-1">
            <div class="title">{{ baseDetailsData.name }}</div>
            <div class="item fx">
              <div class="card">
                <div class="tit">&#x8BFE;&#x7A0B;&#x8282;&#x6570;</div>
                <div class="info">{{ baseDetailsData.cataTotalNum }} &#x8282;</div>
              </div>
              <div class="card">
                <div class="tit">&#x6709;&#x6548;&#x671F;</div>
                <div class="info">
                  {{ baseDetailsData.validDuration > 99 ? "&#x957F;&#x671F;&#x6709;&#x6548;" : `${baseDetailsData.validDuration} 个月` }}
                </div>
              </div>
              <div class="card bd-non">
                <div class="tit">&#x63A8;&#x8350;&#x6307;&#x6570;</div>
                <div class="info">{{ baseDetailsData.score / 10 }}</div>
              </div>
            </div>
            <div class="fx">
              <div
                class="bt-wt bt-round marg-rt-15 ft-14"
                :class="{ isCollection: isCollection }"
                @click="collectionHandle"
              >
                <i :class="{ iconfont: true, 'zhy-btn_shoucang': !isCollection, 'zhy-btn_yishoucang': isCollection }"></i>
                &#x6536;&#x85CF;&#x8BFE;&#x7A0B;
              </div>
              <div class="bt-wt bt-round ft-14">
                <weixin class="wx" />
                &#x5206;&#x4EAB;&#x4ECB;&#x7ECD;
              </div>
            </div>
          </div>
        </div>

        <div v-if="baseDetailsData">
          <div v-if="baseDetailsData.price != '0'" class="buyCont fx-sb">
            <div class="fx-ct">
              <span class="price">¥</span>
              <span class="price">{{ (baseDetailsData.price / 100).toFixed(2) }}</span>
              <span class="desc">&#x5F53;&#x524D;&#x9875;&#x9762;&#x4F18;&#x5148;&#x670D;&#x52A1;&#x8D5B;&#x9898;&#x6F14;&#x793A;&#x4E0E;&#x524D;&#x7AEF;&#x9A8C;&#x6536;&#xFF0C;&#x540E;&#x7EED;&#x53EF;&#x9010;&#x6B65;&#x5207;&#x56DE;&#x771F;&#x5B9E;&#x4E0B;&#x5355;&#x94FE;&#x8DEF;&#x3002;</span>
            </div>
            <div v-if="!isSignUp" class="buy">
              <span class="bt-red1 bt-round marg-rt-20" @click="addCarts">&#x52A0;&#x5165;&#x8D2D;&#x7269;&#x8F66;</span>
              <span class="bt-red bt-round" @click="payHandle">&#x7ACB;&#x5373;&#x8D2D;&#x4E70;</span>
            </div>
            <div v-else class="buy" @click="goLearning">
              <span class="bt-red bt-round">&#x8FDB;&#x5165;&#x5B66;&#x4E60;</span>
            </div>
          </div>

          <div v-else class="buyCont fx-sb">
            <div class="fx-ct">
              <span class="price">&#x514D;&#x8D39;</span>
            </div>
            <div v-if="!isSignUp" class="buy" @click="signUpHandle">
              <span class="bt-red bt-round">&#x52A0;&#x5165;&#x5B66;&#x4E60;</span>
            </div>
            <div v-else class="buy" @click="goLearning">
              <span class="bt-red bt-round">&#x8FDB;&#x5165;&#x5B66;&#x4E60;</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="DetailsContent container fx">
      <div class="leftCont bg-wt">
        <TableSwitchBar :data="tableBar" @changeTable="changeTable" />
        <ClassAbout v-show="actId === 1" :baseDetailsData="baseDetailsData" :baseClassTeacher="baseClassTeacher" />
        <ClassCatalogue v-show="actId === 2" :data="classListData" :isSignUp="isSignUp" :id="detailsId" />
        <ClassAsk v-if="isLogin() && isSignUp" v-show="actId === 3" :id="detailsId" :title="baseDetailsData.name" />
        <Note v-if="isLogin() && isSignUp" v-show="actId === 4" :id="detailsId" />
        <div v-show="actId === 5" class="fx-ct ft-cl-des" style="height: 400px">
          &#x6F14;&#x793A;&#x7248;&#x672C;&#x6682;&#x672A;&#x5F00;&#x653E;&#x5B66;&#x5458;&#x8BC4;&#x4EF7;&#x529F;&#x80FD;&#x3002;
        </div>
      </div>

      <div class="ritCont">
        <Ask :data="askData" />
        <LikeCards :data="likeData" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import weixin from "@/assets/icon_weixin.svg";
import banner2 from "@/assets/banner2.jpg";
import banner3 from "@/assets/banner3.jpg";
import Breadcrumb from "@/components/Breadcrumb.vue";
import TableSwitchBar from "@/components/TableSwitchBar.vue";
import ClassAbout from "./components/ClassAbout.vue";
import LikeCards from "./components/LikeCards.vue";
import Ask from "./components/Ask.vue";
import ClassAsk from "./components/ClassAsk.vue";
import Note from "./components/Note.vue";
import ClassCatalogue from "./components/ClassCatalogue.vue";
import { getClassDetails, getClassList, getClassTeachers } from "@/api/classDetails.js";
import { enrolledFreeCourse, putCarts } from "@/api/order.js";
import { getCourseLearning } from "@/api/class.js";
import { dataCacheStore, isLogin } from "@/store";

const route = useRoute();
const router = useRouter();
const store = dataCacheStore();

const detailsId = ref("");
const baseDetailsData = ref({});
const baseClassTeacher = ref([]);
const baseClassTeacherData = ref([]);
const classListData = ref([]);
const isCollection = ref(false);
const actId = ref(1);
const isSignUp = ref(false);
const planData = ref();

const fullTableBar = [
  { id: 1, name: "\u8BFE\u7A0B\u4ECB\u7ECD" },
  { id: 2, name: "\u8BFE\u7A0B\u76EE\u5F55" },
  { id: 3, name: "\u95EE\u7B54" },
  { id: 4, name: "\u7B14\u8BB0" },
  { id: 5, name: "\u8BC4\u4EF7" },
];

const guestTableBar = [
  { id: 1, name: "\u8BFE\u7A0B\u4ECB\u7ECD" },
  { id: 2, name: "\u8BFE\u7A0B\u76EE\u5F55" },
  { id: 5, name: "\u8BC4\u4EF7" },
];

const tableBar = computed(() => (isLogin() && isSignUp.value ? fullTableBar : guestTableBar));

const askData = [
  {
    ask: "\u62A5\u540D\u540E\u7684\u8BFE\u7A0B\u5728\u54EA\u91CC\u67E5\u770B\uFF1F",
    answer: "\u767B\u5F55\u540E\u53EF\u4EE5\u8FDB\u5165\u5B66\u4E60\u4E2D\u5FC3\uFF0C\u6216\u524D\u5F80\u4E2A\u4EBA\u4E2D\u5FC3\u7684\u201C\u6211\u7684\u8BFE\u7A0B\u201D\u67E5\u770B\u5F53\u524D\u5B66\u4E60\u8FDB\u5EA6\u3002",
  },
  {
    ask: "\u4E3A\u4EC0\u4E48\u6F14\u793A\u6A21\u5F0F\u4E0B\u53EF\u4EE5\u76F4\u63A5\u8FDB\u5165\u8BFE\u7A0B\uFF1F",
    answer: "\u5F53\u524D\u7248\u672C\u4E3B\u8981\u7528\u4E8E\u8D5B\u9898\u9A8C\u6536\u6F14\u793A\uFF0C\u90E8\u5206\u8BFE\u7A0B\u6570\u636E\u7531\u524D\u7AEF\u672C\u5730\u6F14\u793A\u6570\u636E\u5140\u5E95\u63D0\u4F9B\u3002",
  },
  {
    ask: "\u540E\u7EED\u8FD8\u80FD\u5207\u56DE\u771F\u5B9E\u540E\u7AEF\u5417\uFF1F",
    answer: "\u53EF\u4EE5\u3002\u73B0\u5728\u7684\u6F14\u793A\u6570\u636E\u53EA\u662F\u5728\u4FDD\u62A4\u524D\u7AEF\u6D41\u7A0B\uFF0C\u540E\u7EED\u4ECD\u53EF\u9010\u6B65\u5207\u56DE\u771F\u5B9E\u670D\u52A1\u3002",
  },
  {
    ask: "\u5EFA\u8BAE\u600E\u4E48\u6F14\u793A\u8FD9\u6761\u94FE\u8DEF\uFF1F",
    answer: "\u63A8\u8350\u6309\u9996\u9875\u3001\u641C\u7D22\u3001\u8BE6\u60C5\u3001\u5B66\u4E60\u3001\u7EC3\u4E60\u7684\u987A\u5E8F\u6F14\u793A\uFF0C\u8BB2\u89E3\u4F1A\u66F4\u5B8C\u6574\u3002",
  },
];

const likeData = ref([
  {
    id: 201,
    name: "Vue 3 \u9879\u76EE\u5DE5\u7A0B\u5316\u843D\u5730",
    coverUrl: banner3,
    price: 9900,
    sections: 18,
    sold: 740,
    teacher: "\u524D\u7AEF\u67B6\u6784\u7EC4",
  },
  {
    id: 301,
    name: "\u5927\u6A21\u578B\u5E94\u7528\u5F00\u53D1\u5BFC\u8BBA",
    coverUrl: banner2,
    price: 12900,
    sections: 20,
    sold: 680,
    teacher: "A3 AI \u5B9E\u9A8C\u5BA4",
  },
]);

watch(baseDetailsData, (value) => {
  if (!value?.id) {
    return;
  }

  likeData.value = [
    {
      id: value.id === 201 ? 101 : 201,
      name: value.id === 201 ? "A3 \u667A\u80FD\u5B66\u4E60\u52A9\u624B\u5B9E\u6218" : "Vue 3 \u9879\u76EE\u5DE5\u7A0B\u5316\u843D\u5730",
      coverUrl: value.id === 201 ? value.coverUrl : banner3,
      price: value.id === 201 ? 0 : 9900,
      sections: value.id === 201 ? 24 : 18,
      sold: value.id === 201 ? 1260 : 740,
      teacher: value.id === 201 ? "A3 \u6559\u5B66\u56E2\u961F" : "\u524D\u7AEF\u67B6\u6784\u7EC4",
    },
    {
      id: value.id === 301 ? 302 : 301,
      name: value.id === 301 ? "\u8F6F\u8003\u8D5B\u9898\u9879\u76EE\u5B9E\u8BAD" : "\u5927\u6A21\u578B\u5E94\u7528\u5F00\u53D1\u5BFC\u8BBA",
      coverUrl: value.id === 301 ? value.coverUrl : banner2,
      price: value.id === 301 ? 0 : 12900,
      sections: value.id === 301 ? 28 : 20,
      sold: value.id === 301 ? 1500 : 680,
      teacher: value.id === 301 ? "\u7ADE\u8D5B\u8F85\u5BFC\u7EC4" : "A3 AI \u5B9E\u9A8C\u5BA4",
    },
  ];
});

onMounted(async () => {
  detailsId.value = route.query.id;
  await getClassDetailsData();
  await getClassTeachersData();
  await getClassListData();

  if (await isLogin()) {
    await getCourseLearningData();
  }

  store.setLearingDataes({
    classDetailsData: baseDetailsData.value,
    teacherData: baseClassTeacherData.value,
    planData: planData.value,
  });
});

const getClassDetailsData = async () => {
  try {
    const res = await getClassDetails(detailsId.value);
    if (res.code === 200) {
      baseDetailsData.value = res.data;
      return;
    }
    ElMessage({ message: res.msg || "\u8BFE\u7A0B\u8BE6\u60C5\u52A0\u8F7D\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u8BFE\u7A0B\u8BE6\u60C5\u52A0\u8F7D\u5931\u8D25", type: "error" });
  }
};

const getClassTeachersData = async () => {
  try {
    const res = await getClassTeachers(detailsId.value);
    if (res.code === 200) {
      const data = (res.data || []).filter((item) => item.isShow);
      baseClassTeacherData.value = data;
      const grouped = [];

      data.forEach((item) => {
        const last = grouped.at(-1);
        if (!last || last.length >= 2) {
          grouped.push([item]);
        } else {
          last.push(item);
        }
      });

      baseClassTeacher.value = grouped;
      return;
    }
    ElMessage({ message: res.msg || "\u5BFC\u5E08\u4FE1\u606F\u52A0\u8F7D\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u5BFC\u5E08\u4FE1\u606F\u52A0\u8F7D\u5931\u8D25", type: "error" });
  }
};

const getClassListData = async () => {
  try {
    const res = await getClassList(detailsId.value);
    if (res.code === 200) {
      classListData.value = res.data || [];
      return;
    }
    ElMessage({ message: res.msg || "\u8BFE\u7A0B\u76EE\u5F55\u52A0\u8F7D\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u8BFE\u7A0B\u76EE\u5F55\u52A0\u8F7D\u5931\u8D25", type: "error" });
  }
};

const changeTable = (id) => {
  actId.value = id;
};

const collectionHandle = () => {
  isCollection.value = !isCollection.value;
};

const signUpHandle = async () => {
  if (!validation()) {
    return;
  }

  try {
    const res = await enrolledFreeCourse(detailsId.value);
    if (res.code === 200) {
      ElMessage({ message: "\u5DF2\u52A0\u5165\u5B66\u4E60", type: "success" });
      isSignUp.value = true;
      return;
    }
    ElMessage({ message: res.msg || "\u52A0\u5165\u5B66\u4E60\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u52A0\u5165\u5B66\u4E60\u5931\u8D25", type: "error" });
  }
};

const goLearning = () => {
  router.push({ path: "/learning", query: { id: detailsId.value } });
};

const getCourseLearningData = async () => {
  try {
    const res = await getCourseLearning(detailsId.value);
    if (res.code === 200 && res.data) {
      isSignUp.value = true;
      planData.value = res.data;
      return;
    }
    isSignUp.value = false;
  } catch (error) {
    isSignUp.value = false;
  }
};

const payHandle = () => {
  if (!validation()) {
    return;
  }
  store.setOrderClassInfo([baseDetailsData.value]);
  router.push({ path: "/pay/settlement" });
};

const validation = () => {
  if (!isLogin()) {
    ElMessageBox.confirm("\u8BF7\u5148\u767B\u5F55\u540E\u518D\u7EE7\u7EED\u64CD\u4F5C\u3002", "\u9700\u8981\u767B\u5F55", {
      confirmButtonText: "\u53BB\u767B\u5F55",
      cancelButtonText: "\u7EE7\u7EED\u6D4F\u89C8",
      type: "warning",
    }).then(() => {
      router.push({ path: "/login" });
    });
    return false;
  }
  return true;
};

const addCarts = async () => {
  if (!validation()) {
    return;
  }

  try {
    const res = await putCarts({ courseId: detailsId.value });
    if (res.code === 200) {
      ElMessage({ message: "\u5DF2\u52A0\u5165\u8D2D\u7269\u8F66", type: "success" });
      return;
    }
    ElMessage({ message: res.msg || "\u52A0\u5165\u8D2D\u7269\u8F66\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u52A0\u5165\u8D2D\u7269\u8F66\u5931\u8D25", type: "error" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
