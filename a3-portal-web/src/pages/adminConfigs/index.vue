<template>
  <div class="adminSimplePage">
    <section class="pageCard">
      <div class="pageHead">
        <div>
          <div class="badge amber">系统配置</div>
          <h1>系统配置与变更记录</h1>
          <p>
            管理演示环境关键配置项，支持新增、更新、敏感项筛选，以及查看配置变更历史与前后值对比。
          </p>
        </div>
        <div class="headActions">
          <router-link class="backButton" to="/main/ai-admin">返回管理总览</router-link>
          <el-button :loading="loading" @click="loadAll">刷新数据</el-button>
          <el-button type="primary" @click="openEditor()">新增配置</el-button>
        </div>
      </div>

      <div class="summaryGrid">
        <div class="summaryCard">
          <span>配置项数量</span>
          <strong>{{ configs.length }}</strong>
        </div>
        <div class="summaryCard accent">
          <span>敏感配置项</span>
          <strong>{{ sensitiveCount }}</strong>
        </div>
        <div class="summaryCard accent">
          <span>历史记录数</span>
          <strong>{{ filteredHistoryItems.length }}</strong>
        </div>
      </div>

      <div class="sectionHead">
        <div>
          <h2>配置列表</h2>
          <p class="sectionDesc">支持按配置键筛选，并快速聚焦敏感配置。</p>
        </div>
      </div>

      <div class="toolbar configToolbar">
        <el-input
          v-model="configKeyword"
          clearable
          placeholder="筛选配置键，例如 rag_top_k"
        />
        <el-switch
          v-model="configSensitiveOnly"
          inline-prompt
          active-text="仅敏感"
          inactive-text="全部"
        />
      </div>

      <div v-if="filteredConfigs.length" class="configGrid">
        <div v-for="item in filteredConfigs" :key="item.config_key" class="configCard">
          <div class="rowHead">
            <div>
              <strong>{{ item.config_key }}</strong>
              <p>{{ item.description || "暂无说明" }}</p>
            </div>
            <span class="tag" :class="item.is_sensitive ? 'warn' : 'ok'">
              {{ item.is_sensitive ? "敏感配置" : "普通配置" }}
            </span>
          </div>

          <div class="valueBox">
            {{ item.config_value || "--" }}
            <span v-if="item.is_sensitive" class="maskTip">敏感值已脱敏展示</span>
          </div>

          <div class="metaGrid">
            <div>更新人：{{ item.updated_by || "--" }}</div>
            <div>更新时间：{{ item.updated_at || "--" }}</div>
          </div>

          <div class="actionRow">
            <el-button size="small" plain @click="openEditor(item)">编辑配置</el-button>
            <router-link :to="{ path: '/main/ai-admin-logs', query: { scene: 'system_config', action: 'system_config_updated' } }">
              查看审计日志
            </router-link>
          </div>
        </div>
      </div>
      <div v-else class="emptyState">当前筛选条件下没有配置项。</div>

      <div class="sectionHead historyHead">
        <div>
          <h2>变更历史</h2>
          <p class="sectionDesc">支持按配置键、更新人筛选，并查看新旧值对比。</p>
        </div>
      </div>

      <div class="toolbar historyToolbar">
        <el-input
          v-model="historyConfigKey"
          clearable
          placeholder="按配置键筛选历史，例如 planner_daily_task_limit"
        />
        <el-input
          v-model="historyUpdatedBy"
          clearable
          placeholder="按更新人筛选历史，例如 运营管理员"
        />
        <el-switch
          v-model="historySensitiveOnly"
          inline-prompt
          active-text="仅敏感"
          inactive-text="全部"
        />
        <el-button :loading="historyLoading" plain @click="loadHistory">刷新历史</el-button>
      </div>

      <div v-if="filteredHistoryItems.length" class="historyList">
        <div
          v-for="item in filteredHistoryItems"
          :key="`${item.config_key}-${item.created_at}`"
          class="historyCard"
        >
          <div class="rowHead">
            <div>
              <strong>{{ item.config_key }}</strong>
              <p>{{ formatAction(item.action) }}</p>
            </div>
            <span class="tag neutral">{{ item.updated_by || "未记录更新人" }}</span>
          </div>

          <div class="compareGrid">
            <div class="compareCard">
              <span>旧值</span>
              <div class="valueBox compact">{{ getHistoryValue(item.payload, "old_value") }}</div>
            </div>
            <div class="compareCard">
              <span>新值</span>
              <div class="valueBox compact">{{ getHistoryValue(item.payload, "new_value") }}</div>
            </div>
          </div>

          <div class="metaGrid">
            <div>变更时间：{{ item.created_at || "--" }}</div>
            <div>敏感标记：{{ item.is_sensitive ? "是" : "否" }}</div>
          </div>

          <div class="historySummary">{{ formatHistoryPayload(item.payload) }}</div>

          <div class="actionRow">
            <el-button size="small" plain @click="openHistoryDetail(item)">查看详情</el-button>
          </div>
        </div>
      </div>
      <div v-else class="emptyState">当前筛选条件下没有系统配置变更记录。</div>
    </section>

    <el-dialog v-model="editorVisible" :title="formMode === 'create' ? '新增配置' : '编辑配置'" width="640px">
      <el-form label-width="96px">
        <el-form-item label="配置键">
          <el-input v-model="form.configKey" :disabled="formMode === 'edit'" placeholder="例如 rag_top_k" />
        </el-form-item>
        <el-form-item label="配置值">
          <el-input
            v-model="form.value"
            type="textarea"
            :rows="4"
            :placeholder="form.isSensitive ? '敏感配置请输入新的完整值' : '请输入配置值'"
          />
        </el-form-item>
        <el-form-item label="配置说明">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="补充该配置的用途说明" />
        </el-form-item>
        <el-form-item label="更新人">
          <el-input v-model="form.updatedBy" placeholder="例如 运营管理员" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitConfig">保存配置</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="historyDetailVisible" title="配置变更详情" size="760px" destroy-on-close>
      <div v-if="historyDetail" class="detailWrap">
        <div class="detailHero">
          <div>
            <h3>{{ historyDetail.config_key }}</h3>
            <p>{{ formatAction(historyDetail.action) }}</p>
          </div>
          <span class="tag neutral">{{ historyDetail.updated_by || "未记录更新人" }}</span>
        </div>

        <div class="metaGrid">
          <div>变更时间：{{ historyDetail.created_at || "--" }}</div>
          <div>敏感标记：{{ historyDetail.is_sensitive ? "是" : "否" }}</div>
        </div>

        <div class="compareGrid">
          <div class="compareCard">
            <span>旧值</span>
            <div class="valueBox compact">{{ getHistoryValue(historyDetail.payload, "old_value") }}</div>
          </div>
          <div class="compareCard">
            <span>新值</span>
            <div class="valueBox compact">{{ getHistoryValue(historyDetail.payload, "new_value") }}</div>
          </div>
        </div>

        <pre class="payloadPre">{{ formatPayloadJson(historyDetail.payload) }}</pre>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { listAiSystemConfigHistory, listAiSystemConfigs, updateAiSystemConfig } from "@/api/ai";
import { useRoute } from "vue-router";

const ADMIN_DATA_UPDATED_EVENT = "a3-admin-data-updated";

const loading = ref(false);
const saving = ref(false);
const historyLoading = ref(false);
const editorVisible = ref(false);
const historyDetailVisible = ref(false);
const formMode = ref("create");
const configs = ref([]);
const historyItems = ref([]);
const historyDetail = ref(null);
const configKeyword = ref("");
const historyConfigKey = ref("");
const historyUpdatedBy = ref("");
const configSensitiveOnly = ref(false);
const historySensitiveOnly = ref(false);
const route = useRoute();

const form = reactive({
  configKey: "",
  value: "",
  description: "",
  updatedBy: "运营管理员",
  isSensitive: false,
});

const sensitiveCount = computed(() => configs.value.filter((item) => item.is_sensitive).length);

const filteredConfigs = computed(() => {
  const keyword = configKeyword.value.trim().toLowerCase();
  return configs.value.filter((item) => {
    if (configSensitiveOnly.value && !item.is_sensitive) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    return item.config_key?.toLowerCase().includes(keyword);
  });
});

const filteredHistoryItems = computed(() =>
  historyItems.value.filter((item) => (historySensitiveOnly.value ? item.is_sensitive : true))
);

const applyRouteFilters = () => {
  const query = route.query || {};
  configKeyword.value = query.configKey ? String(query.configKey) : "";
  historyConfigKey.value = query.historyKey ? String(query.historyKey) : query.configKey ? String(query.configKey) : "";
};

const syncRouteSelection = () => {
  const historyKey = route.query.historyKey ? String(route.query.historyKey) : "";
  if (!historyKey) {
    return;
  }
  const matched = historyItems.value.find((item) => String(item.config_key) === historyKey);
  if (matched) {
    openHistoryDetail(matched);
  }
};

const loadConfigs = async () => {
  const result = await listAiSystemConfigs({ sensitive_only: configSensitiveOnly.value || undefined });
  configs.value = result.items || [];
};

const loadHistory = async () => {
  historyLoading.value = true;
  try {
    const result = await listAiSystemConfigHistory({
      config_key: historyConfigKey.value || undefined,
      updated_by: historyUpdatedBy.value || undefined,
    });
    historyItems.value = result.items || [];
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "配置历史加载失败");
  } finally {
    historyLoading.value = false;
  }
  syncRouteSelection();
};

const loadAll = async () => {
  loading.value = true;
  try {
    await Promise.all([loadConfigs(), loadHistory()]);
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "系统配置数据加载失败");
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  form.configKey = "";
  form.value = "";
  form.description = "";
  form.updatedBy = "运营管理员";
  form.isSensitive = false;
};

const openEditor = (item = null) => {
  resetForm();
  if (item) {
    formMode.value = "edit";
    form.configKey = item.config_key;
    form.description = item.description || "";
    form.updatedBy = item.updated_by || "运营管理员";
    form.isSensitive = !!item.is_sensitive;
  } else {
    formMode.value = "create";
  }
  editorVisible.value = true;
};

const openHistoryDetail = (item) => {
  historyDetail.value = item;
  historyDetailVisible.value = true;
};

const submitConfig = async () => {
  if (!form.configKey.trim()) {
    ElMessage.warning("请先填写配置键");
    return;
  }
  if (!form.value.trim()) {
    ElMessage.warning("请先填写配置值");
    return;
  }
  saving.value = true;
  try {
    await updateAiSystemConfig(form.configKey.trim(), {
      value: form.value,
      description: form.description || undefined,
      updated_by: form.updatedBy || "运营管理员",
    });
    ElMessage.success("系统配置已保存");
    editorVisible.value = false;
    window.dispatchEvent(new CustomEvent(ADMIN_DATA_UPDATED_EVENT, { detail: { source: "configs" } }));
    await loadAll();
  } catch (error) {
    ElMessage.error(error?.response?.data?.detail || error?.message || "保存失败");
  } finally {
    saving.value = false;
  }
};

const formatAction = (action) => {
  if (action === "system_config_updated") {
    return "配置已更新";
  }
  return action || "未命名动作";
};

const getHistoryValue = (payload, field) => {
  const value = payload?.[field];
  if (value === undefined || value === null || value === "") {
    return "--";
  }
  return typeof value === "object" ? JSON.stringify(value) : value;
};

const formatHistoryPayload = (payload) => {
  if (!payload || !Object.keys(payload).length) {
    return "无附加信息";
  }
  return Object.entries(payload)
    .filter(([key]) => !["description", "old_value", "new_value"].includes(key))
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join(" | ");
};

const formatPayloadJson = (payload) => {
  if (!payload || !Object.keys(payload).length) {
    return "暂无载荷";
  }
  return JSON.stringify(payload, null, 2);
};

watch(
  () => route.query,
  async () => {
    applyRouteFilters();
    await loadAll();
  }
);

onMounted(async () => {
  applyRouteFilters();
  await loadAll();
});
</script>

<style scoped lang="scss">
.adminSimplePage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #eef4fb 0%, #f8fbff 100%);
}

.pageCard {
  max-width: 1220px;
  margin: 0 auto;
  padding: 28px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.1);
}

.pageHead,
.headActions,
.sectionHead,
.rowHead,
.actionRow,
.detailHero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.badge {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.badge.amber {
  background: #fef3c7;
  color: #b45309;
}

h1 {
  margin-top: 14px;
  font-size: 36px;
  color: #12233b;
}

h2,
h3 {
  color: #12233b;
}

p {
  margin-top: 12px;
  color: #5f7186;
  line-height: 1.8;
}

.backButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  background: #123b74;
  color: #fff;
  font-weight: 700;
}

.summaryGrid,
.configGrid,
.metaGrid,
.toolbar,
.compareGrid {
  display: grid;
  gap: 16px;
}

.summaryGrid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 24px;
}

.configToolbar {
  grid-template-columns: minmax(0, 1fr) auto;
  margin-top: 18px;
}

.historyToolbar {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
  margin-top: 18px;
}

.summaryCard,
.configCard,
.historyCard {
  border-radius: 22px;
  background: #f8fbff;
}

.summaryCard {
  padding: 18px 20px;
}

.summaryCard span {
  display: block;
  color: #6b7b90;
  font-size: 13px;
}

.summaryCard strong {
  display: block;
  margin-top: 10px;
  color: #12233b;
  font-size: 28px;
}

.summaryCard.accent {
  background: #ecfeff;
}

.sectionDesc {
  margin-top: 8px;
}

.configGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 18px;
}

.configCard,
.historyCard {
  padding: 18px;
}

.configCard strong,
.historyCard strong {
  font-size: 18px;
  color: #12233b;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.tag.ok {
  background: #dcfce7;
  color: #15803d;
}

.tag.warn {
  background: #fef3c7;
  color: #b45309;
}

.tag.neutral {
  background: #e2e8f0;
  color: #475569;
}

.valueBox,
.payloadPre,
.historySummary {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: #f1f5f9;
  color: #42556d;
  line-height: 1.7;
  word-break: break-word;
}

.valueBox.compact {
  min-height: 72px;
  margin-top: 8px;
}

.maskTip {
  display: inline-block;
  margin-left: 10px;
  color: #b45309;
  font-size: 12px;
  font-weight: 600;
}

.metaGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
  color: #6b7b90;
  font-size: 13px;
}

.compareGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 14px;
}

.compareCard {
  padding: 14px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.compareCard span {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.historyHead {
  margin-top: 30px;
}

.historyList {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.actionRow {
  margin-top: 16px;
}

.emptyState {
  margin-top: 18px;
  padding: 18px;
  border-radius: 18px;
  background: #f8fafc;
  color: #64748b;
}

.detailWrap {
  display: grid;
  gap: 18px;
}

.payloadPre {
  white-space: pre-wrap;
}

@media (max-width: 1100px) {
  .pageHead,
  .headActions,
  .sectionHead,
  .rowHead,
  .detailHero {
    flex-direction: column;
  }

  .summaryGrid,
  .configGrid,
  .metaGrid,
  .compareGrid,
  .configToolbar,
  .historyToolbar {
    grid-template-columns: 1fr;
  }
}
</style>
