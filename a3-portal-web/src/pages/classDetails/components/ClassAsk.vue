<template>
  <div class="classAsk bg-wt marg-bt-20">
    <div class="tabLab fx-sb">
      <div class="lable">
        <span
          class="marg-rt-20"
          :class="{ act: !params.onlyMine, 'bt-grey2': params.onlyMine }"
          @click="askCheck(false)"
        >
          全部问答
        </span>
        <span
          :class="{ act: params.onlyMine, 'bt-grey2': !params.onlyMine }"
          @click="askCheck(true)"
        >
          我的问答
        </span>
      </div>
      <div class="ask">
        <span
          class="bt bt-round ft-14"
          @click="() => $router.push({ path: '/ask', query: { id: $props.id, title: $props.title } })"
        >
          去提问
        </span>
      </div>
    </div>

    <AskChapterItems :data="chapterData" @checkCahpter="checkCahpter" />

    <div class="askCont">
      <div v-for="item in askListsDataes" :key="item.id" class="askLists">
        <div class="userInfo fx">
          <img v-if="item.userIcon" :src="item.userIcon" alt="" />
          <img v-else src="/src/assets/anonymity.png" alt="" />
          {{ item.userName || "匿名用户" }}
        </div>
        <div class="ask">
          <div class="ft-16">{{ item.title }}</div>
          <div v-if="item.latestReplyContent" class="font-bt2" @click="goDetails(item)">
            最新回复来自“{{ item.latestReplyUser }}”
          </div>
        </div>
        <div class="time fx-sb">
          <div>{{ item.createTime }}</div>
          <div class="actBut">
            <span
              v-if="userInfo?.id == item.userId"
              class="font-bt2 marg-rt-20"
              @click="() => $router.push({ path: '/ask', query: { id: $props.id, queryId: item.id, type: 'edit', title: item.title } })"
            >
              <i class="iconfont zhy-a-icon_kaoshi2x"></i>
              编辑
            </span>
            <span
              v-if="userInfo?.id == item.userId"
              class="font-bt2 marg-rt-20"
              @click="delQuestionsHandle(item.id)"
            >
              <i class="iconfont zhy-a-btn_delete_nor2x"></i>
              删除
            </span>
            <span class="font-bt2" @click="goDetails(item)">
              <i class="iconfont zhy-a-btn_pinglun_nor2x"></i>
              回复 {{ item.answerTimes }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="total > 10" class="pagination fx-ct">
        <el-pagination
          v-model:currentPage="params.pageNo"
          v-model:page-size="params.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          background
          layout="total, prev, pager, next, sizes, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { delQuestions, getAskList, getClassChapter } from "@/api/classDetails.js";
import AskChapterItems from "../../../components/AskChapterItems.vue";
import { dataCacheStore, isLogin, useUserStore } from "@/store";

const route = useRoute();
const router = useRouter();
const store = useUserStore();
const dataCache = dataCacheStore();

defineProps({
  id: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "",
  },
});

const userInfo = ref();
const askListsDataes = ref([]);
const total = ref(0);
const chapterData = ref([]);
const params = ref({
  courseId: route.query.id,
  isAsc: true,
  pageNo: 1,
  pageSize: 10,
  sectionId: "",
  sortBy: "",
  onlyMine: false,
});

onMounted(() => {
  if (isLogin()) {
    userInfo.value = store.getUserInfo;
    getClassChapterData(route.query.id);
    getAskListsDataes();
  }
});

const askCheck = (onlyMine) => {
  params.value.pageNo = 1;
  params.value.pageSize = 10;
  params.value.onlyMine = onlyMine;
  getAskListsDataes();
};

const checkCahpter = (id) => {
  params.value.pageNo = 1;
  params.value.pageSize = 10;
  params.value.sectionId = id;
  getAskListsDataes();
};

const getAskListsDataes = async () => {
  try {
    const res = await getAskList(params.value);
    if (res.code === 200) {
      askListsDataes.value = res.data.list || [];
      total.value = Number(res.data.total || 0);
      return;
    }
    ElMessage({ message: res.msg || "问答列表加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "问答列表加载失败", type: "error" });
  }
};

const delQuestionsHandle = async (id) => {
  try {
    const res = await delQuestions(id);
    if (res.code === 200) {
      ElMessage({ message: "问题已删除", type: "success" });
      getAskListsDataes();
      return;
    }
    ElMessage({ message: res.msg || "删除问题失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "删除问题失败", type: "error" });
  }
};

const goDetails = (item) => {
  dataCache.setAskDetails(item);
  router.push({ path: "/askDetails", query: { id: item.id, detailsId: route.query.id, name: item.title } });
};

const getClassChapterData = async (id) => {
  try {
    const res = await getClassChapter(id);
    if (res.code === 200) {
      chapterData.value = [{ id: "", index: "全部" }, ...(res.data || [])];
      return;
    }
    ElMessage({ message: res.msg || "章节列表加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "章节列表加载失败", type: "error" });
  }
};

const handleSizeChange = (val) => {
  params.value.pageSize = val;
  getAskListsDataes();
};

const handleCurrentChange = (val) => {
  params.value.pageNo = val;
  getAskListsDataes();
};
</script>

<style lang="scss" scoped>
.classAsk {
  padding-top: 30px;

  .tabLab {
    margin-bottom: 20px;

    .lable {
      display: flex;
      align-items: center;

      span {
        display: inline-block;
        padding: 5px 20px;
        border-radius: 20px;
        font-size: 16px;
        text-align: center;
        cursor: pointer;
      }
    }

    .ask {
      width: 103px;
      height: 32px;
      align-items: center;

      span {
        line-height: 30px;
      }
    }

    .act {
      background: #19232b;
      border-radius: 20px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      padding: 5px 20px;
    }
  }

  .askCont {
    padding-top: 20px;

    .askLists {
      line-height: 40px;
      font-size: 14px;

      .userInfo {
        line-height: 26px;
        color: var(--color-font3);

        img {
          width: 26px;
          height: 26px;
          border-radius: 26px;
          margin-right: 10px;
        }
      }

      .ask {
        padding-left: 36px;
      }

      .time {
        color: var(--color-font3);
        width: calc(100% - 36px);
        margin-left: 36px;
        padding-bottom: 20px;
        border-bottom: 1px solid #eeeeee;
        margin-bottom: 20px;

        .actBut {
          color: #19232b;
          cursor: pointer;

          .iconfont {
            position: relative;
            font-size: 20px;
            top: 2px;
          }
        }
      }
    }
  }

  .pagination {
    padding-top: 40px;
    text-align: center;
  }
}
</style>
