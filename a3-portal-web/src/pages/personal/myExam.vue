<template>
  <div class="myExamWrapper">
    <div v-if="myExamData != null" class="personalCards">
      <CardsTitle class="marg-bt-20" title="&#x6211;&#x7684;&#x8003;&#x8BD5;" />
      <div v-if="count === 0" class="nodata">
        <Empty />
      </div>
      <ExamTable v-if="count > 0" :data="myExamData" />
      <div v-if="count > 0" class="pageination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="count"
          class="mt-4"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getExamList } from "@/api/class.js";
import CardsTitle from "./components/CardsTitle.vue";
import ExamTable from "./components/ExamTable.vue";
import Empty from "@/components/Empty.vue";

const myExamData = ref(null);
const count = ref(0);
const params = reactive({
  pageNo: 1,
  pageSize: 10,
});

onMounted(() => {
  getExamListData();
});

const getExamListData = async () => {
  try {
    const res = await getExamList(params);
    if (res.code === 200 && res.data != null) {
      myExamData.value = res.data.list || [];
      count.value = Number(res.data.total || 0);
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

const handleSizeChange = (val) => {
  params.pageSize = val;
  getExamListData();
};

const handleCurrentChange = (val) => {
  params.pageNo = val;
  getExamListData();
};
</script>

<style lang="scss" src="./index.scss"></style>
