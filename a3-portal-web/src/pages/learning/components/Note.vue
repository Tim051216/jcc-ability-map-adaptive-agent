<template>
  <div class="learnNoteWrapper">
    <div class="tabCheck">
      <span class="fx-1 cur-pt" :class="{ act: actIndex == 1 }" @click="activeHandle(1)">我的笔记</span>
      <span class="line"></span>
      <span class="fx-1 cur-pt" :class="{ act: actIndex == 2 }" @click="activeHandle(2)">全部笔记</span>
    </div>
    <div v-if="noteListsDataes.length > 0" class="noteCont">
      <div v-for="item in noteListsDataes" :key="item.id" class="noteLists">
        <div class="userInfo fx-sb">
          <div class="fx ft-cl-wt">
            <img :src="item.authorIcon" alt="" srcset="" />
            {{ item.authorName }}
          </div>
          <div>
            <i class="iconfont zhy-a-icon-sp22x"></i>
            {{ item.noteMoment == 0 ? "00:00" : Math.trunc(item.noteMoment / 60) + ":" + (item.noteMoment % 60) }}
          </div>
        </div>
        <div class="note">
          <div class="tit ft-14">{{ item.content }}</div>
        </div>
        <div class="time fx-sb">
          <div class="tm">{{ item.createTime }}</div>
          <div class="actBut">
            <span v-if="userInfo.id == item.authorId" class="marg-rt-10" @click="editNoteHandle(item)">
              <i class="iconfont zhy-a-icon-xiugai22x"></i> 编辑
            </span>
            <span v-if="userInfo.id != item.authorId" :class="{ activeLiked: false && item.isGathered }" @click="gathersHandle(item)">
              <i class="iconfont zhy-a-ico-caiji2x"></i> {{ item.isGathered ? "已采集" : "采集" }}
            </span>
            <span v-if="userInfo.id == item.authorId" @click="delNoteHandle(item)">
              <i class="iconfont zhy-a-icon-delete22x" style="font-size: 23px; top: 3px;"></i> 删除
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="noData">
      <Empty :type="true"></Empty>
    </div>
    <div class="questCont">
      <el-input
        v-model="noteParams.content"
        maxlength="500"
        placeholder="请输入笔记内容"
        resize="none"
        rows="4"
        show-word-limit
        type="textarea"
        @input="ruleshandle"
      />
      <div class="fx-sb fx-al-ct" style="margin-top: 12px;">
        <div><el-checkbox v-model="noteParams.isPrivate" label="私密" size="large" /></div>
        <div class="subCont">
          <span class="bt ft-14" :class="{ 'bt-dis': !isSend }" @click="submitForm()">保存</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref, reactive, watchEffect } from "vue";
import { getAllNotes, addNotes, delNote, updateNotes, notesGathers, unNotesGathers } from "@/api/notes.js";
import { ElMessage } from "element-plus";
import { useUserStore, dataCacheStore } from "@/store";
import Empty from "@/components/Empty.vue";

const currentPlayData = dataCacheStore().getCurrentPlayData;
const store = useUserStore();
const userInfo = ref(null);

const props = defineProps({
  id: {
    type: String,
    default: "",
  },
  currentTime: {
    default: 0,
  },
});

const noteParams = reactive({
  isPrivate: false,
  sectionId: currentPlayData.sectionId,
  courseId: currentPlayData.courseId,
  chapterId: currentPlayData.chapterId,
  content: "",
  noteMoment: currentPlayData.currentTime,
});

onMounted(() => {
  userInfo.value = store.getUserInfo;
  getAskListsDataes();
});
const isSend = ref(false);
const actIndex = ref(1);

const activeHandle = (value) => {
  actIndex.value = value;
  params.value.onlyMine = value === 1;
  getAskListsDataes();
};

const noteListsDataes = ref({});
const total = ref(0);
const params = ref({
  admin: false,
  isAsc: false,
  pageNo: 1,
  pageSize: 1000,
  sectionId: currentPlayData.sectionId,
  courseId: currentPlayData.courseId,
  sortBy: "",
  onlyMine: true,
});

const getAskListsDataes = async () => {
  await getAllNotes(params.value).then((res) => {
    if (res.code == 200) {
      if (res.data.list.length > 0) {
        noteListsDataes.value = res.data.list;
      } else {
        noteListsDataes.value = [];
      }
      total.value = Number(res.data.total);
    } else {
      ElMessage({
        message: res.data.msg,
        type: "error",
      });
    }
  });
};

const ruleshandle = () => {
  isSend.value = noteParams.content != "";
};

const gathersHandle = async (item) => {
  item.isGathered ? unNotesGathersData(item) : notesGathersData(item);
};

const notesGathersData = async (item) => {
  await notesGathers(item.id).then((res) => {
    if (res.code == 200) {
      ElMessage({
        message: "笔记采集成功",
        type: "success",
      });
      getAskListsDataes();
      item.isGathered = !item.isGathered;
    } else {
      ElMessage({
        message: res.data.msg,
        type: "error",
      });
    }
  });
};

const unNotesGathersData = async (item) => {
  ElMessage({ message: "该笔记已采集过了" });
  return;
  await unNotesGathers(item.id).then((res) => {
    if (res.code == 200) {
      getAskListsDataes();
      item.isGathered = !item.isGathered;
    } else {
      ElMessage({
        message: res.data.msg,
        type: "error",
      });
    }
  });
};

const delNoteHandle = async (item) => {
  await delNote(item.id)
    .then((res) => {
      if (res.code == 200) {
        ElMessage({
          message: "笔记删除成功",
          type: "success",
        });
        getAskListsDataes();
      } else {
        ElMessage({
          message: res.data.msg,
          type: "error",
        });
      }
    })
    .catch(() => {
      ElMessage({
        message: "笔记请求出错",
        type: "error",
      });
    });
};

const subType = ref("add");
const editParams = ref({});

watchEffect(() => {
  noteParams.noteMoment = props.currentTime;
});

const submitForm = async () => {
  const query = subType.value == "add" ? addNotes : updateNotes;
  let params = noteParams;
  if (subType.value == "edit") {
    editParams.value.content = noteParams.content;
    params = editParams.value;
  } else {
    params.noteMoment = props.currentTime;
  }
  await query(params)
    .then((res) => {
      if (res.code == 200) {
        subType.value = "add";
        noteParams.content = "";
        isSend.value = false;
        getAskListsDataes();
      } else {
        ElMessage({
          message: res.data.msg,
          type: "error",
        });
      }
    })
    .catch(() => {
      ElMessage({
        message: "笔记请求出错",
        type: "error",
      });
    });
};

const editNoteHandle = async (item) => {
  noteParams.content = item.content;
  subType.value = "edit";
  editParams.value = {
    id: item.id,
    content: noteParams.content,
    isPrivate: false,
  };
};
</script>
<style lang="scss" scoped>
.learnNoteWrapper {
  .tabCheck {
    margin: 10px auto 20px auto;
    display: flex;
    justify-content: center;
    width: 204px;
    height: 32px;
    line-height: 32px;
    border: 1px solid #a0a9b2;
    color: #a0a9b2;
    border-radius: 16px;
    font-size: 14px;
    text-align: center;

    .line {
      position: relative;
      top: 10px;
      height: 12px;
      width: 1px;
      background-color: #a0a9b2;
    }
  }

  .act {
    color: #fff;
  }

  .noteCont {
    height: calc(100vh - 378px);
    overflow-y: scroll;

    .noteLists {
      line-height: 40px;
      font-size: 14px;

      .userInfo {
        line-height: 20px;
        font-size: 12px;
        color: var(--color-font3);

        img {
          width: 20px;
          height: 20px;
          border-radius: 26px;
          margin-right: 10px;
        }

        i {
          position: relative;
          top: 2px;
          font-size: 18px;
        }
      }

      .note {
        color: #a0a9b2;
        margin-top: 0px;

        .tit {
          line-height: 24px;
          margin-top: 0px;
        }
      }

      .time {
        color: var(--color-font3);
        padding-bottom: 16px;
        margin-bottom: 19px;
        border-bottom: 1px solid #000000;
        line-height: 20px;

        .tm {
          color: var(--color-ft2);
        }

        .actBut {
          color: #a0a9b2;
          cursor: pointer;

          .iconfont {
            position: relative;
            color: #a0a9b2;
            font-size: 20px;
            top: 2px;
          }

          .btnIcon {
            color: #a0a9b2;
            width: 21px;
            height: 21px;
            position: relative;
            top: 5px;
          }
        }
      }
    }
  }

  .noData {
    height: calc(100vh - 488px);
  }

  .questCont {
    position: absolute;
    width: 100%;
    background-color: #292f37;
    bottom: 0;
    left: 0;
    padding: 15px;

    .title {
      margin-bottom: 10px;
    }

    .subCont {
      .bt {
        width: 80px;
        height: 28px;
        line-height: 28px;
      }
    }

    :deep(.el-textarea__inner) {
      color: #fff;
    }
  }

  .activeLiked,
  .activeLiked .iconfont {
    color: var(--color-main) !important;
  }
}
</style>
