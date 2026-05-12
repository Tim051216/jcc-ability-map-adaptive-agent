<template>
  <div class="classLearning">
    <div class="videoCont">
      <div class="head fx-sb">
        <div class="fx cur-pt" @click="goBack">
          <img src="@/assets/icon_back.png" alt="" />
          <div>&#x8FD4;&#x56DE; <span class="line">|</span> {{ currentPlayData.sectionName }}</div>
        </div>
      </div>
      <div class="videoCont">
        <div class="video demoVideo" v-show="pageType === 1">
          <video v-if="!isDemoMode" id="videoRef" ref="videoRef"></video>
          <div v-else class="demoPlayer">
            <div class="demoTag">A3 &#x6F14;&#x793A;&#x6A21;&#x5F0F;</div>
            <div class="demoTitle">{{ currentPlayData.sectionName }}</div>
            <div class="demoDesc">
              &#x5F53;&#x524D;&#x5B66;&#x4E60;&#x9875;&#x5DF2;&#x5207;&#x6362;&#x4E3A;&#x672C;&#x5730;&#x6F14;&#x793A;&#x6570;&#x636E;&#xFF0C;&#x4E0D;&#x4F9D;&#x8D56;&#x5916;&#x90E8;&#x89C6;&#x9891;&#x7B7E;&#x540D;&#x4E5F;&#x80FD;&#x7EE7;&#x7EED;&#x9A8C;&#x6536;&#x76EE;&#x5F55;&#x3001;&#x7EC3;&#x4E60;&#x3001;&#x95EE;&#x7B54;&#x548C;&#x7B14;&#x8BB0;&#x6D41;&#x7A0B;&#x3002;
            </div>
          </div>
        </div>
        <Practise
          v-if="pageType === 2"
          :key="currentPlayData.sectionId"
          :examInfo="examInfo"
          @playHadle="playHadle"
        />
      </div>
    </div>
    <div class="learn" :class="{ close: isClose }">
      <div class="closeRt cur-pt" :class="{ close: isClose }" @click="close">
        <i class="iconfont zhy-a-shouqi2x"></i>
      </div>
      <div class="teachInfo fx">
        <img
          :src="learningClassDetails?.coverUrl"
          alt=""
          @click="router.push({ path: '/details', query: { id: learningClassDetails?.id } })"
        />
        <div>
          <div class="tit">{{ learningClassDetails?.name }}</div>
          <div class="teacher ft-14">&#x8BB2;&#x5E08; : {{ learningClassDetails?.teacherName }}</div>
        </div>
      </div>
      <div class="cont">
        <div class="pd-lr-10">
          <TableSwitchBar :data="tableBar" @changeTable="changeTable" />
        </div>
        <div v-show="actId === 1" class="catalogue" v-infinite-scroll="load" style="overflow: auto">
          <Catalogue
            :data="chapters"
            :finished="finished"
            :playId="playId"
            @openCatalogue="openCatalogue"
            @playHadle="playHadle"
          />
        </div>
        <div v-if="actId === 2" class="question" v-infinite-scroll="load" style="overflow: auto">
          <Question />
        </div>
        <div v-if="actId === 3" class="note" v-infinite-scroll="load" style="overflow: auto">
          <Note :currentTime="currentPlayTime" />
        </div>
      </div>
    </div>
    <div class="askAndNote" :class="{ close: !isClose }" @click="open">
      <div class="fx-cl-ct">
        <img src="../../assets/btn-wd.png" alt="" />
        <p>&#x95EE;&#x7B54;</p>
      </div>
      <div class="fx-cl-ct">
        <img src="../../assets/btn-bj.png" alt="" />
        <p>&#x7B14;&#x8BB0;</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { h, onMounted, onUnmounted, provide, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRoute } from "vue-router";
import icon from "@/assets/icon_good.png";
import { dataCacheStore } from "@/store";
import { getLearningClassDetails, getMediasSignature, addPlayLog } from "@/api/class.js";
import { isPortalDemoMode } from "@/config/demo-learning";
import TableSwitchBar from "./components/TableSwitchBar.vue";
import Catalogue from "./components/Catalogue.vue";
import Question from "./components/Question.vue";
import Practise from "./components/Practise.vue";
import Note from "./components/Note.vue";
import router from "../../router";

const route = useRoute();
const store = dataCacheStore();
// 本地 A3 联调阶段课程目录已切到后端，但视频签名链路尚未完成，先统一回退到演示播放态。
const isDemoMode = isPortalDemoMode() || import.meta.env.MODE === "a3local";

const tableBar = [
  { id: 1, name: "\u76EE\u5F55" },
  { id: 2, name: "\u95EE\u7B54" },
  { id: 3, name: "\u7B14\u8BB0" },
];

const pageType = ref(1);
const detailsId = ref("");
const videoRef = ref(null);
const playId = ref("");
const finished = ref(false);
const fileId = ref("");
const signature = ref("");
const currentPlayTime = ref(0);
const learningClassDetails = ref(null);
const chapters = ref([]);
const sectionMap = ref({});
const player = ref(null);
const examInfo = ref({});
const actId = ref(1);
const isClose = ref(false);

let timer = -1;
let playing = false;

const currentPlayData = reactive({
  courseId: route.query.id,
  lastPlaySectionId: "",
  prevSectionId: "",
  sectionId: "",
  sectionName: "",
  nestSectionId: "",
  moment: 0,
  duration: 0,
  type: "",
  lessonId: "",
  chapterId: "",
});

provide("currentPlayData", currentPlayData);

onMounted(async () => {
  detailsId.value = route.query.id;
  await getLearningClassDetailsData();
  if (isDemoMode) {
    pageType.value = 1;
    currentPlayTime.value = Number(currentPlayData.moment || 0);
    return;
  }
  await getMediasSignatureData(currentPlayData.sectionId);
});

onUnmounted(() => {
  window.clearInterval(timer);
  if (player.value?.dispose) {
    player.value.dispose();
  }
});

const getLearningClassDetailsData = async () => {
  await getLearningClassDetails(detailsId.value)
    .then((res) => {
      if (res.code !== 200 || !res.data) {
        ElMessage({ message: res.msg || "\u5B66\u4E60\u6570\u636E\u52A0\u8F7D\u5931\u8D25", type: "error" });
        return;
      }
      const map = {};
      res.data.chapters.forEach((chapter) => {
        chapter.sections.forEach((section) => {
          map[section.id] = section;
          section.hasTest = !!section.subjectNum;
          section.chapterId = chapter.id;
        });
      });
      sectionMap.value = map;
      let sectionId = route.query.sectionId || res.data.latestSectionId;
      let section = map[sectionId];
      if (!section) {
        section = res.data.chapters[0]?.sections[0];
      }
      learningClassDetails.value = res.data;
      chapters.value = res.data.chapters;
      currentPlayData.duration = Number(section?.mediaDuration || 0);
      currentPlayData.sectionId = section?.id || "";
      currentPlayData.moment = Number(section?.moment ?? res.data.moment ?? 0);
      currentPlayData.sectionName = section?.name || "\u8BFE\u7A0B\u5B66\u4E60";
      currentPlayData.type = section?.type || 2;
      currentPlayData.lessonId = res.data.lessonId || "";
      currentPlayData.chapterId = section?.chapterId || "";
      playId.value = currentPlayData.sectionId;
      store.setCurrentPlayData(currentPlayData);
    })
    .catch(() => {
      ElMessage({ message: "\u5B66\u4E60\u6570\u636E\u8BF7\u6C42\u51FA\u9519", type: "error" });
    });
};

const initPlay = (videoFileId, psign) => {
  if (typeof window.TCPlayer !== "function") {
    ElMessage.warning("\u64AD\u653E\u5668\u672A\u5C31\u7EEA\uFF0C\u5DF2\u4FDD\u7559\u6F14\u793A\u9875\u53EF\u9A8C\u6536\u72B6\u6001");
    return;
  }
  player.value = new window.TCPlayer(videoRef.value, {
    appID: "1312394356",
    fileID: videoFileId,
    psign,
    posterImage: true,
    autoplay: true,
    preload: "auto",
    hlsConfig: {},
  });
  player.value.on("timeupdate", () => {
    currentPlayData.moment = player.value.currentTime();
    currentPlayTime.value = currentPlayData.moment;
  });
  player.value.on("pause", () => {
    window.clearInterval(timer);
    playing = false;
  });
  player.value.on("play", () => {
    if (playing) {
      return;
    }
    playing = true;
    finished.value = false;
    if (!currentPlayData.lessonId) {
      return;
    }
    addPlayLogHandle();
    timer = window.setInterval(addPlayLogHandle, 15000);
  });
  player.value.on("ended", () => {
    window.clearInterval(timer);
    finished.value = true;
  });
  player.value.ready(() => {
    window.clearInterval(timer);
    player.value.currentTime(currentPlayData.moment || 0);
    player.value.play();
  });
};

const addPlayLogHandle = () => {
  const { lessonId, sectionId, moment, duration } = currentPlayData;
  addPlayLog({
    lessonId,
    sectionId,
    moment,
    duration,
    sectionType: 1,
    commitTime: now(),
  }).catch(() => {});
};

const getMediasSignatureData = async (sectionId) => {
  const res = await getMediasSignature({ sectionId });
  if (res.code === 200) {
    fileId.value = res.data.fileId;
    signature.value = res.data.signature;
    if (!player.value) {
      initPlay(res.data.fileId, res.data.signature);
    }
    return true;
  }
  ElMessage({ message: res.msg || "\u89C6\u9891\u52A0\u8F7D\u5931\u8D25", type: "error" });
  return false;
};

const playHadle = async ({ item, tp }) => {
  if (tp === 0) {
    finished.value = false;
    classFinished();
    return;
  }
  currentPlayData.sectionName = item.name;
  currentPlayData.sectionId = item.id;
  currentPlayData.moment = Number(item.moment || 0);
  currentPlayData.duration = Number(item.mediaDuration || 0);
  currentPlayData.type = item.type;
  currentPlayData.chapterId = item.chapterId || currentPlayData.chapterId;
  playId.value = item.id;

  if (tp === "9") {
    pageType.value = 1;
    return;
  }

  if (tp === 1 || tp === "1") {
    pageType.value = 1;
    currentPlayTime.value = Number(currentPlayData.moment || 0);
    if (isDemoMode) {
      store.setCurrentPlayData(currentPlayData);
      return;
    }
    const ready = await getMediasSignatureData(item.id);
    if (!ready || !player.value) {
      return;
    }
    player.value.loadVideoByID({
      appID: "1312394356",
      fileID: fileId.value,
      psign: signature.value,
    });
    player.value.currentTime(currentPlayData.moment);
    player.value.play();
  } else if (tp === 2 || tp === "2" || tp === 3 || tp === "3") {
    if (!isDemoMode && player.value?.pause) {
      player.value.pause();
    }
    if (item.type !== 2 && tp !== 2 && tp !== "2") {
      ElMessageBox.confirm(
        "\u8003\u8BD5\u4EC5\u652F\u6301\u5355\u6B21\u63D0\u4EA4\uFF0C\u786E\u8BA4\u540E\u5C06\u8FDB\u5165\u7B54\u9898\u6D41\u7A0B\u3002",
        "\u786E\u8BA4\u8003\u8BD5",
        {
          confirmButtonText: "\u7EE7\u7EED\u8003\u8BD5",
          cancelButtonText: "\u7A0D\u540E\u518D\u505A",
          type: "warning",
        },
      ).then(() => {
        startExaminationHandle(item);
      });
      return;
    }
    startExaminationHandle(item);
  }
  store.setCurrentPlayData(currentPlayData);
};

const startExaminationHandle = (item) => {
  examInfo.value = {
    sectionId: item.id,
    type: item.type - 1,
    courseId: currentPlayData.courseId,
  };
  pageType.value = 2;
};

const classFinished = () => {
  ElMessageBox({
    title: "",
    message: h("div", null, [
      h("div", { style: "display:flex" }, [
        h("img", { src: icon, style: "width:52px;height:52px;margin-right:10px;" }),
        h("div", null, [
          h("div", { style: "font-size:18px;font-weight:500;" }, "\u4F60\u771F\u68D2\uFF01"),
          h("div", { style: "line-height:30px" }, "\u5F53\u524D\u7AE0\u8282\u5185\u5BB9\u5DF2\u5B8C\u6210\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u4E0B\u4E00\u8282\u6216\u8FD4\u56DE\u4E2A\u4EBA\u4E2D\u5FC3\u67E5\u770B\u8FDB\u5EA6\u3002"),
        ]),
      ]),
    ]),
    showCancelButton: false,
    confirmButtonText: "\u6211\u77E5\u9053\u4E86",
  }).then(() => {
    router.push("/personal/main/myClass");
  });
};

const openCatalogue = (chapterId) => {
  currentPlayData.chapterId = chapterId;
};

const changeTable = (id) => {
  actId.value = id;
};

const close = () => {
  isClose.value = true;
};

const open = () => {
  isClose.value = false;
};

const goBack = () => {
  window.clearInterval(timer);
  timer = 0;
  if (learningClassDetails.value?.id) {
    router.push({ path: "/details", query: { id: learningClassDetails.value.id } });
    return;
  }
  router.push("/main/index");
};

const load = () => {};

const t = (n) => (n < 10 ? `0${n}` : n);
const now = () => {
  const d = new Date();
  return `${d.getFullYear()}-${t(d.getMonth() + 1)}-${t(d.getDate())} ${t(d.getHours())}:${t(d.getMinutes())}:${t(d.getSeconds())}`;
};
</script>

<style lang="scss" src="./index.scss"></style>
<style scoped lang="scss">
.demoVideo {
  .demoPlayer {
    height: 100%;
    min-height: 520px;
    background: linear-gradient(135deg, #101a24 0%, #1f3443 55%, #2f4e62 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 48px;
  }

  .demoTag {
    display: inline-flex;
    width: fit-content;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    font-size: 14px;
    margin-bottom: 18px;
  }

  .demoTitle {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .demoDesc {
    max-width: 520px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.82);
  }
}
</style>
