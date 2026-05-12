<template>
  <div class="questionWrapper marg-bt-20">
    <div class="askCont">
      <div v-for="item in askListsDataes" :key="item.id" class="askLists">
        <div class="userInfo fx">
          <img :src="item.userIcon" :onerror="onerrorImg(item)" alt="" srcset="" />
          {{ item.userName || "匿名" }}
        </div>
        <div class="ask">
          <div class="tit ft-14">{{ item.title }}</div>
          <div v-if="item.latestAnswer && item.latestAnswer.content" class="font-bt2" @click="goDetails(item)">
            最新：{{ item.latestAnswer.replier.name }} 的回答
          </div>
        </div>
        <div class="time fx-sb">
          <div>{{ item.createTime }}</div>
          <div class="actBut">
            <span class="marg-rt-10" @click="goDetails(item)">回答 {{ item.answerTimes }}</span>
          </div>
        </div>
      </div>
      <div v-if="askListsDataes && askListsDataes.length <= 0" class="noData">
        <Empty :type="true"></Empty>
      </div>
    </div>
    <div class="questCont">
      <el-input v-model.number="quest.title" class="title" maxlength="64" placeholder="请输入标题" show-word-limit @input="ruleshandle" />
      <el-input
        v-model="quest.description"
        maxlength="500"
        placeholder="请输入问题描述"
        resize="none"
        rows="4"
        show-word-limit
        type="textarea"
        @input="ruleshandle"
      />
      <div class="fx-sb fx-al-ct" style="margin-top: 4px;">
        <div><el-checkbox v-model="quest.anonymity" label="匿名提问" size="large" /></div>
        <div class="subCont">
          <span class="bt ft-14" :class="{ 'bt-dis': !isSend }" @click="submitForm()">提问</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import defaultImage from "@/assets/icon.jpeg";
import { ref, onMounted, reactive } from "vue";
import { postQuestions, getAskList } from "@/api/classDetails.js";
import { useUserStore, dataCacheStore, isLogin } from "@/store";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import Empty from "@/components/Empty.vue";

const router = useRouter();
const store = useUserStore();
const dataCache = dataCacheStore();
const currentPlayData = dataCacheStore().getCurrentPlayData;

const onerrorImg = (tag) => {
  tag.userIcon = defaultImage;
};

const userInfo = ref();
onMounted(() => {
  if (isLogin()) {
    userInfo.value = store.getUserInfo;
    getAskListsDataes();
  }
});

const params = ref({
  isAsc: true,
  pageNo: 1,
  pageSize: 1000,
  sectionId: currentPlayData.sectionId,
  sortBy: "",
  onlyMine: false,
});

const isSend = ref(false);
const quest = reactive({
  sectionId: currentPlayData.sectionId,
  courseId: currentPlayData.courseId,
  chapterId: currentPlayData.chapterId,
  title: "",
  anonymity: false,
  description: "",
});

const askListsDataes = ref([]);

const getAskListsDataes = async () => {
  await getAskList(params.value)
    .then((res) => {
      if (res.code == 200) {
        askListsDataes.value = res.data.list;
      }
    })
    .catch(() => {
      ElMessage({
        message: "问答列表数据请求出错",
        type: "error",
      });
    });
};

const goDetails = (item) => {
  dataCache.setAskDetails(item);
  router.push({ path: "/askDetails", query: { id: item.id } });
};

const submitForm = async () => {
  if (!isSend.value) {
    ElMessage({
      message: "请输入标题和描述",
      type: "error",
    });
    return;
  }
  await postQuestions(quest)
    .then((res) => {
      if (res.code == 200) {
        quest.title = "";
        quest.description = "";
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
        message: "提问请求出错",
        type: "error",
      });
    });
};

const ruleshandle = () => {
  isSend.value = quest.title != "" && quest.description != "";
};
</script>
<style lang="scss" scoped>
.questionWrapper {
  height: calc(100vh - 415px);
  margin-top: 15px;

  .askCont {
    .askLists {
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
      }

      .ask {
        color: #a0a9b2;

        .tit {
          line-height: 24px;
          margin-top: 6px;
        }
      }

      .time {
        color: var(--color-font3);
        padding-bottom: 10px;
        margin-bottom: 19px;
        border-bottom: 1px solid #000000;
        line-height: 20px;

        .actBut {
          color: #a0a9b2;
          cursor: pointer;
        }
      }
    }

    .noData {
      height: calc(100vh - 488px);
    }
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

    input::-webkit-input-placeholder {
      color: #000000;
    }

    :deep(.el-input__inner) {
      color: #fff;
    }

    :deep(.el-textarea__inner) {
      color: #fff;
    }

    :deep(.el-input__count) {
      color: #7a838a;
    }
  }
}
</style>
<style>
input::-webkit-input-placeholder {
  color: #fff;
}
</style>
