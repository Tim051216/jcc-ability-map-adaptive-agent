<template>
  <div class="answerCont bg-wt marg-bt-20">
    <div class="answer fx">
      <img :src="store.getUserInfo.icon" alt="" />
      <div class="fx-1">
        <el-input
          v-model="description"
          rows="6"
          type="textarea"
          maxlength="500"
          show-word-limit
          :placeholder="`回复：${name || '当前内容'}`"
          @input="ruleshandle"
        />
        <div class="fx-sb fx-al-ct">
          <div>
            <el-checkbox v-model="anonymity" label="匿名" size="large" />
          </div>
          <div class="subCont">
            <span class="bt ft-14" :class="{ 'bt-dis': !isSend }" @click="answerHandle">提交回复</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from "vue";
import { useUserStore } from "@/store";

defineProps({
  name: String,
  askInfoId: String,
  id: String,
});

const emit = defineEmits(["commentHandle"]);
const store = useUserStore();
const anonymity = ref(false);
const isSend = ref(false);
const description = ref("");

const params = reactive({
  answerId: "",
  questionId: "",
  targetReplyId: "",
  targetUserId: "",
  content: "",
  anonymity: "",
});

const ruleshandle = () => {
  isSend.value = description.value.trim() !== "";
};

const answerHandle = () => {
  if (!description.value.trim()) {
    return;
  }
  params.content = description.value.trim();
  params.anonymity = anonymity.value;
  emit("commentHandle", params);
  description.value = "";
  anonymity.value = false;
  isSend.value = false;
};
</script>

<style lang="scss">
.answerCont {
  padding: 20px 30px;
  font-size: 14px;
  border-radius: 8px;

  .subCont {
    margin-top: 20px;

    .bt {
      width: 103px;
      height: 32px;
      line-height: 32px;
      border-radius: 25px;
    }
  }

  .answer {
    img {
      width: 24px;
      height: 24px;
      border-radius: 24px;
      margin-right: 10px;
    }
  }

  .answerItems {
    .items {
      .cont {
        padding: 10px 10px 20px 34px;
        line-height: 24px;
      }
    }

    .replyCont {
      padding-left: 34px;
    }
  }
}
</style>
