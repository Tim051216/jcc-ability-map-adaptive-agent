<template>
  <div class="resourcePage">
    <section class="heroSection">
      <div class="container heroInner">
        <div class="heroContent">
          <div class="heroBadge">A3 资源中心</div>
          <h1>个性化学习资源中心</h1>
          <p>
            围绕当前专题自动组织讲义、练习、思维导图和案例材料，并联动收藏能力，把资源沉淀到收藏页继续复用。
          </p>
          <div class="heroActions">
            <router-link class="navLink secondary" to="/main/index">返回首页</router-link>
            <router-link class="navLink ghost" to="/main/ai-favorites">查看收藏夹</router-link>
            <router-link class="navLink accent" to="/main/ai-report">查看学习报告</router-link>
          </div>
        </div>

        <div class="heroPanel">
          <div class="summaryCard">
            <span>已生成资源</span>
            <strong>{{ resources.length }}</strong>
          </div>
          <div class="summaryCard">
            <span>推荐顺序</span>
            <strong>{{ recommendedOrder.length }}</strong>
          </div>
          <div class="summaryCard">
            <span>已收藏资源</span>
            <strong>{{ currentFavoriteCount }}</strong>
          </div>
          <div class="summaryCard">
            <span>当前专题</span>
            <strong>{{ a3DemoScenario.currentTopic }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="container contentSection">
      <div class="controlPanel">
        <div class="panelTitle">
          <h2>资源生成参数</h2>
          <p>选择知识点和资源类型后，页面会优先调用 AI 服务，失败时自动切换到本地演示资源。</p>
        </div>

        <div class="fieldGrid">
          <label class="fieldItem">
            <span>用户 ID</span>
            <el-input-number v-model="form.user_id" :min="1" :max="999999" />
          </label>
          <label class="fieldItem">
            <span>专题编码</span>
            <el-input v-model="form.course_code" />
          </label>
        </div>

        <label class="fieldItem textareaField">
          <span>知识点列表</span>
          <el-input
            v-model="knowledgePointText"
            type="textarea"
            :rows="4"
            resize="none"
            placeholder="请按逗号或换行输入知识点，例如：过拟合、泛化误差、模型评估"
          />
        </label>

        <div class="typePanel">
          <span class="typeTitle">资源类型</span>
          <div class="typeChips">
            <button
              v-for="item in resourceTypeOptions"
              :key="item.value"
              class="typeChip"
              :class="{ active: form.resource_types.includes(item.value) }"
              @click="toggleType(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="presetPanel">
          <div v-for="preset in quickPresets" :key="preset.title" class="presetCard" @click="applyPreset(preset)">
            <strong>{{ preset.title }}</strong>
            <p>{{ preset.desc }}</p>
          </div>
        </div>

        <div class="actionRow">
          <el-button type="primary" size="large" :loading="loading" @click="generateResources">
            {{ loading ? "正在生成资源..." : "生成学习资源" }}
          </el-button>
          <el-button size="large" plain @click="resetForm">重置参数</el-button>
        </div>

        <div v-if="errorMessage" class="errorPanel">
          <strong>接口提示</strong>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <div class="resultPanel">
        <div class="resultHeader">
          <div>
            <h2>资源生成结果</h2>
            <p>收藏操作会直接沉淀到本地演示存储，方便切换到收藏页继续演示。</p>
          </div>
          <div class="statusPill" :class="{ ready: resources.length > 0 }">
            {{ resources.length ? "已生成结果" : "等待生成" }}
          </div>
        </div>

        <div v-if="recommendedOrder.length" class="resultBlock">
          <div class="blockTitle">推荐学习顺序</div>
          <div class="orderList">
            <div v-for="(item, index) in recommendedOrder" :key="`${item}-${index}`" class="orderCard">
              <span>{{ index + 1 }}</span>
              <strong>{{ item }}</strong>
            </div>
          </div>
        </div>

        <div class="resultBlock">
          <div class="blockTitle">资源列表</div>
          <div v-if="resources.length" class="resourceGrid">
            <div v-for="(item, index) in resources" :key="item.resource_id || `${item.title}-${index}`" class="resourceCard">
              <div class="resourceHead">
                <span>{{ formatResourceType(item.resource_type) }}</span>
                <el-button
                  size="small"
                  plain
                  :disabled="!item.resource_id"
                  :loading="favoriteLoadingId === item.resource_id"
                  @click="toggleFavorite(item)"
                >
                  {{ favoriteIds.has(item.resource_id) ? "取消收藏" : "收藏资源" }}
                </el-button>
              </div>
              <strong>{{ item.title || `资源 ${index + 1}` }}</strong>
              <p>{{ item.summary || "暂无摘要" }}</p>
              <div v-if="item.source_titles?.length" class="tagList">
                <em v-for="title in item.source_titles" :key="title">{{ title }}</em>
              </div>
              <div v-if="item.study_suggestion" class="suggestionBox">
                <span>学习建议</span>
                <p>{{ item.study_suggestion }}</p>
              </div>
            </div>
          </div>
          <div v-else class="emptyState">点击“生成学习资源”后，这里会展示讲义、练习、思维导图、案例拆解等资源结果。</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { favoriteAiResource, generateAiResources, listAiFavoriteResources, unfavoriteAiResource } from "@/api/ai";
import { a3DemoScenario } from "@/mock/a3DemoData";
import { dedupeResources, listFavoriteResources, normalizeResource, removeFavoriteResource, saveFavoriteResource } from "@/utils/a3StudentStore";

const RESOURCE_CACHE_KEY = "a3_student_generated_resources";

const resourceTypeOptions = [
  { label: "课程讲义", value: "lecture_notes" },
  { label: "分层练习", value: "practice_set" },
  { label: "思维导图", value: "mind_map" },
  { label: "案例拆解", value: "case_study" },
  { label: "延伸阅读", value: "extended_reading" },
];

const quickPresets = [
  {
    title: "过拟合专题",
    desc: "围绕过拟合、泛化误差和模型评估生成一组演示资源。",
    knowledgePoints: ["过拟合", "泛化误差", "模型评估"],
    resourceTypes: ["lecture_notes", "practice_set", "mind_map"],
  },
  {
    title: "答辩演示包",
    desc: "生成适合现场展示的讲义、案例和延伸阅读。",
    knowledgePoints: ["学习路径规划", "个性化推荐", "检索增强问答"],
    resourceTypes: ["lecture_notes", "case_study", "extended_reading"],
  },
];

const RESOURCE_TYPE_LABELS = {
  lecture_notes: "课程讲义",
  practice_set: "分层练习",
  mind_map: "思维导图",
  case_study: "案例拆解",
  extended_reading: "延伸阅读",
};

const initialForm = () => ({
  user_id: a3DemoScenario.userId,
  course_code: a3DemoScenario.courseCode,
  resource_types: ["lecture_notes", "practice_set", "mind_map"],
});

const form = reactive(initialForm());
const knowledgePointText = ref("过拟合\n泛化误差\n模型评估");
const resources = ref([]);
const recommendedOrder = ref([]);
const loading = ref(false);
const favoriteLoadingId = ref(null);
const errorMessage = ref("");
const favoriteIds = ref(new Set());
const localFavoriteItems = ref([]);

const formatResourceType = (resourceType) => RESOURCE_TYPE_LABELS[resourceType] || resourceType || "学习资源";

const normalizeResourceText = (value, fallback = "") => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return text
    .replace(new RegExp(a3DemoScenario.courseCode, "g"), a3DemoScenario.currentTopic)
    .replace(/learning resource/gi, "学习资源")
    .replace(/key concept map/gi, "核心概念导图")
    .replace(/\bMind Map\b/g, "思维导图");
};

const normalizeResourceItem = (item, index) => {
  const typeLabel = formatResourceType(item.resource_type);
  const fallbackTitle = typeLabel === "思维导图" ? "知识点思维导图说明" : `${typeLabel}资源 ${index + 1}`;
  return normalizeResource({
    ...item,
    title: normalizeResourceText(item.title, fallbackTitle).replace(
      /^(lecture_notes|practice_set|mind_map|case_study|extended_reading)$/i,
      typeLabel,
    ),
    summary: normalizeResourceText(item.summary, "暂无摘要"),
    study_suggestion: normalizeResourceText(item.study_suggestion, ""),
  });
};

const normalizeRecommendedOrder = (items = []) =>
  items.map((item) => {
    const mappedType = formatResourceType(item);
    return mappedType === item ? normalizeResourceText(item, item) : mappedType;
  });

const buildFallbackResources = (knowledgePoints = [], resourceTypes = []) => {
  const focusList = knowledgePoints.length ? knowledgePoints : [a3DemoScenario.currentTopic];
  const focusText = focusList.join("、");
  return {
    resources: dedupeResources(
      resourceTypes.map((resourceType, index) => ({
        resource_type: resourceType,
        title: `${formatResourceType(resourceType)} · ${focusList[index % focusList.length] || a3DemoScenario.currentTopic}`,
        summary: `围绕 ${focusText} 自动整理的 ${formatResourceType(resourceType)}，可直接用于学生端演示与答辩串讲。`,
        study_suggestion: `建议先浏览 ${focusList[index % focusList.length] || a3DemoScenario.currentTopic}，再结合当前学习路径完成 5 分钟复盘。`,
        source_titles: [`${a3DemoScenario.currentTopic} 演示资源包`, `${focusList[index % focusList.length] || a3DemoScenario.currentTopic} 强化材料`],
      })),
    ).map(normalizeResourceItem),
    recommendedOrder: resourceTypes.map((item) => formatResourceType(item)),
  };
};

function readCache() {
  try {
    const raw = window.localStorage.getItem(RESOURCE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(payload) {
  try {
    window.localStorage.setItem(RESOURCE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache errors
  }
}

const cachedPayload = readCache();
resources.value = (cachedPayload.resources || []).map(normalizeResourceItem);
recommendedOrder.value = normalizeRecommendedOrder(cachedPayload.recommendedOrder || []);
localFavoriteItems.value = listFavoriteResources();
favoriteIds.value = new Set(localFavoriteItems.value.map((item) => item.resource_id));

const isLocalResourceId = (resourceId) => String(resourceId || "").startsWith("local::");
const currentFavoriteCount = computed(() => favoriteIds.value.size);

const parseKnowledgePoints = () =>
  knowledgePointText.value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

const toggleType = (value) => {
  if (form.resource_types.includes(value)) {
    form.resource_types = form.resource_types.filter((item) => item !== value);
    return;
  }
  form.resource_types = [...form.resource_types, value];
};

const applyPreset = (preset) => {
  knowledgePointText.value = preset.knowledgePoints.join("\n");
  form.resource_types = [...preset.resourceTypes];
};

const resetForm = () => {
  Object.assign(form, initialForm());
  knowledgePointText.value = "过拟合\n泛化误差\n模型评估";
  errorMessage.value = "";
};

const loadFavorites = async () => {
  try {
    const result = await listAiFavoriteResources({
      user_id: form.user_id,
      course_code: form.course_code,
    });
    localFavoriteItems.value = listFavoriteResources();
    favoriteIds.value = new Set([
      ...(result.items || []).map((item) => item.resource_id).filter(Boolean),
      ...localFavoriteItems.value.map((item) => item.resource_id),
    ]);
  } catch (error) {
    localFavoriteItems.value = listFavoriteResources();
    if (error?.response?.status === 404) {
      favoriteIds.value = new Set(localFavoriteItems.value.map((item) => item.resource_id));
      return;
    }
    favoriteIds.value = new Set(localFavoriteItems.value.map((item) => item.resource_id));
  }
};

const generateResources = async () => {
  const knowledgePoints = parseKnowledgePoints();
  if (!knowledgePoints.length) {
    ElMessage.warning("请先输入至少一个知识点");
    return;
  }
  if (!form.resource_types.length) {
    ElMessage.warning("请至少选择一种资源类型");
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await generateAiResources({
      user_id: form.user_id,
      course_code: form.course_code.trim(),
      knowledge_points: knowledgePoints,
      resource_types: form.resource_types,
    });

    const remoteResources = (result.resources || []).map(normalizeResourceItem);
    const fallbackPayload = buildFallbackResources(knowledgePoints, form.resource_types);
    resources.value = remoteResources.length ? remoteResources : fallbackPayload.resources;
    recommendedOrder.value = normalizeRecommendedOrder(
      (result.recommended_order || []).length ? result.recommended_order : fallbackPayload.recommendedOrder,
    );
    writeCache({
      resources: resources.value,
      recommendedOrder: recommendedOrder.value,
      updatedAt: Date.now(),
    });
    await loadFavorites();
    ElMessage.success("资源生成完成");
  } catch (error) {
    const fallbackPayload = buildFallbackResources(knowledgePoints, form.resource_types);
    resources.value = fallbackPayload.resources;
    recommendedOrder.value = fallbackPayload.recommendedOrder;
    writeCache({
      resources: resources.value,
      recommendedOrder: recommendedOrder.value,
      updatedAt: Date.now(),
    });
    await loadFavorites();
    errorMessage.value = error?.response?.data?.detail || error?.message || "资源生成接口暂不可用，已切换为本地演示资源。";
    ElMessage.success("已切换为本地演示资源");
  } finally {
    loading.value = false;
  }
};

const toggleFavorite = async (resource) => {
  favoriteLoadingId.value = resource.resource_id;
  try {
    if (favoriteIds.value.has(resource.resource_id)) {
      if (!isLocalResourceId(resource.resource_id)) {
        await unfavoriteAiResource(resource.resource_id, { user_id: form.user_id });
      }
      localFavoriteItems.value = removeFavoriteResource(resource);
      favoriteIds.value = new Set([...favoriteIds.value].filter((id) => id !== resource.resource_id));
      ElMessage.success("已取消收藏");
    } else {
      if (!isLocalResourceId(resource.resource_id)) {
        await favoriteAiResource(resource.resource_id, { user_id: form.user_id });
      }
      localFavoriteItems.value = saveFavoriteResource(resource);
      favoriteIds.value = new Set([...favoriteIds.value, resource.resource_id]);
      ElMessage.success("已加入收藏夹");
    }
  } catch {
    if (favoriteIds.value.has(resource.resource_id)) {
      localFavoriteItems.value = removeFavoriteResource(resource);
      favoriteIds.value = new Set([...favoriteIds.value].filter((id) => id !== resource.resource_id));
      ElMessage.success("已取消收藏");
      return;
    }
    localFavoriteItems.value = saveFavoriteResource(resource);
    favoriteIds.value = new Set([...favoriteIds.value, resource.resource_id]);
    ElMessage.success("已加入收藏夹");
  } finally {
    favoriteLoadingId.value = null;
  }
};

onMounted(() => {
  loadFavorites();
});
</script>

<style scoped lang="scss">
.resourcePage {
  min-height: 100vh;
  padding-bottom: 48px;
  background:
    radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 24%),
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 24%),
    linear-gradient(180deg, #f5fbff 0%, #eef6fb 50%, #f8fafc 100%);
}

.heroSection {
  padding: 32px 0 24px;
}

.heroInner,
.contentSection {
  display: grid;
  gap: 24px;
  grid-template-columns: 420px 1fr;
}

.heroContent,
.heroPanel,
.controlPanel,
.resultPanel {
  border: 1px solid rgba(141, 174, 207, 0.24);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 28px;
  box-shadow: 0 24px 60px rgba(37, 99, 235, 0.08);
  backdrop-filter: blur(18px);
}

.heroContent,
.controlPanel,
.resultPanel {
  padding: 28px;
}

.heroPanel {
  padding: 22px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.heroBadge {
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #0ea5a4 0%, #2563eb 100%);
  color: #fff;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.heroContent h1 {
  margin-top: 16px;
  color: #132238;
  font-size: 40px;
  line-height: 1.16;
}

.heroContent p {
  margin-top: 18px;
  line-height: 1.9;
  color: #55657d;
}

.heroActions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  flex-wrap: wrap;
}

.navLink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 160px;
  height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  font-weight: 700;
}

.navLink.secondary {
  background: #e0f2fe;
  color: #123b74;
}

.navLink.ghost {
  background: #ecfeff;
  color: #0f766e;
}

.navLink.accent {
  background: #15304f;
  color: #fff;
}

.summaryCard {
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(244, 248, 253, 0.98), rgba(230, 240, 247, 0.92));
}

.summaryCard span {
  display: block;
  font-size: 12px;
  color: #6c7e95;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.summaryCard strong {
  display: block;
  margin-top: 10px;
  font-size: 24px;
  color: #132238;
}

.panelTitle h2,
.resultHeader h2 {
  font-size: 24px;
  color: #172033;
}

.panelTitle p,
.resultHeader p {
  margin-top: 8px;
  color: #66778e;
  line-height: 1.7;
}

.fieldGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.fieldItem {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fieldItem span,
.typeTitle {
  font-size: 13px;
  font-weight: 600;
  color: #51657d;
}

.textareaField,
.typePanel,
.presetPanel,
.actionRow,
.errorPanel {
  margin-top: 18px;
}

.typeChips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.typeChip {
  border: 0;
  padding: 10px 16px;
  border-radius: 999px;
  background: #edf4fb;
  color: #33506f;
  cursor: pointer;
  transition: 0.2s ease;
}

.typeChip.active {
  background: linear-gradient(135deg, #0ea5a4 0%, #2563eb 100%);
  color: #fff;
}

.presetPanel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.presetCard {
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.98), rgba(236, 253, 245, 0.92));
  cursor: pointer;
}

.presetCard strong {
  color: #123b74;
}

.presetCard p {
  margin-top: 10px;
  color: #587089;
  line-height: 1.7;
}

.actionRow {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.errorPanel {
  padding: 16px 18px;
  border-radius: 18px;
  background: #fff7ed;
  color: #9a3412;
}

.resultHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
}

.statusPill {
  padding: 10px 14px;
  border-radius: 999px;
  background: #eef3f8;
  color: #5d7087;
  font-weight: 600;
}

.statusPill.ready {
  background: rgba(33, 163, 113, 0.12);
  color: #19724f;
}

.resultBlock {
  margin-top: 22px;
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(249, 251, 254, 0.98), rgba(239, 245, 250, 0.94));
}

.blockTitle {
  font-size: 18px;
  font-weight: 700;
  color: #12233b;
}

.orderList,
.resourceGrid {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.orderList {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.orderCard,
.resourceCard {
  border-radius: 22px;
  background: #fff;
}

.orderCard {
  padding: 18px;
}

.orderCard span {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e0f2fe;
  color: #0f4aa1;
  font-weight: 700;
}

.orderCard strong {
  display: block;
  margin-top: 12px;
  color: #16304d;
}

.resourceGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.resourceCard {
  padding: 18px;
}

.resourceHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.resourceHead span {
  color: #0f766e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.resourceCard strong {
  display: block;
  margin-top: 14px;
  color: #17304b;
  font-size: 20px;
}

.resourceCard p {
  margin-top: 10px;
  color: #5e7187;
  line-height: 1.8;
}

.tagList {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.tagList em {
  padding: 6px 10px;
  border-radius: 999px;
  background: #ecfeff;
  color: #155e75;
  font-style: normal;
  font-size: 12px;
}

.suggestionBox {
  margin-top: 14px;
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
}

.suggestionBox span {
  font-size: 12px;
  color: #1d4ed8;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.suggestionBox p {
  margin-top: 8px;
}

.emptyState {
  margin-top: 16px;
  padding: 20px;
  border: 1px dashed #cad8e6;
  color: #6b7d92;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 20px;
}

@media screen and (max-width: 1280px) {
  .heroInner,
  .contentSection,
  .fieldGrid,
  .heroPanel,
  .presetPanel,
  .orderList,
  .resourceGrid {
    grid-template-columns: 1fr;
  }

  .resultHeader {
    flex-direction: column;
  }
}
</style>
