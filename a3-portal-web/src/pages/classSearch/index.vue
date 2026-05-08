<template>
  <div class="classSearchWrapper">
    <div class="container searchBar">
      <div class="result" v-if="isLogin() && isShow && searchParams.keyword">
        <span class="searchKey">
          关键词：<em>{{ searchParams.keyword }}</em>
          <i class="close iconfont zhy-btn_qingchu1" @click="clearSearchKey"></i>
        </span>
        共找到 <em>{{ count }}</em> 门与 <em>{{ searchParams.keyword }}</em> 相关的课程
      </div>

      <div class="title">全部课程</div>
      <SearchKey :data="searchType" :active="activeId" :key="activeId" @searchKey="searchKey" />
      <SearchKey :data="searchCost" @searchKey="searchKey" />
    </div>

    <div class="searchContain bg-wt">
      <div class="container">
        <div class="fx-sb marg-bt-20">
          <SortBar :data="sortOptions" @sortHandle="sortHandle" />
          <div v-if="count > 0" class="pageAction fx">
            <img
              v-if="page > 1"
              src="@/assets/page_act.png"
              class="iconTurn"
              alt="上一页"
              @click="pagesHandle('reduce')"
            />
            <img v-else src="@/assets/page_act_nor.png" alt="上一页不可用" />
            <span><em>{{ page }}</em> / {{ Math.ceil(count / searchParams.pageSize) }}</span>
            <img
              v-if="page < Math.ceil(count / searchParams.pageSize)"
              src="@/assets/page_act.png"
              alt="下一页"
              @click="pagesHandle('add')"
            />
            <img v-else src="@/assets/page_act_nor.png" class="iconTurn" alt="下一页不可用" />
          </div>
        </div>

        <div v-if="count > 0" class="content fx-wp">
          <ClassCards
            v-for="(item, index) in searchResultData"
            :key="index"
            type="search"
            class="items marg-bt-20"
            :data="item"
          />
        </div>
        <div v-else class="content fx-ct noData">暂无符合条件的课程</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watchEffect } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import { classSeach, getClassCategorys, normalizeCategoryData } from "@/api/class.js";
import { dataCacheStore, isLogin } from "@/store";
import ClassCards from "@/components/ClassCards.vue";
import SearchKey from "./components/SearchKey.vue";
import SortBar from "./components/SortBar.vue";

const dataCache = dataCacheStore();
const route = useRoute();

const searchType = ref({
  subKey: "categoryIdLv1",
  title: "课程分类",
  searchKeys: [{ id: "all", name: "全部" }, ...normalizeCategoryData(dataCache.getCourseClassDataes)],
});
const searchCost = ref({
  subKey: "free",
  title: "付费类型",
  searchKeys: [
    { id: "all", name: "全部" },
    { id: "1", name: "免费" },
    { id: "0", name: "付费" },
  ],
});
const sortOptions = ref([
  { key: "推荐", value: "all" },
  { key: "最新", value: "publishTime" },
  { key: "最热", value: "sold" },
]);
const searchParams = ref({
  keyword: "",
  categoryIdLv1: "",
  categoryIdLv2: "",
  categoryIdLv3: "",
  pageNo: 1,
  pageSize: 12,
});
const searchResultData = ref([]);
const count = ref(0);
const page = ref(1);
const isShow = ref(true);
const fullPath = ref(route.fullPath);
const activeId = ref("all");

onMounted(() => {
  searchParams.value.keyword = dataCache.getSearchKey;
  if (route.query.type) {
    searchParams.value[route.query.type] = route.query.id;
  }
  getClassCategoryData();
  search();
});

onUnmounted(() => {
  dataCache.setSearchKey("");
});

watchEffect(() => {
  if (dataCache.getSearchKey !== "") {
    isShow.value = true;
  }

  if (route.fullPath !== fullPath.value) {
    fullPath.value = route.fullPath;
    searchParams.value.categoryIdLv1 = route.query.type === "categoryIdLv1" ? route.query.id : undefined;
    searchParams.value.categoryIdLv2 = route.query.type === "categoryIdLv2" ? route.query.id : undefined;
    searchParams.value.categoryIdLv3 = route.query.type === "categoryIdLv3" ? route.query.id : undefined;
    activeId.value = route.query.id || "all";
    search();
  }
});

const getClassCategoryData = async () => {
  try {
    const res = await getClassCategorys();
    if (res.code === 200) {
      const cleanCategories = normalizeCategoryData(res.data || []);
      searchType.value.searchKeys = [{ id: "all", name: "全部" }, ...cleanCategories];
      dataCache.setCourseClassDataes(cleanCategories);
      return;
    }
    ElMessage({
      message: res.msg || "分类请求失败",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "分类请求失败",
      type: "error",
    });
  }
};

const clearSearchKey = () => {
  searchParams.value.keyword = "";
  isShow.value = false;
  dataCache.setSearchKey("");
  initPage();
  search();
};

async function searchKey(item) {
  if (!isLogin()) {
    isShow.value = false;
    dataCache.setSearchKey("");
  }

  searchParams.value.categoryIdLv1 = "";
  searchParams.value.categoryIdLv2 = "";
  searchParams.value.categoryIdLv3 = "";

  if (item.key === "free") {
    searchParams.value[item.key] = item.value !== "all" ? Boolean(+item.value) : undefined;
  }
  if (item.key === "categoryIdLv1") {
    searchParams.value[item.key] = item.value !== "all" ? item.value : undefined;
  }

  initPage();
  search();
}

const sortHandle = (item) => {
  searchParams.value.sortBy = item !== "all" ? item : undefined;
  initPage();
  search();
};

const initPage = () => {
  page.value = 1;
  searchParams.value.pageNo = page.value;
};

const pagesHandle = (item) => {
  item === "add" ? page.value++ : page.value--;
  searchParams.value.pageNo = page.value;
  search();
};

async function search() {
  const params = JSON.parse(JSON.stringify({ ...searchParams.value }));
  try {
    const res = await classSeach(params);
    if (res.code === 200) {
      searchResultData.value = res.data.list || [];
      count.value = Number(res.data.total || 0);
      return;
    }
    ElMessage({
      message: res.msg || "课程搜索失败",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "课程搜索失败",
      type: "error",
    });
  }
}

watchEffect(() => {
  if (searchParams.value.keyword !== dataCache.getSearchKey) {
    searchParams.value.keyword = dataCache.getSearchKey;
    initPage();
    search();
  }
});
</script>

<style lang="scss" src="./index.scss"></style>
