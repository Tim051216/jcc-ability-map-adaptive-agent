<template>
  <div class="classCards fx-1">
    <el-table class="table" :data="data">
      <el-table-column prop="courseName" center label="&#x8BFE;&#x7A0B;">
        <template #default="scope">
          <div>{{ scope.row.courseName }}</div>
        </template>
      </el-table-column>
      <el-table-column center prop="sectionName" label="&#x7AE0;&#x8282;" align="center" min-width="160" />
      <el-table-column prop="commitTime" align="center" label="&#x63D0;&#x4EA4;&#x65F6;&#x95F4;" width="180">
        <template #default="scope">
          <span>{{ scope.row.commitTime || "--" }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="commitTime" align="center" label="&#x7C7B;&#x578B;" width="100">
        <template #default="scope">
          <span>{{ scope.row.type == 0 ? "&#x7EC3;&#x4E60;" : "&#x8003;&#x8BD5;" }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="score" align="center" label="&#x5206;&#x6570;" width="60">
        <template #default="scope">
          <span>{{ scope.row.score || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="&#x64CD;&#x4F5C;" align="center" width="100">
        <template #default="scope">
          <div class="font-bt1" @click="goDetail(scope.row)">&#x67E5;&#x770B;</div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";

defineProps({
  data: {
    type: Array,
    default: () => [],
  },
});

const router = useRouter();

const goDetail = (row) => {
  router.push({ path: "myExamDetails", query: row });
};
</script>

<style lang="scss" scoped>
.classCards {
  margin-top: 20px;
  line-height: 30px;

  .table {
    border: solid 1px #ebeef5;
    border-bottom: none;
  }
}
</style>
