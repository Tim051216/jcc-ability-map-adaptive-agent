<template>
  <div class="myExamDetails">
    <BreadCrumb />
    <div class="examHeadle">
      <div class="tit">&#x8003;&#x8BD5;&#x56DE;&#x987E;</div>
      <div class="table">
        <div class="fx-sb">
          <div class="td fx-1">
            <div class="marg-bt-10 ft-wt-600 ft-cl-1">&#x6240;&#x5C5E;&#x8BFE;&#x7A0B;</div>
            <div>{{ $route.query.courseName }}</div>
          </div>
          <div class="td fx-1">
            <div class="marg-bt-10 ft-wt-600 ft-cl-1">&#x6D4B;&#x8BD5;&#x540D;&#x79F0;</div>
            <div>{{ $route.query.sectionName }}</div>
          </div>
          <div class="td fx-1">
            <div class="marg-bt-10 ft-wt-600 ft-cl-1">&#x5B66;&#x5458;&#x540D;&#x79F0;</div>
            <div>{{ store.getUserInfo.name }}</div>
          </div>
        </div>
        <div class="fx-sb">
          <div class="td fx-1">
            <div class="marg-bt-10 ft-wt-600 ft-cl-1">&#x7528;&#x65F6;</div>
            <div>{{ $route.query.duration ? timeFormat($route.query.duration) : "00 : 00 : 00" }}</div>
          </div>
          <div class="td fx-1">
            <div class="marg-bt-10 ft-wt-600 ft-cl-1">&#x63D0;&#x4EA4;&#x65F6;&#x95F4;</div>
            <div>{{ $route.query.commitTime }}</div>
          </div>
          <div class="td fx-1">
            <div class="marg-bt-10 ft-wt-600 ft-cl-1">&#x603B;&#x5F97;&#x5206;</div>
            <div>{{ $route.query.score || 0 }} / {{ total }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="myExamDetails" class="answerCardTitle">&#x7B54;&#x9898;&#x5361;</div>
    <div class="answerCards">
      <span
        v-for="(item, index) in myExamDetails"
        :key="index"
        :class="{ right: item.correct, wrong: !item.correct && item.answer !== '' }"
      >
        {{ index + 1 }}
      </span>
    </div>

    <div class="examCont">
      <div v-for="(item, index) in myExamDetails" :key="index" class="item">
        <div class="examTitle">
          <div>
            <img v-if="item.correct" src="@/assets/icon_right.png" alt="" />
            <img v-else src="@/assets/icon_wrong.png" alt="" />
          </div>
          <div class="quest fx">
            {{ index + 1 }}.
            <span v-html="item.question.name"></span>
          </div>
        </div>
        <div class="answer">
          <li v-for="(option, optionIndex) in item.question.options" :key="optionIndex">
            <span v-html="option"></span>
          </li>
        </div>
        <div class="analysis">
          <div class="fx marg-bt-20">
            <div class="col ft-wt-600">&#x4F60;&#x7684;&#x7B54;&#x6848;&#xFF1A;{{ answerChange(item.question.type, item.answer) }}</div>
            <div class="col rt ft-wt-600">&#x6B63;&#x786E;&#x7B54;&#x6848;&#xFF1A;{{ answerChange(item.question.type, item.question.answer) }}</div>
            <div class="col">&#x96BE;&#x5EA6;&#xFF1A;{{ difficultyChange(item.question.difficulty) }}</div>
            <div>&#x5F97;&#x5206;&#xFF1A;{{ item.score }}</div>
          </div>
          <div v-if="item.question.analysis" class="fx">
            &#x7B54;&#x6848;&#x89E3;&#x6790;&#xFF1A;<span v-html="item.question.analysis"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import { getExamDetails } from "@/api/class.js";
import { upperAlpha, timeFormat } from "@/utils/tool.js";
import { useUserStore } from "@/store";
import BreadCrumb from "./components/BreadCrumb.vue";

const store = useUserStore();
const route = useRoute();

const total = ref(0);
const myExamDetails = ref([]);

onMounted(() => {
  getExamDetailsData();
});

const getExamDetailsData = async () => {
  try {
    const res = await getExamDetails(route.query.id);
    if (res.code === 200 && res.data != null) {
      myExamDetails.value = res.data;
      total.value = 0;
      res.data.forEach((item) => {
        total.value += item.question.score;
      });
      return;
    }
    ElMessage({
      message: res.msg || "\u8003\u8BD5\u8BB0\u5F55\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u8003\u8BD5\u8BB0\u5F55\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  }
};

const answerChange = (type, val) => {
  switch (parseInt(type, 10)) {
    case 1:
      return Number.isNaN(Number(val)) ? val : upperAlpha(Number(val));
    case 2:
    case 3: {
      const arr = typeof val === "string" ? val.split(",") : val;
      return arr.map((item) => (Number.isNaN(Number(item)) ? item : upperAlpha(Number(item)))).join(",");
    }
    case 4:
      return val ? "\u6B63\u786E" : "\u9519\u8BEF";
    case 5:
      return val;
    default:
      return val;
  }
};

const difficultyChange = (item) => (item === 1 ? "\u7B80\u5355" : item === 2 ? "\u4E2D\u7B49" : "\u56F0\u96BE");
</script>

<style lang="scss" src="./index.scss"></style>
