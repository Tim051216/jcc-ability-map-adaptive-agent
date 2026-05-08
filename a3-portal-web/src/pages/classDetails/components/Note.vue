<template>
  <div class="note bg-wt marg-bt-20">
    <div class="tabLab fx-sb">
      <div class="lable">
        <span class="marg-rt-20" :class="{ act: askType === 'all' }" @click="askCheck('all')">全部笔记</span>
        <span :class="{ act: askType === 'my' }" @click="askCheck('my')">我的笔记</span>
      </div>
    </div>

    <AskChapterItems :data="chapterData" @checkCahpter="checkCahpter" />

    <div class="askCont">
      <div v-for="item in askListsDataes" :key="item.id" class="askLists">
        <div class="userInfo fx">
          <img :src="item.authorIcon" alt="" />
          {{ item.authorName }}
        </div>
        <div class="ask">
          <div class="ft-16">{{ item.content }}</div>
        </div>
        <div class="time fx-sb">
          <div>{{ item.createTime }}</div>
          <div class="actBut">
            <span v-if="userInfo?.id == item.authorId" class="marg-rt-20" @click="delNoteHandle(item.id)">
              <i class="iconfont zhy-a-btn_delete_nor2x"></i>
              删除
            </span>
            <span
              v-if="userInfo?.id != item.authorId"
              class="marg-rt-20"
              :class="{ activeLiked: false }"
              @click="gathersHandle(item)"
            >
              <i class="iconfont zhy-a-btn_caiji_nor2x"></i>
              {{ item.isGathered ? "已采集" : "采集" }}
            </span>
            <span :class="{ activeLiked: item.liked }" @click="likedHandle(item)">
              <i class="iconfont zhy-a-btn_zan_nor2x"></i>
              点赞 {{ item.likedTimes || 0 }}
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
import { useRoute } from "vue-router";
import { getClassChapter } from "@/api/classDetails.js";
import { delNote, getAllNotes, notesGathers, unNotesGathers } from "@/api/notes.js";
import AskChapterItems from "../../../components/AskChapterItems.vue";
import { isLogin, useUserStore } from "@/store";

const route = useRoute();
const store = useUserStore();

defineProps({
  id: {
    type: String,
    default: "",
  },
});

const userInfo = ref();
const askListsDataes = ref([]);
const total = ref(0);
const askType = ref("all");
const chapterData = ref([]);
const params = ref({
  admin: false,
  isAsc: true,
  pageNo: 1,
  pageSize: 10,
  sectionId: "",
  courseId: route.query.id,
  sortBy: "",
  onlyMine: false,
});

onMounted(() => {
  userInfo.value = store.getUserInfo;
  if (isLogin()) {
    getClassChapterData(route.query.id);
    getAskListsDataes();
  }
});

const askCheck = (type) => {
  params.value.pageNo = 1;
  params.value.pageSize = 10;
  params.value.onlyMine = type === "my";
  askType.value = type;
  getAskListsDataes();
};

const checkCahpter = (id) => {
  params.value.pageNo = 1;
  params.value.pageSize = 100;
  params.value.sectionId = id;
  getAskListsDataes();
};

const getAskListsDataes = async () => {
  if (params.value.sectionId === "all") {
    params.value.sectionId = undefined;
  }
  try {
    const res = await getAllNotes(params.value);
    if (res.code === 200) {
      askListsDataes.value = res.data.list || [];
      total.value = Number(res.data.total || 0);
      return;
    }
    ElMessage({ message: res.msg || "笔记列表加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "笔记列表加载失败", type: "error" });
  }
};

const delNoteHandle = async (id) => {
  try {
    const res = await delNote(id);
    if (res.code === 200) {
      ElMessage({ message: "笔记已删除", type: "success" });
      getAskListsDataes();
      return;
    }
    ElMessage({ message: res.msg || "删除笔记失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "删除笔记失败", type: "error" });
  }
};

const gathersHandle = async (item) => {
  if (item.isGathered) {
    await unNotesGathersData(item);
  } else {
    await notesGathersData(item);
  }
};

const notesGathersData = async (item) => {
  try {
    const res = await notesGathers(item.id);
    if (res.code === 200) {
      item.isGathered = !item.isGathered;
      getAskListsDataes();
      return;
    }
    ElMessage({ message: res.msg || "采集笔记失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "采集笔记失败", type: "error" });
  }
};

const unNotesGathersData = async (item) => {
  try {
    const res = await unNotesGathers(item.id);
    if (res.code === 200) {
      item.isGathered = !item.isGathered;
      return;
    }
    ElMessage({ message: res.msg || "取消采集失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "取消采集失败", type: "error" });
  }
};

const getClassChapterData = async (id) => {
  try {
    const res = await getClassChapter(id);
    if (res.code === 200) {
      chapterData.value = [{ id: "all", index: "全部" }, ...(res.data || [])];
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

const likedHandle = (item) => {
  item.liked = !item.liked;
};
</script>

<style lang="scss" scoped>
.note {
  padding-top: 30px;

  .tabLab {
    margin-bottom: 20px;

    .lable {
      display: flex;
      align-items: center;

      span {
        display: inline-block;
        width: 96px;
        text-align: center;
        cursor: pointer;
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

          .btnIcon {
            width: 21px;
            height: 21px;
            position: relative;
            top: 5px;
          }
        }
      }
    }
  }

  .activeLiked {
    color: var(--color-main);
  }

  .pagination {
    padding-top: 40px;
    text-align: center;
  }
}
</style>
