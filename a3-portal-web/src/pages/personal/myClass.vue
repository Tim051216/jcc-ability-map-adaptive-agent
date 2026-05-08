<template>
  <div class="myClassWrapper">
    <div>
      <div v-if="learningData && typeof learningData !== 'string'" class="personalCards">
        <CardsTitle class="marg-bt-20" title="&#x6700;&#x8FD1;&#x5B66;&#x4E60;" />
        <ClassCards :data="learningData" type="1" />
      </div>

      <div v-if="planData && typeof planData !== 'string'" class="personalCards">
        <CardsTitle title="&#x5B66;&#x4E60;&#x8BA1;&#x5212;">
          <div class="ft-wt-400">
            <span class="marg-rt-20">
              &#x672C;&#x5468;&#x8BA1;&#x5212;&#xFF1A;<em>{{ weekFinishedAmount || 0 }}</em> / {{ weekPlanAmount || 0 }}
            </span>
            <span>&#x672C;&#x5468;&#x79EF;&#x5206;&#xFF1A;<em>{{ totalPoints || 0 }}</em></span>
          </div>
        </CardsTitle>
        <PlanTable :data="planData" />
      </div>

      <div v-if="myClassData && myClassData.length > 0" id="allClass">
        <div class="personalCards">
          <CardsTitle class="marg-bt-20" title="&#x5168;&#x90E8;&#x8BFE;&#x7A0B;" />
          <div
            v-for="item in myClassData"
            :key="item.courseId"
            class="item marg-bt-20"
          >
            <ClassCards :data="item" type="2" @planHandle="planHandle" />
          </div>
        </div>
        <div v-if="count > 10" class="fx-ct ft-18 ft-wt-600">&#x67E5;&#x770B;&#x66F4;&#x591A;</div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="title" width="30%">
      <div class="dialogCont">
        <div class="fx marg-bt-20">
          <span>&#x6BCF;&#x5468;&#x5B66;&#x4E60;&#x8282;&#x6570;&#xFF1A;</span>
          <el-input v-model="number" min="1" type="number" @input="planDayHandle" />
        </div>
        <div class="fx">
          <span>&#x9884;&#x8BA1;&#x5B8C;&#x6210;&#x65F6;&#x95F4;&#xFF1A;</span>
          <div class="lastTime">{{ lastTime }}</div>
        </div>
      </div>
      <template #footer>
        <span class="dialogFooter">
          <div @click="dialogVisible = false">
            <span class="bt bt-grey">&#x53D6;&#x6D88;</span>
          </div>
          <div @click="createPlan">
            <span class="bt">&#x786E;&#x5B9A;</span>
          </div>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import moment from "moment";
import { ElMessage } from "element-plus";
import { creatPlans, delMyClass, getMyLearning, getMylessons, getMyPlan } from "@/api/class.js";
import { dataCacheStore } from "@/store";
import CardsTitle from "./components/CardsTitle.vue";
import ClassCards from "./components/ClassCards.vue";
import PlanTable from "./components/PlanTable.vue";

const store = dataCacheStore();

const learningData = ref(null);
const planData = ref([]);
const weekFinishedAmount = ref(0);
const totalPoints = ref(0);
const weekPlanAmount = ref(0);
const myClassData = ref([]);
const count = ref(0);

const days = ref(0);
const number = ref(1);
const dialogVisible = ref(false);
const title = ref("\u521B\u5EFA\u8BA1\u5212");
const currentData = ref(null);

onMounted(() => {
  getLearningData();
  getMylessonsData();
  getPlanData();
});

const lastTime = computed(() => {
  const totalDays = Math.ceil(days.value / number.value) * 7;
  return number.value ? moment().add(totalDays, "days").format("YYYY-MM-DD") : "";
});

const getLearningData = async () => {
  try {
    const res = await getMyLearning();
    if (res.code === 200 && res.data != null) {
      learningData.value = res.data;
      store.setMyLearnClassInfo(res.data);
      return;
    }
    ElMessage({
      message: res.msg || "\u6700\u8FD1\u5B66\u4E60\u6570\u636E\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u6700\u8FD1\u5B66\u4E60\u6570\u636E\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  }
};

const getPlanData = async () => {
  try {
    const res = await getMyPlan({
      page: 1,
      pageSize: 10,
    });
    if (res.code === 200 && res.data != null) {
      planData.value = res.data.list || [];
      weekFinishedAmount.value = res.data.weekFinished || 0;
      totalPoints.value = res.data.weekPoints || 0;
      weekPlanAmount.value = res.data.weekTotalPlan || 0;
      return;
    }
    ElMessage({
      message: res.msg || "\u5B66\u4E60\u8BA1\u5212\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u5B66\u4E60\u8BA1\u5212\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  }
};

const getMylessonsData = async () => {
  try {
    const res = await getMylessons({
      page: 1,
      pageSize: 10,
    });
    if (res.code === 200 && res.data != null) {
      myClassData.value = res.data.list || [];
      count.value = Number(res.data.total || 0);
      return;
    }
    ElMessage({
      message: res.msg || "\u8BFE\u7A0B\u5217\u8868\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u8BFE\u7A0B\u5217\u8868\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  }
};

const planDayHandle = (val) => {
  if (val !== "" && Number(val) < 1) {
    number.value = 1;
  } else if (val !== "" && Number(val) > 50) {
    number.value = 50;
  }
};

const planHandle = ({ data, type }) => {
  dialogVisible.value = true;
  currentData.value = data;

  if (type === "edit") {
    number.value = data.weekFreq || 1;
    days.value = data.sections || 0;
    title.value = "\u4FEE\u6539\u8BA1\u5212";
    return;
  }

  if (type === "add") {
    number.value = 1;
    days.value = data.sections || 0;
    title.value = "\u521B\u5EFA\u8BA1\u5212";
    return;
  }

  if (type === "del") {
    dialogVisible.value = false;
    delMyClassData(data.course.id);
  }
};

const createPlan = async () => {
  try {
    const res = await creatPlans({
      freq: number.value,
      courseId: currentData.value?.courseId || "",
    });
    if (res.code === 200) {
      getPlanData();
      ElMessage({
        message: `${title.value}\u6210\u529F`,
        type: "success",
      });
      dialogVisible.value = false;
      return;
    }
    ElMessage({
      message: res.msg || `${title.value}\u5931\u8D25`,
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u5B66\u4E60\u8BA1\u5212\u4FDD\u5B58\u5931\u8D25",
      type: "error",
    });
  }
};

const delMyClassData = async (id) => {
  try {
    const res = await delMyClass(id);
    if (res.code === 200) {
      getMylessonsData();
      ElMessage({
        message: "\u8BFE\u7A0B\u5DF2\u79FB\u9664",
        type: "success",
      });
      return;
    }
    ElMessage({
      message: res.msg || "\u8BFE\u7A0B\u79FB\u9664\u5931\u8D25",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u8BFE\u7A0B\u79FB\u9664\u5931\u8D25",
      type: "error",
    });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
