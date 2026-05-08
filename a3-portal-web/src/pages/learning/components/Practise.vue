<template>
  <div class="practiseWrapper">
    <div class="preview">
      <div class="previewTit">答题卡</div>
      <div class="previewList">
        <span
          v-for="(item, index) in params"
          :key="index"
          :class="{ act: item && item.answers != undefined && String(item.answers) != '' }"
        >
          {{ index + 1 }}
        </span>
      </div>
      <div class="previewSub" @click="submit"><span class="bt">提交试卷</span></div>
    </div>
    <div class="ExQuestions" v-infinite-scroll="load" style="overflow: auto">
      <div v-for="(item, index) in subjectList" :key="index" class="questions">
        <div class="title fx" v-html="` <p>${index + 1}. ${subjectTypeWt(item.type)}</p>${item.name}`"></div>
        <div v-if="item.type == 1">
          <el-radio-group v-model="item.answers" class="ml-4">
            <el-radio v-for="(it, ind) in item.options" :key="it" :label="ind + 1" size="large">
              <div class="fx"><span>{{ upperAlpha(ind) }}</span><span v-html="it"></span></div>
            </el-radio>
          </el-radio-group>
        </div>
        <div v-if="item.type == 2">
          <el-checkbox-group v-model="item.answers">
            <el-checkbox v-for="(it, ind) in item.options" :key="it" :label="ind + 1">
              <div class="fx"><span>{{ upperAlpha(ind) }}</span><span v-html="it"></span></div>
            </el-checkbox>
          </el-checkbox-group>
        </div>
        <div v-if="item.type == 3">
          <el-checkbox-group v-model="item.answers">
            <el-checkbox v-for="(it, ind) in item.options" :key="it" :label="ind + 1">
              <div class="fx"><span>{{ upperAlpha(ind) }}</span><span v-html="it"></span></div>
            </el-checkbox>
          </el-checkbox-group>
        </div>
        <div v-if="item.type == 4">
          <el-radio-group v-model="item.answers" class="ml-4">
            <el-radio :label="true" size="large">A. 正确</el-radio>
            <el-radio :label="false" size="large">B. 错误</el-radio>
          </el-radio-group>
        </div>
        <div v-if="item.type == 5">
          <el-input
            v-model="item.answers"
            class="textArea"
            maxlength="200"
            placeholder="请输入正确答案"
            rows="5"
            show-word-limit
            type="textarea"
          ></el-input>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { getSubject, postSubject } from "@/api/subject.js";
import { dataCacheStore } from "@/store";

const store = dataCacheStore();
const currentPlayData = ref({});

const props = defineProps({
  id: {
    type: String,
    default: "",
  },
  examInfo: {
    type: Object,
  },
});

const emit = defineEmits(["goHandle", "playHadle"]);

onMounted(() => {
  currentPlayData.value = JSON.parse(JSON.stringify(store.getCurrentPlayData));
  currentPlayData.value.name = currentPlayData.value.sectionName;
  getSubjectList();
});

const subjectTypeWt = (type) => {
  let str = "";
  switch (type) {
    case 1:
      str = "(选择题)";
      break;
    case 2:
      str = "(多选题)";
      break;
    case 3:
      str = "(不定项选择题)";
      break;
    case 4:
      str = "(判断题)";
      break;
    case 5:
      str = "(主观题)";
      break;
  }
  return str;
};

const upperAlpha = (num) => {
  let str = "";
  switch (num) {
    case 0:
      str = "A.";
      break;
    case 1:
      str = "B.";
      break;
    case 2:
      str = "C.";
      break;
    case 3:
      str = "D.";
      break;
    case 4:
      str = "E.";
      break;
    case 5:
      str = "F.";
      break;
    case 6:
      str = "G.";
      break;
  }
  return str;
};

const subjectList = ref([]);
const examId = ref("");
const getSubjectList = async () => {
  await getSubject(props.examInfo)
    .then((res) => {
      if (res.code === 200) {
        examId.value = res.data.id;
        subjectList.value = res.data.questions;
      } else {
        ElMessage({
          message: res.msg,
          type: "error",
        });
      }
    })
    .catch(() => {
      ElMessage({
        message: "练习题获取请求出错",
        type: "error",
      });
    });
};

const isSubmit = ref(false);
const params = ref(subjectList);
const submit = () => {
  const effective = params.value.filter((n) => n.answers != "" && n.answers != undefined);
  if (effective.length < subjectList.value.length) {
    ElMessageBox.confirm("还有未提交答案，是否要提交答卷。", "确认交卷", {
      confirmButtonText: "确认提交",
      cancelButtonText: "我再看看",
      type: "warning",
    })
      .then(() => {
        postSubjectHandle();
      })
      .catch(() => {});
  } else {
    postSubjectHandle();
  }
};

const postSubjectHandle = async () => {
  const param = params.value.map((el) => {
    const answer = Array.isArray(el.answers)
      ? el.answers.sort((i1, i2) => parseInt(i1) - parseInt(i2)).toString()
      : el.answers;
    return { questionId: el.id, answer, questionType: el.type };
  });
  await postSubject({ examDetails: param, id: examId.value })
    .then((res) => {
      if (res.code === 200) {
        subjectList.value = res.data;
        isSubmit.value = true;
        ElMessage({
          message: "答案提交成功，请前往个人中心查看",
          type: "success",
        });
        emit("playHadle", { item: currentPlayData.value, tp: "9" });
      } else {
        ElMessage({
          message: res.msg,
          type: "error",
        });
      }
    })
    .catch(() => {
      ElMessage({
        message: "练习题提交请求出错",
        type: "error",
      });
    });
};

onBeforeUnmount(() => {
  leaveConfirm();
});

function leaveConfirm() {
  if (isSubmit.value) {
    return false;
  }
  const effective = params.value.filter((n) => n.answers != "" && n.answers != undefined);
  if (effective.length > 0) {
    ElMessageBox.confirm("还有未提交答案，是否要提交答卷。", "确认交卷", {
      confirmButtonText: "确认提交",
      cancelButtonText: "我再看看",
      type: "warning",
    })
      .then(() => {
        postSubjectHandle();
      })
      .catch(() => {});
  }
}
const load = () => {};
</script>
<style lang="scss" scoped>
.practiseWrapper {
  background-color: black;
  color: black;
  height: calc(100vh - 60px);
  padding: 30px;
  display: flex;

  .preview {
    width: 188px;
    height: max-content;
    background: #ffffff;
    margin-right: 20px;
    padding: 15px;

    .previewTit {
      font-size: 14px;
      color: var(--color-font1);
      margin-bottom: 20px;
    }

    .previewList {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
      margin-bottom: 30px;

      span {
        display: inline-block;
        width: 22px;
        line-height: 22px;
        border: 1px solid #80878c;
        color: #80878c;
        border-radius: 2px;
        margin-right: 10px;
        margin-bottom: 10px;
        text-align: center;
      }

      span:nth-child(5n) {
        margin-right: 0px;
      }

      .act {
        color: #fff;
        background: #27ba9b;
        border: 1px solid #27ba9b;
      }
    }

    .previewSub {
      width: 80px;
      height: 28px;
      border-radius: 3px;
      margin: 0 auto;

      .bt {
        font-size: 14px;
        line-height: 28px;
      }
    }
  }

  .ExQuestions {
    background-color: #ffffff;
    flex: 1;
    padding: 30px;

    .textArea {
      width: 100%;
    }

    .title {
      margin: 16px 0;
    }
  }
}
</style>
