<template>
  <div class="myInterralWrapper">
    <div class="personalCards">
      <CardsTitle class="marg-bt-20" title="&#x6211;&#x7684;&#x79EF;&#x5206;" />
      <div class="title"></div>
      <Calendar @pointsSign="pointsSignHandle" />
      <div class="listCont fx-sb">
        <div class="list">
          <div class="tit">&#x79EF;&#x5206;&#x83B7;&#x53D6;</div>
          <div class="tab">
            <div v-for="item in access" :key="item.value" class="item fx-sb">
              <span>{{ item.type }}</span>
              <span>{{ item.points }}/{{ item.maxPoints }}</span>
            </div>
          </div>
        </div>
        <div class="listRt">
          <div class="tit fx-sb">
            <span>&#x672C;&#x5B63;&#x79EF;&#x5206;&#x699C;</span>
            <span class="more font-bt" @click="goRanking">&#x66F4;&#x591A;&gt;</span>
          </div>
          <IntegralRankTab :data="seasonsData" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { getSeasons, getTodayPoints, pointsSign } from "@/api/class.js";
import CardsTitle from "./components/CardsTitle.vue";
import Calendar from "./components/Calendar.vue";
import IntegralRankTab from "./components/IntegralRankTab.vue";

const router = useRouter();

const access = ref([
  { value: 1, type: "\u8BFE\u7A0B\u5B66\u4E60", points: 0, maxPoints: 50 },
  { value: 2, type: "\u6BCF\u65E5\u7B7E\u5230", points: 0, maxPoints: 2 },
  { value: 3, type: "\u8BFE\u7A0B\u95EE\u7B54", points: 0, maxPoints: 20 },
  { value: 4, type: "\u8BFE\u7A0B\u7B14\u8BB0", points: 0, maxPoints: 20 },
  { value: 5, type: "\u8BFE\u7A0B\u8BC4\u4EF7", points: 0, maxPoints: 999 },
]);

const seasonsData = ref([]);

onMounted(async () => {
  getSeasonsData();
  getTodayPointsHandle();
});

const goRanking = () => {
  router.push({
    path: "/personal/main/myIntegralRanking",
    query: {
      rank: seasonsData.value?.rank,
      points: seasonsData.value?.points,
    },
  });
};

const getSeasonsData = () => {
  getSeasons({ season: 0, pageNo: 1, pageSize: 10 })
    .then((res) => {
      if (res.code === 200) {
        seasonsData.value = res.data;
      } else {
        ElMessage({
          message: res.msg,
          type: "error",
        });
      }
    })
    .catch(() => {
      ElMessage({
        message: "\u79EF\u5206\u699C\u52A0\u8F7D\u5931\u8D25",
        type: "error",
      });
    });
};

const getTodayPointsHandle = async () => {
  await getTodayPoints()
    .then((res) => {
      if (res.code === 200) {
        access.value.forEach((item) => {
          res.data.forEach((val) => {
            if (val.type === item.type) {
              item.points = val.points;
            }
          });
        });
      } else {
        ElMessage({
          message: res.msg,
          type: "error",
        });
      }
    })
    .catch(() => {
      ElMessage({
        message: "\u4ECA\u65E5\u79EF\u5206\u8BB0\u5F55\u52A0\u8F7D\u5931\u8D25",
        type: "error",
      });
    });
};

const pointsSignHandle = async () => {
  await pointsSign()
    .then((res) => {
      if (res.code === 200) {
        ElMessage({
          message: "\u7B7E\u5230\u6210\u529F",
          type: "success",
        });
        getTodayPointsHandle();
      } else {
        ElMessage({
          message: res.msg,
          type: "error",
        });
      }
    })
    .catch(() => {
      ElMessage({
        message: "\u7B7E\u5230\u5931\u8D25",
        type: "error",
      });
    });
};
</script>

<style lang="scss" src="./index.scss"></style>
