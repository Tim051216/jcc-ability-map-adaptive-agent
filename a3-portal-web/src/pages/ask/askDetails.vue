<template>
  <div class="askDetailsWrapper">
    <div v-if="askInfo" class="container">
      <div class="fx-sb">
        <div class="fx-1 marg-rt-20">
          <div class="askCont bg-wt marg-bt-20">
            <div class="questionHead">
              <div class="userInfo">
                <img :src="askInfo.userIcon || '/src/assets/anonymity.png'" alt="" />
                <span>{{ askInfo.userName || "匿名用户" }}</span>
              </div>
              <div class="questionMeta">
                <span>{{ askInfo.createTime }}</span>
                <span>回答 {{ total }}</span>
              </div>
            </div>
            <div class="askInfo">
              <div class="ft-20 ft-wt-600">{{ askInfo.title }}</div>
              <p class="questionDesc">{{ askInfo.description }}</p>
              <div v-if="askInfo.latestAnswer" class="latestAnswer">
                <div class="latestLabel">最新回复</div>
                <div>{{ askInfo.latestAnswer.replier?.name }}：{{ askInfo.latestAnswer.content }}</div>
              </div>
            </div>
          </div>

          <div class="answerCont bg-wt marg-bt-20">
            <div class="sectionTitle">补充回答</div>
            <div class="answer fx">
              <img :src="store.getUserInfo.icon" alt="" />
              <div class="fx-1">
                <el-input
                  v-model="description"
                  rows="7"
                  type="textarea"
                  maxlength="500"
                  show-word-limit
                  placeholder="补充你的思路、处理方式或演示建议，让这个问题更容易被快速接住。"
                  @input="ruleshandle"
                />
                <div class="fx-sb fx-al-ct">
                  <div class="tipRow">
                    <el-checkbox v-model="anonymity" label="匿名回答" size="large" />
                    <span class="submitTip">当前以演示验收为主，建议把问题背景写完整。</span>
                  </div>
                  <div class="subCont">
                    <span class="bt ft-14" :class="{ 'bt-dis': !isSend }" @click="submitTopLevelAnswer">提交回答</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="answerCont bg-wt marg-bt-20">
            <div class="sectionTitle">全部回答（{{ total }}）</div>
            <div v-if="answers.length" class="answerItems">
              <div v-for="item in answers" :key="item.id" class="answerCard">
                <div class="fx-al-ct">
                  <img class="img" :src="item.userIcon || '/src/assets/anonymity.png'" alt="" />
                  <div class="cardUser">
                    <div>{{ item.userName || "匿名用户" }}</div>
                    <div class="ft-cl-des">{{ item.createTime }}</div>
                  </div>
                </div>
                <div class="cont">
                  <div class="marg-bt-10">{{ item.content }}</div>
                  <div class="fx-sb actionRow">
                    <div class="ft-cl-des">这条回答适合继续追问、补充实现细节或给出演示建议。</div>
                    <div class="actionGroup">
                      <span class="marg-rt-10 cur-pt" @click="toggleReplyPanel(item)">
                        <i class="iconfont zhy-a-btn_pinglun_nor2x"></i>
                        {{ expandedAnswerId === item.id ? "收起回复" : `查看回复（${item.replyTimes || 0}）` }}
                      </span>
                      <span :class="{ 'cur-pt': true, activeLiked: item.liked }" @click="likedHandle(item)">
                        <i class="iconfont zhy-a-btn_zan_nor2x"></i>
                        点赞（{{ item.likedTimes || 0 }}）
                      </span>
                    </div>
                  </div>
                </div>

                <ReplayForm
                  v-if="openReplyFormId === item.id"
                  :name="item.userName || '匿名用户'"
                  :askInfoId="String(askInfo.id)"
                  :id="String(item.userId || '')"
                  @commentHandle="(val) => commentHandle(val, item, item)"
                />

                <div v-if="expandedAnswerId === item.id" class="replyCont">
                  <div v-if="replyList.length" class="replyList">
                    <div v-for="reply in replyList" :key="reply.id" class="replyItem">
                      <div class="fx-al-ct">
                        <img class="img" :src="reply.userIcon || '/src/assets/anonymity.png'" alt="" />
                        <span class="ft-cl-des">{{ reply.userName || "匿名用户" }} 回复 {{ reply.targetUserName || item.userName || "提问者" }}</span>
                      </div>
                      <div class="cont">
                        <div class="marg-bt-10">{{ reply.content }}</div>
                        <div class="fx-sb actionRow">
                          <div class="ft-cl-des">{{ reply.createTime }}</div>
                          <div class="actionGroup">
                            <span class="marg-rt-10 cur-pt" @click="toggleNestedReplyForm(item, reply)">
                              <i class="iconfont zhy-a-btn_pinglun_nor2x"></i>
                              回复
                            </span>
                            <span :class="{ 'cur-pt': true, activeLiked: reply.liked }" @click="likedHandle(reply)">
                              <i class="iconfont zhy-a-btn_zan_nor2x"></i>
                              点赞（{{ reply.likedTimes || 0 }}）
                            </span>
                          </div>
                        </div>
                      </div>
                      <ReplayForm
                        v-if="openReplyFormId === reply.id"
                        :name="reply.userName || '匿名用户'"
                        :askInfoId="String(askInfo.id)"
                        :id="String(reply.userId || '')"
                        @commentHandle="(val) => commentHandle(val, item, reply)"
                      />
                    </div>
                  </div>
                  <div v-else class="emptyReplies">这条回答还没有追问，欢迎补充细节。</div>
                  <div v-if="replyTotal > 5" class="dialogEntry" @click="openReplyDialog(item)">
                    查看全部 {{ replyTotal }} 条回复
                  </div>
                </div>
              </div>

              <p v-if="!noMore" class="loadMore" @click="clickLoad">点击查看更多回答</p>
              <p v-else class="loadMore done">已经到底了</p>
            </div>
            <div v-else class="emptyReplies">当前还没有回答，适合拿来演示“从提问到互动补充”的链路。</div>
          </div>
        </div>

        <RelatedQuestions :id="route.query.detailsId" :title="route.query.name" />
      </div>
    </div>

    <el-dialog v-model="dialogTableVisible" :title="`全部回复（${replyTotal}）`" width="80%" top="5vh">
      <div class="dialogReplyCont">
        <div v-for="reply in replyList" :key="`dialog-${reply.id}`" class="replyItem">
          <div class="fx-al-ct">
            <img class="img" :src="reply.userIcon || '/src/assets/anonymity.png'" alt="" />
            <span class="ft-cl-des">{{ reply.userName || "匿名用户" }} 回复 {{ reply.targetUserName || activeAnswer?.userName || "提问者" }}</span>
          </div>
          <div class="cont">
            <div class="marg-bt-10">{{ reply.content }}</div>
            <div class="fx-sb actionRow">
              <div class="ft-cl-des">{{ reply.createTime }}</div>
              <div class="actionGroup">
                <span class="marg-rt-10 cur-pt" @click="toggleNestedReplyForm(activeAnswer, reply)">
                  <i class="iconfont zhy-a-btn_pinglun_nor2x"></i>
                  回复
                </span>
                <span :class="{ 'cur-pt': true, activeLiked: reply.liked }" @click="likedHandle(reply)">
                  <i class="iconfont zhy-a-btn_zan_nor2x"></i>
                  点赞（{{ reply.likedTimes || 0 }}）
                </span>
              </div>
            </div>
          </div>
          <ReplayForm
            v-if="openReplyFormId === reply.id"
            :name="reply.userName || '匿名用户'"
            :askInfoId="String(askInfo.id)"
            :id="String(reply.userId || '')"
            @commentHandle="(val) => commentHandle(val, activeAnswer, reply)"
          />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import { dataCacheStore, useUserStore } from "@/store";
import { getQuestionsDetails, getReply, postAnswers, putLiked } from "@/api/classDetails.js";
import RelatedQuestions from "./components/RelatedQuestions.vue";
import ReplayForm from "./components/ReplayForm.vue";

const route = useRoute();
const store = useUserStore();
const dataCache = dataCacheStore();

const askInfo = ref(null);
const description = ref("");
const anonymity = ref(false);
const isSend = ref(false);
const total = ref(0);
const answers = ref([]);
const replyList = ref([]);
const replyTotal = ref(0);
const expandedAnswerId = ref(null);
const openReplyFormId = ref(null);
const activeAnswer = ref(null);
const dialogTableVisible = ref(false);

const questParams = reactive({
  questionId: route.query.id,
  pageNo: 1,
  pageSize: 10,
});

const noMore = computed(() => answers.value.length >= total.value);

onMounted(() => {
  loadQuestionDetails();
  loadAnswers();
});

const ruleshandle = () => {
  isSend.value = description.value.trim().length > 0;
};

const buildFallbackQuestion = () => {
  const cached = dataCache.getAskDetails;
  if (!cached || typeof cached !== "object") {
    return null;
  }
  return {
    ...cached,
    description: cached.description || "这是从课程问答页带过来的问题，当前页面优先保证演示链路可看、可追问、可互动。",
  };
};

const loadQuestionDetails = async () => {
  try {
    const res = await getQuestionsDetails(route.query.id);
    if (res.code === 200 && res.data) {
      askInfo.value = res.data;
      return;
    }
  } catch (error) {
    // 使用缓存兜底，保证页面可演示。
  }

  askInfo.value = buildFallbackQuestion();
  if (!askInfo.value) {
    ElMessage({ type: "error", message: "问答详情加载失败" });
  }
};

const loadAnswers = async (mode = "reset") => {
  try {
    const res = await getReply(questParams);
    if (res.code === 200) {
      const list = res.data?.list || [];
      answers.value = mode === "more" ? answers.value.concat(list) : list;
      total.value = Number(res.data?.total || 0);
      return;
    }
    ElMessage({ type: "error", message: res.msg || "回答列表加载失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "回答列表加载失败" });
  }
};

const clickLoad = () => {
  if (noMore.value) {
    return;
  }
  questParams.pageNo += 1;
  loadAnswers("more");
};

const loadReplies = async (answerId) => {
  try {
    const res = await getReply({
      answerId,
      pageNo: 1,
      pageSize: 100,
    });
    if (res.code === 200) {
      replyList.value = res.data?.list || [];
      replyTotal.value = Number(res.data?.total || 0);
      return;
    }
    ElMessage({ type: "error", message: res.msg || "回复列表加载失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "回复列表加载失败" });
  }
};

const toggleReplyPanel = async (item) => {
  if (expandedAnswerId.value === item.id) {
    expandedAnswerId.value = null;
    openReplyFormId.value = null;
    replyList.value = [];
    replyTotal.value = 0;
    return;
  }
  activeAnswer.value = item;
  expandedAnswerId.value = item.id;
  openReplyFormId.value = item.id;
  await loadReplies(item.id);
};

const openReplyDialog = async (item) => {
  activeAnswer.value = item;
  if (expandedAnswerId.value !== item.id) {
    expandedAnswerId.value = item.id;
    await loadReplies(item.id);
  }
  dialogTableVisible.value = true;
};

const toggleNestedReplyForm = (answer, reply) => {
  activeAnswer.value = answer;
  openReplyFormId.value = openReplyFormId.value === reply.id ? null : reply.id;
};

const submitTopLevelAnswer = async () => {
  const content = description.value.trim();
  if (!content || !askInfo.value?.id) {
    ElMessage({ type: "warning", message: "请先填写回答内容" });
    return;
  }
  try {
    const res = await postAnswers({
      questionId: askInfo.value.id,
      content,
      anonymity: anonymity.value,
    });
    if (res.code === 200) {
      description.value = "";
      anonymity.value = false;
      isSend.value = false;
      questParams.pageNo = 1;
      await loadQuestionDetails();
      await loadAnswers();
      ElMessage({ type: "success", message: "回答已提交" });
      return;
    }
    ElMessage({ type: "error", message: res.msg || "回答提交失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "回答提交失败" });
  }
};

const commentHandle = async (val, answer, target) => {
  if (!askInfo.value?.id || !answer?.id) {
    return;
  }
  try {
    const res = await postAnswers({
      questionId: askInfo.value.id,
      answerId: answer.id,
      targetReplyId: target?.id || answer.id,
      targetUserId: target?.userId || answer.userId,
      content: val.content,
      anonymity: val.anonymity,
    });
    if (res.code === 200) {
      openReplyFormId.value = null;
      await loadQuestionDetails();
      await loadAnswers();
      await loadReplies(answer.id);
      ElMessage({ type: "success", message: "回复已提交" });
      return;
    }
    ElMessage({ type: "error", message: res.msg || "回复提交失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "回复提交失败" });
  }
};

const likedHandle = async (item) => {
  try {
    const nextLiked = !item.liked;
    const res = await putLiked({ bizId: item.id, liked: nextLiked, bizType: "QA" });
    if (res.code === 200) {
      item.liked = nextLiked;
      item.likedTimes = Math.max(0, Number(item.likedTimes || 0) + (nextLiked ? 1 : -1));
      return;
    }
    ElMessage({ type: "error", message: res.msg || "点赞失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "点赞失败" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
<style lang="scss" scoped>
.askDetailsWrapper {
  .questionHead {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 12px;
  }

  .questionMeta {
    display: flex;
    gap: 16px;
    color: #80878c;
    font-size: 14px;
  }

  .questionDesc {
    margin: 12px 0 0;
    line-height: 28px;
    color: #33404a;
  }

  .latestAnswer {
    margin-top: 20px;
    padding: 16px 18px;
    background: #f7f9fb;
    border-radius: 8px;
    line-height: 24px;
  }

  .latestLabel,
  .sectionTitle {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 20px;
  }

  .tipRow {
    display: flex;
    align-items: center;
    gap: 16px;
    color: #80878c;
    font-size: 13px;
  }

  .submitTip {
    line-height: 20px;
  }

  .answerCard {
    padding: 20px 0;
    border-bottom: 1px solid #eef1f4;
  }

  .answerCard:last-child {
    border-bottom: none;
  }

  .cardUser {
    line-height: 22px;
  }

  .actionRow {
    gap: 16px;
    align-items: flex-start;
  }

  .actionGroup {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .replyList,
  .dialogReplyCont {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .replyItem {
    padding: 14px 16px;
    background: #f8fafc;
    border-radius: 8px;
  }

  .dialogEntry,
  .loadMore,
  .emptyReplies {
    text-align: center;
    color: #80878c;
    font-size: 14px;
  }

  .dialogEntry,
  .loadMore {
    cursor: pointer;
    padding-top: 16px;
  }

  .done {
    cursor: default;
  }
}
</style>
