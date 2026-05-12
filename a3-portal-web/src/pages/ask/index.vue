<template>
  <div class="askWrapper">
    <div class="container">
      <div class="askCont fx-sb">
        <div class="formCont bg-wt marg-rt-20 fx-1">
          <div class="title">&#x53D1;&#x8D77;&#x63D0;&#x95EE;</div>
          <el-form
            ref="ruleFormRef"
            :model="ruleForm"
            status-icon
            :rules="rules"
            label-width="80px"
            class="demo-ruleForm"
            label-position="left"
          >
            <el-form-item label="&#x6240;&#x5C5E;&#x8BFE;&#x7A0B;">
              <span>{{ classInfo.title || "当前课程" }}</span>
            </el-form-item>
            <el-form-item label="&#x5BF9;&#x5E94;&#x7AE0;&#x8282;:" prop="pass">
              <div>
                <el-cascader v-model="value" :options="options" :props="props" @change="handleChange" />
                <div v-if="options.length === 0" class="desc">当前暂无可选章节，仍可先补充问题标题和描述，后续再补齐章节信息。</div>
                <div class="desc">&#x53EF;&#x4EE5;&#x9009;&#x62E9;&#x5177;&#x4F53;&#x7AE0;&#x8282;&#xFF0C;&#x8BA9;&#x95EE;&#x9898;&#x66F4;&#x51C6;&#x786E;&#x5F52;&#x5C5E;&#x5230;&#x8BFE;&#x7A0B;&#x5185;&#x5BB9;&#x91CC;&#x3002;</div>
              </div>
            </el-form-item>
            <el-form-item label="&#x95EE;&#x9898;&#x6807;&#x9898;:" prop="title">
              <el-input v-model="ruleForm.title" maxlength="64" show-word-limit placeholder="&#x8BF7;&#x8F93;&#x5165;&#x6807;&#x9898;" @input="ruleshandle" />
            </el-form-item>
            <el-form-item label="&#x95EE;&#x9898;&#x63CF;&#x8FF0;:" prop="description">
              <el-input
                v-model="ruleForm.description"
                rows="11"
                type="textarea"
                maxlength="500"
                show-word-limit
                placeholder="&#x8BF7;&#x8F93;&#x5165;&#x95EE;&#x9898;&#x63CF;&#x8FF0;"
                @input="ruleshandle"
              />
            </el-form-item>
            <el-form-item>
              <div class="fx-sb fx-al-ct">
                <div><el-checkbox v-model="ruleForm.anonymity" label="&#x533F;&#x540D;&#x63D0;&#x95EE;" size="large" /></div>
                <div class="subCont">
                  <span class="bt ft-14" :class="{ 'bt-dis': !isSend }" @click="submitForm(ruleFormRef)">&#x53D1;&#x5E03;&#x95EE;&#x9898;</span>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </div>
        <AskCareful />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import AskCareful from "./components/AskCareful.vue";
import { getClassCourses, getQuestionsDetails, postQuestions, putQuestions } from "@/api/classDetails.js";

const route = useRoute();
const router = useRouter();
const classInfo = route.query;

const type = ref("add");
const ruleFormRef = ref();
const value = ref([]);
const options = ref([]);
const isSend = ref(false);

const props = {
  expandTrigger: "hover",
};

const ruleForm = reactive({
  courseId: "",
  chapterId: "",
  sectionId: "",
  title: "",
  anonymity: false,
  description: "",
});

const rules = reactive({});

onMounted(() => {
  getClassCoursesDataes();
  ruleForm.courseId = classInfo.id;
  if (classInfo.type && classInfo.type === "edit") {
    type.value = "edit";
    getQuestionsDetailsData();
  }
});

const getClassCoursesDataes = async () => {
  try {
    const res = await getClassCourses(classInfo.id);
    if (res.code === 200) {
      options.value = (res.data || []).map((item) => ({
        value: item.id,
        label: item.name,
        children: (item.sections || []).map((section) => ({
          value: section.id,
          label: section.name,
        })),
      }));
      return;
    }
    ElMessage({ message: res.msg || "章节数据加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "章节数据加载失败", type: "error" });
  }
};

const getQuestionsDetailsData = async () => {
  try {
    const res = await getQuestionsDetails(classInfo.queryId);
    if (res.code === 200) {
      const { data } = res;
      ruleForm.courseId = data.courseId;
      ruleForm.chapterId = data.chapterId;
      ruleForm.sectionId = data.sectionId;
      ruleForm.title = data.title;
      ruleForm.anonymity = data.anonymity;
      ruleForm.description = data.description;
      ruleForm.id = data.id;
      value.value = [data.chapterId, data.sectionId];
      return;
    }
    ElMessage({ message: res.msg || "问题详情加载失败", type: "error" });
  } catch (error) {
    ElMessage({ message: "问题详情加载失败", type: "error" });
  }
};

const ruleshandle = () => {
  const ruleData = { ...ruleForm };
  let valid = true;
  for (const key in ruleData) {
    if (ruleData[key] === "" && key !== "anonymity") {
      valid = false;
    }
  }
  isSend.value = valid;
};

const handleChange = (val) => {
  if (type.value === "edit") {
    ruleForm.id = route.query.queryId;
  }
  ruleForm.chapterId = val[0];
  ruleForm.sectionId = val[1];
  ruleshandle();
};

const submitForm = (formEl) => {
  if (!isSend.value) {
    return;
  }
  formEl.validate(async (valid) => {
    if (!valid) {
      return false;
    }

    const submitFn = type.value === "edit" ? putQuestions : postQuestions;

    try {
      const res = await submitFn(ruleForm);
      if (res.code === 200) {
        router.push({ path: "/result/success", query: { from: "ask" } });
        return;
      }
      ElMessage({ message: res.msg || "问题提交失败", type: "error" });
    } catch (error) {
      ElMessage({ message: type.value === "edit" ? "问题修改失败" : "问题发布失败", type: "error" });
    }
  });
};
</script>

<style lang="scss" src="./index.scss"></style>
