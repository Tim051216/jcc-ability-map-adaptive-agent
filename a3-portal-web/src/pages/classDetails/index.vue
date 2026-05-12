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
                <div class="tit">课程节数</div>
                <div class="info">{{ baseDetailsData.cataTotalNum }} 节</div>
              </div>
              <div class="card">
                <div class="tit">有效期</div>
                <div class="info">
                  {{ baseDetailsData.validDuration > 99 ? "长期有效" : `${baseDetailsData.validDuration} 个月` }}
                </div>
              </div>
              <div class="card bd-non">
                <div class="tit">推荐指数</div>
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
                收藏课程
              </div>
              <div class="bt-wt bt-round ft-14">
                <weixin class="wx" />
                分享介绍
              </div>
            </div>
          </div>
        </div>

        <div v-if="baseDetailsData">
          <div v-if="baseDetailsData.price != '0'" class="buyCont fx-sb">
            <div class="fx-ct">
              <span class="price">¥</span>
              <span class="price">{{ (baseDetailsData.price / 100).toFixed(2) }}</span>
              <span class="desc">当前页面优先服务赛题演示与前端验收，后续可逐步切回真实下单链路。</span>
            </div>
            <div v-if="!isSignUp" class="buy">
              <span class="bt-red1 bt-round marg-rt-20" @click="addCarts">加入购物车</span>
              <span class="bt-red bt-round" @click="payHandle">立即购买</span>
            </div>
            <div v-else class="buy" @click="goLearning">
              <span class="bt-red bt-round">进入学习</span>
            </div>
          </div>

          <div v-else class="buyCont fx-sb">
            <div class="fx-ct">
              <span class="price">免费</span>
            </div>
            <div v-if="!isSignUp" class="buy" @click="signUpHandle">
              <span class="bt-red bt-round">加入学习</span>
            </div>
            <div v-else class="buy" @click="goLearning">
              <span class="bt-red bt-round">进入学习</span>
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
          演示版本暂未开放学员评价功能。
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
import { computed, ref, watch } from "vue";
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
  { id: 1, name: "课程介绍" },
  { id: 2, name: "课程目录" },
  { id: 3, name: "问答" },
  { id: 4, name: "笔记" },
  { id: 5, name: "评价" },
];

const guestTableBar = [
  { id: 1, name: "课程介绍" },
  { id: 2, name: "课程目录" },
  { id: 5, name: "评价" },
];

const tableBar = computed(() => (isLogin() && isSignUp.value ? fullTableBar : guestTableBar));

const askData = [
  {
    ask: "报名后的课程在哪里查看？",
    answer: "登录后可以进入学习中心，或前往个人中心的“我的课程”查看当前学习进度。",
  },
  {
    ask: "为什么演示模式下可以直接进入课程？",
    answer: "当前版本主要用于赛题验收演示，部分课程数据由前端本地演示数据兜底提供。",
  },
  {
    ask: "后续还能切回真实后端吗？",
    answer: "可以。现在的演示数据只是在保护前端流程，后续仍可逐步切回真实服务。",
  },
  {
    ask: "建议怎么演示这条链路？",
    answer: "推荐按首页、搜索、详情、学习、练习的顺序演示，讲解会更完整。",
  },
];

const likeData = ref([
  {
    id: 201,
    name: "Vue 3 项目工程化落地",
    coverUrl: banner3,
    price: 9900,
    sections: 18,
    sold: 740,
    teacher: "前端架构组",
  },
  {
    id: 301,
    name: "大模型应用开发导论",
    coverUrl: banner2,
    price: 12900,
    sections: 20,
    sold: 680,
    teacher: "A3 AI 实验室",
  },
]);

watch(baseDetailsData, (value) => {
  if (!value?.id) {
    return;
  }

  likeData.value = [
    {
      id: value.id === 201 ? 101 : 201,
      name: value.id === 201 ? "A3 智能学习助手实战" : "Vue 3 项目工程化落地",
      coverUrl: value.id === 201 ? value.coverUrl : banner3,
      price: value.id === 201 ? 0 : 9900,
      sections: value.id === 201 ? 24 : 18,
      sold: value.id === 201 ? 1260 : 740,
      teacher: value.id === 201 ? "A3 教学团队" : "前端架构组",
    },
    {
      id: value.id === 301 ? 302 : 301,
      name: value.id === 301 ? "软考赛题项目实训" : "大模型应用开发导论",
      coverUrl: value.id === 301 ? value.coverUrl : banner2,
      price: value.id === 301 ? 0 : 12900,
      sections: value.id === 301 ? 28 : 20,
      sold: value.id === 301 ? 1500 : 680,
      teacher: value.id === 301 ? "竞赛辅导组" : "A3 AI 实验室",
    },
  ];
});

const loadCourseDetailsPage = async (courseId) => {
  detailsId.value = courseId;
  baseDetailsData.value = {};
  baseClassTeacher.value = [];
  baseClassTeacherData.value = [];
  classListData.value = [];
  planData.value = undefined;
  isSignUp.value = false;

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
};

watch(
  () => route.query.id,
  async (courseId) => {
    if (!courseId) {
      return;
    }
    await loadCourseDetailsPage(courseId);
  },
  { immediate: true },
);

const getClassDetailsData = async () => {
  try {
    const res = await getClassDetails(detailsId.value);
    if (res.code === 200) {
      baseDetailsData.value = res.data;
      return;
    }
    ElMessage({ message: res.msg || "课程详情加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "课程详情加载失败", type: "error" });
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
    ElMessage({ message: res.msg || "导师信息加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "导师信息加载失败", type: "error" });
  }
};

const getClassListData = async () => {
  try {
    const res = await getClassList(detailsId.value);
    if (res.code === 200) {
      classListData.value = res.data || [];
      return;
    }
    ElMessage({ message: res.msg || "课程目录加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "课程目录加载失败", type: "error" });
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
      ElMessage({ message: "已加入学习", type: "success" });
      isSignUp.value = true;
      return;
    }
    ElMessage({ message: res.msg || "加入学习失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "加入学习失败", type: "error" });
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
    ElMessageBox.confirm("请先登录后再继续操作。", "需要登录", {
      confirmButtonText: "去登录",
      cancelButtonText: "继续浏览",
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
      ElMessage({ message: "已加入购物车", type: "success" });
      return;
    }
    ElMessage({ message: res.msg || "加入购物车失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "加入购物车失败", type: "error" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
