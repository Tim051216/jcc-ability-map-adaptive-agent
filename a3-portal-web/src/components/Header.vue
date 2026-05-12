<template>
  <header class="bg-wt">
    <div class="container fx">
      <div class="logo">
        <router-link to="/" class="brand">
          <span class="brandMark">A3</span>
          <span class="brandText">
            <strong>A3 智能学习平台</strong>
            <em>智能学习助手演示端</em>
          </span>
        </router-link>
      </div>

      <div
        v-if="showCategoryEntry"
        class="courseClass font-bt2"
        @mouseover="isShow = true"
        @mouseout="isShow = false"
      >
        <i class="iconfont zhy-icon_fenlei_nor"></i>
        课程分类
      </div>
      <div
        v-if="showCategoryEntry"
        v-show="isShow"
        class="courseClassList"
        @mouseover="isShow = true"
        @mouseout="isShow = false"
      >
        <div class="firstItems">
          <ClassCategory :data="courseClass" type="float" />
        </div>
      </div>

      <div class="fx-1 fx-ct">
        <el-input
          v-model="input"
          class="headerSearch"
          size="large"
          placeholder="请输入课程、专题或关键词"
          @keyup.enter="searchHandle"
        >
          <template #prefix>
            <Search class="search" @click="searchHandle" />
          </template>
        </el-input>
      </div>

      <div class="fx-al-ct pt-rt">
        <div v-if="userInfo" class="car fx-al-ct font-bt2" @click="$router.push('/pay/carts')">
          <i class="iconfont">&#xe6f3;</i>
          采购清单
        </div>

        <div v-if="userInfo && userInfo.name">
          <span
            class="marg-lr-40 font-bt2"
            style="padding: 27px 0"
            @click="$router.push('/personal/main/myClass')"
            @mouseover="learningShow = true"
            @mouseout="learningShow = false"
          >
            学习中心
          </span>
          <div
            v-show="learningShow && learnClassInfo && learnClassInfo.courseName"
            class="learningCont"
            @mouseover="learningShow = true"
            @mouseout="learningShow = false"
          >
            <div class="count">
              <em>1</em>
              门课程
            </div>
            <div v-if="learnClassInfo && learnClassInfo.courseId" class="info">
              <div class="fx-sb">
                <span>正在学习</span>
                <div class="fx">
                  <span class="bt" @click="$router.push({ path: '/learning/index', query: { id: learnClassInfo.courseId } })">
                    继续学习
                  </span>
                  <span class="bt bt-grey1" @click="$router.push('/personal/main/myClass')">全部课程</span>
                </div>
              </div>
              <div class="tit">{{ learnClassInfo.courseName }}</div>
              <div class="perc fx-sb">
                {{ learnClassInfo.latestSectionName }}
                <i>{{ progressPercent }}%</i>
              </div>
            </div>
          </div>
        </div>

        <div v-if="userInfo && userInfo.name" class="fx-al-ct">
          <img class="headIcon" :src="userInfo.icon" :onerror="onerrorImg" alt="" />
          <div>{{ userInfo.name }}</div>
        </div>
        <div v-else class="cur-pt">
          <span class="font-bt2" @click="$router.push({ path: '/login', query: { md: 'register' } })">注册</span>
          <span>/</span>
          <span class="font-bt2" @click="$router.push('/login')">登录</span>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, onBeforeMount, ref, watchEffect } from "vue";
import { Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import defaultImage from "@/assets/icon.jpeg";
import router from "../router";
import ClassCategory from "./ClassCategory.vue";
import { dataCacheStore, getToken, isLogin, useUserStore } from "@/store";
import { getUserInfo } from "@/api/user";
import { getClassCategorys, getMyLearning, normalizeCategoryData } from "@/api/class.js";

const store = useUserStore();
const userStore = getToken();
const route = useRoute();
const dataCache = dataCacheStore();

const userInfo = ref(null);
const input = ref("");
const courseClass = ref([]);
const isShow = ref(false);
const learnClassInfo = ref(null);
const learningShow = ref(false);

const showCategoryEntry = computed(() => route.path !== "/main/index" && route.path !== "/login");

const progressPercent = computed(() => {
  if (!learnClassInfo.value?.sections) {
    return 0;
  }
  return Math.round(((learnClassInfo.value.learnedSections || 0) * 100) / learnClassInfo.value.sections);
});

onBeforeMount(() => {
  void initHeader();
});

watchEffect(() => {
  if (route.path !== "/search/index") {
    input.value = "";
  } else {
    input.value = dataCache.getSearchKey;
  }
});

const initHeader = async () => {
  let loggedIn = false;

  try {
    userInfo.value = store.getUserInfo || null;

    if (!userInfo.value) {
      loggedIn = await safeIsLogin();
      if (loggedIn) {
        const res = await getUserInfo();
        if (res.code === 200 && res.data) {
          userInfo.value = res.data;
          store.setUserInfo(res.data);
        }
      } else {
        userStore.logout();
      }
    } else {
      loggedIn = true;
    }

    courseClass.value = normalizeCategoryData(dataCache.getCourseClassDataes || []);
    if (courseClass.value.length === 0) {
      await getCourseClassHandle();
    } else {
      dataCache.setCourseClassDataes(courseClass.value);
    }

    if (typeof route.query.key === "string") {
      input.value = route.query.key;
    }

    if (loggedIn) {
      await getLearnClassInfoHandle();
    }
  } catch (error) {
    userInfo.value = null;
    learnClassInfo.value = null;
    console.warn("A3 header init skipped:", error);
  }
};

const safeIsLogin = async () => {
  try {
    return await isLogin();
  } catch (error) {
    return false;
  }
};

const getLearnClassInfoHandle = async () => {
  try {
    const res = await getMyLearning();
    if (res.code === 200) {
      learnClassInfo.value = res.data || null;
      return;
    }
    learnClassInfo.value = null;
  } catch (error) {
    learnClassInfo.value = null;
  }
};

const getCourseClassHandle = async () => {
  try {
    const res = await getClassCategorys();
    if (res.code === 200) {
      courseClass.value = normalizeCategoryData(res.data || []);
      dataCache.setCourseClassDataes(courseClass.value);
      return;
    }
    courseClass.value = [];
  } catch (error) {
    courseClass.value = [];
  }
};

const onerrorImg = () => {
  if (userInfo.value) {
    userInfo.value.icon = defaultImage;
  }
};

const searchHandle = () => {
  if (!input.value.trim()) {
    ElMessage({
      type: "error",
      message: "请输入搜索关键词",
    });
    return;
  }
  dataCache.setSearchKey(input.value.trim());
  router.push({ path: "/search", query: { key: input.value.trim() } });
};
</script>

<style lang="scss" scoped>
header {
  width: 100%;
  background-color: var(--color-white);
  text-align: left;
  padding: 11px 0;
  font-size: 14px;

  .courseClass {
    position: relative;
    line-height: 48px;
    margin-left: 26px;
    display: flex;
    font-size: 14px;

    .iconfont {
      font-size: 24px;
      margin-right: 5px;
    }
  }

  .brand {
    display: flex;
    align-items: center;
    color: var(--color-font1);
    text-decoration: none;
  }

  .brandMark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: linear-gradient(135deg, #0f6adf 0%, #28b381 100%);
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .brandText {
    display: flex;
    flex-direction: column;
    margin-left: 12px;
    line-height: 1.1;

    strong {
      font-size: 20px;
      font-weight: 700;
      color: #172033;
    }

    em {
      margin-top: 4px;
      font-size: 11px;
      color: #6b7280;
      font-style: normal;
      letter-spacing: 0.08em;
    }
  }

  .courseClassList {
    position: absolute;
    z-index: 999;
    top: 50px;
    left: 102px;

    .firstItems {
      background-color: #fff;
    }
  }

  .headerSearch {
    width: 427px;
    height: 40px;
    background: #edf0f4;
    border-radius: 8px;

    :deep(.el-input__wrapper) {
      background-color: transparent;
    }

    .search {
      position: absolute;
      cursor: pointer;
      right: 0;
      width: 15px;
      height: 15px;
    }
  }

  .car {
    .iconfont {
      font-size: 24px;
      margin-right: 6px;
    }
  }

  .learningCont {
    position: absolute;
    z-index: 999;
    width: 330px;
    height: 200px;
    border-radius: 8px;
    left: -40px;
    top: 45px;
    background-color: #fff;
    box-shadow: 0 4px 6px 2px rgba(108, 112, 118, 0.17);

    &::before {
      position: absolute;
      z-index: -1;
      content: "";
      top: -5px;
      left: 43%;
      display: inline-block;
      width: 15px;
      height: 15px;
      background-color: #fff;
      transform: rotate(45deg);
      box-shadow: 0 4px 6px 2px rgba(108, 112, 118, 0.17);
    }

    .count {
      background-color: #fff;
      padding: 20px;
      line-height: 40px;
      border-bottom: 1px solid #eeeeee;
      display: flex;

      em {
        color: var(--color-main);
        font-weight: 600;
        font-size: 28px;
        margin-right: 4px;
        font-style: normal;
      }
    }

    .info {
      padding: 13px 20px 20px;
      line-height: 28px;
      color: #80878c;

      .bt {
        line-height: 28px;
        height: 28px;
        font-size: 12px;
        padding: 0 10px;
        margin-left: 10px;
      }

      .tit {
        font-weight: 600;
        font-size: 14px;
        line-height: 28px;
        color: #19232b;
      }

      .perc i {
        font-style: normal;
        color: #80878c;
      }
    }
  }

  .headIcon {
    width: 30px;
    height: 30px;
    border-radius: 100%;
    margin-right: 10px;
  }
}

@media (max-width: 1100px) {
  header {
    padding: 10px 0 14px;

    .container {
      flex-wrap: wrap;
      gap: 12px;
    }

    .courseClass {
      margin-left: 0;
      line-height: 40px;
    }

    .courseClassList {
      left: 0;
      top: 42px;
    }

    .fx-1.fx-ct {
      order: 3;
      width: 100%;
      flex: 1 0 100%;
    }

    .headerSearch {
      width: 100%;
      max-width: none;
    }

    .pt-rt {
      margin-left: auto;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
    }

    .marg-lr-40 {
      margin-left: 0;
      margin-right: 0;
    }

    .learningCont {
      left: auto;
      right: 0;
      width: min(330px, calc(100vw - 32px));
    }
  }
}
</style>
