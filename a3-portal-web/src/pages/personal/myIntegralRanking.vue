<template>
  <div class="myInterralRankingWrapper">
    <div class="personalCards">
      <BreadCrumb />
      <CardsTitle class="marg-bt-20" title="&#x5B66;&#x4E60;&#x79EF;&#x5206;&#x699C;" />
      <div class="listCont fx-sb">
        <div class="listRt">
          <div class="tit">&#x5F53;&#x524D;&#x8D5B;&#x5B63;</div>
          <IntegralRankTab :data="currentSeasonsData" />
        </div>
        <div class="listRt">
          <div class="tit fx-sb">
            <span>&#x5386;&#x53F2;&#x699C;&#x5355;</span>
            <div>
              <el-select v-model="season" class="m-2" placeholder="&#x8BF7;&#x9009;&#x62E9;&#x8D5B;&#x5B63;" @change="selectHandle">
                <el-option
                  v-for="item in seasonOptions"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </div>
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
import { getSeasons, getSelectOptions } from "@/api/class.js";
import CardsTitle from "./components/CardsTitle.vue";
import BreadCrumb from "./components/BreadCrumb.vue";
import IntegralRankTab from "./components/IntegralRankTab.vue";

const currentSeasonsData = ref([]);
const seasonsData = ref([]);
const season = ref(0);
const seasonOptions = ref([]);

onMounted(async () => {
  getHistorySeasonsData();
  await getSeasonsData(0);
});

const getSeasonsData = async (seasonId) => {
  try {
    const res = await getSeasons({ season: seasonId, pageNo: 1, pageSize: 10 });
    if (res.code === 200) {
      if (seasonId === 0) {
        currentSeasonsData.value = res.data;
        seasonsData.value = res.data;
      } else {
        seasonsData.value = res.data;
      }
      return;
    }
    ElMessage({
      message: res.msg || "\u79EF\u5206\u699C\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u79EF\u5206\u699C\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  }
};

const getHistorySeasonsData = async () => {
  try {
    const res = await getSelectOptions();
    if (res.code === 200) {
      const list = res.data || [];
      if (list.length > 0) {
        list[list.length - 1].id = 0;
      }
      seasonOptions.value = list;
      return;
    }
    ElMessage({
      message: res.msg || "\u8D5B\u5B63\u5217\u8868\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "\u8D5B\u5B63\u5217\u8868\u52A0\u8F7D\u5931\u8D25",
      type: "error",
    });
  }
};

const selectHandle = (val) => {
  getSeasonsData(val);
};
</script>

<style lang="scss" src="./index.scss"></style>
