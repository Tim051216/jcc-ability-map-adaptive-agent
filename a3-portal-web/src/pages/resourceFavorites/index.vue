<template>
  <div class="studentModulePage">
    <section class="heroCard">
      <div>
        <div class="badge blue">资源收藏夹</div>
        <h1>资源收藏夹</h1>
        <p>
          统一查看学生已收藏的 AI 学习资源，支持按资源类型和来源标签筛选，方便在答辩时展示“生成 - 收藏 - 复用”的闭环。
        </p>
        <div class="heroFlow">
          <router-link class="flowButton" to="/main/ai-resources">返回资源中心</router-link>
          <router-link class="flowButton" to="/main/ai-path">查看学习路径</router-link>
          <router-link class="flowButton primary" to="/main/ai-report">查看学习报告</router-link>
        </div>
      </div>
      <el-button class="navButton" :loading="loading" @click="loadFavorites">刷新收藏</el-button>
    </section>

    <section class="contentGrid">
      <div class="card">
        <div class="sectionHeader">
          <h2>收藏资源</h2>
          <span class="metaText">共 {{ filteredFavorites.length }} 条</span>
        </div>

        <div v-if="filteredFavorites.length" class="favoriteList">
          <div v-for="item in filteredFavorites" :key="item.resource_id || item.title" class="favoriteCard">
            <div class="favoriteHead">
              <span>{{ formatResourceType(item.resource_type) }}</span>
              <el-button size="small" plain :disabled="!item.resource_id" @click="removeItem(item)">
                取消收藏
              </el-button>
            </div>
            <strong>{{ item.title || "学习资源" }}</strong>
            <p>{{ item.summary || "暂无摘要" }}</p>
            <div v-if="item.source_titles?.length" class="tagList">
              <em v-for="tag in item.source_titles" :key="tag">{{ tag }}</em>
            </div>
            <div v-if="item.study_suggestion" class="suggestionBox">
              <span>学习建议</span>
              <p>{{ item.study_suggestion }}</p>
            </div>
          </div>
        </div>

        <div v-else class="emptyState">
          当前没有匹配的收藏资源，可以先去资源中心生成并收藏一批资源。
        </div>
      </div>

      <div class="card">
        <h2>筛选标签</h2>
        <div class="tagButtonList">
          <button
            v-for="item in filterTags"
            :key="item"
            class="tagButton"
            :class="{ active: activeTag === item }"
            @click="activeTag = item"
          >
            {{ item }}
          </button>
        </div>
        <div v-if="errorMessage" class="errorState">
          {{ errorMessage }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { listAiFavoriteResources, unfavoriteAiResource } from "@/api/ai";
import { a3DemoScenario } from "@/mock/a3DemoData";
import { dedupeResources, listFavoriteResources, removeFavoriteResource } from "@/utils/a3StudentStore";

const RESOURCE_TYPE_LABELS = {
  lecture_notes: "课程讲义",
  practice_set: "分层练习",
  mind_map: "思维导图",
  case_study: "案例拆解",
  extended_reading: "延伸阅读",
};

const activeTag = ref("全部");
const favorites = ref([]);
const loading = ref(false);
const errorMessage = ref("");
const isLocalResourceId = (resourceId) => String(resourceId || "").startsWith("local::");

const formatResourceType = (resourceType) => RESOURCE_TYPE_LABELS[resourceType] || resourceType || "学习资源";

const filterTags = computed(() => {
  const tags = new Set(["全部"]);
  favorites.value.forEach((item) => {
    if (item.resource_type) {
      tags.add(formatResourceType(item.resource_type));
    }
    (item.source_titles || []).forEach((title) => tags.add(title));
  });
  return [...tags];
});

const filteredFavorites = computed(() => {
  if (activeTag.value === "全部") {
    return favorites.value;
  }
  return favorites.value.filter(
    (item) =>
      formatResourceType(item.resource_type) === activeTag.value ||
      (item.source_titles || []).includes(activeTag.value),
  );
});

const loadFavorites = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await listAiFavoriteResources({
      user_id: a3DemoScenario.userId,
      course_code: a3DemoScenario.courseCode,
    });
    favorites.value = dedupeResources([...(result.items || []), ...listFavoriteResources()]);
  } catch (error) {
    if (error?.response?.status === 404) {
      favorites.value = listFavoriteResources();
      return;
    }
    favorites.value = listFavoriteResources();
    errorMessage.value = error?.response?.data?.detail || error?.message || "收藏资源加载失败";
  } finally {
    loading.value = false;
  }
};

const removeItem = async (item) => {
  try {
    if (!isLocalResourceId(item.resource_id)) {
      await unfavoriteAiResource(item.resource_id, { user_id: a3DemoScenario.userId });
    }
    removeFavoriteResource(item);
    favorites.value = favorites.value.filter((favorite) => favorite.resource_id !== item.resource_id);
    ElMessage.success("已取消收藏");
  } catch (error) {
    removeFavoriteResource(item);
    favorites.value = favorites.value.filter((favorite) => favorite.resource_id !== item.resource_id);
    ElMessage.success("已取消收藏");
  }
};

onMounted(() => {
  loadFavorites();
});
</script>

<style scoped lang="scss">
.studentModulePage {
  min-height: 100vh;
  padding: 32px 24px 48px;
  background: linear-gradient(180deg, #f5f9ff 0%, #eef4fb 100%);
}

.heroCard,
.card {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 60px rgba(31, 58, 94, 0.1);
}

.heroCard {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-start;
  max-width: 1180px;
  margin: 0 auto 24px;
  padding: 28px 30px;
}

.badge.blue {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 700;
  font-size: 12px;
}

h1 {
  margin-top: 14px;
  color: #12233b;
  font-size: 38px;
}

p {
  margin-top: 12px;
  color: #5f7186;
  line-height: 1.8;
}

.heroFlow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.flowButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 700;
}

.flowButton.primary {
  background: #d1fae5;
  color: #166534;
}

.navButton {
  min-width: 150px;
  height: 44px;
  border-radius: 999px;
}

.contentGrid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 24px;
  max-width: 1180px;
  margin: 0 auto;
}

.card {
  padding: 26px;
}

.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h2 {
  color: #12233b;
  font-size: 24px;
}

.metaText {
  color: #64748b;
  font-size: 13px;
}

.favoriteList {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.favoriteCard {
  padding: 16px 18px;
  border-radius: 18px;
  background: #f7fafc;
}

.favoriteHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.favoriteCard span {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 12px;
}

.favoriteCard strong {
  display: block;
  margin-top: 12px;
  color: #12233b;
  font-size: 18px;
}

.tagList,
.tagButtonList {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.tagList em {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #475569;
  font-style: normal;
  font-size: 12px;
}

.tagButton {
  padding: 8px 12px;
  border: none;
  border-radius: 999px;
  background: #eef2ff;
  color: #334155;
  cursor: pointer;
}

.tagButton.active {
  background: #1d4ed8;
  color: #fff;
}

.suggestionBox {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.7), rgba(220, 252, 231, 0.55));
}

.suggestionBox span {
  background: none;
  color: #12233b;
  padding: 0;
  font-weight: 700;
}

.suggestionBox p {
  margin-top: 8px;
}

.emptyState,
.errorState {
  margin-top: 18px;
  padding: 18px;
  border-radius: 18px;
  color: #64748b;
}

.emptyState {
  background: #f8fafc;
}

.errorState {
  background: #fff1f2;
  color: #be123c;
}

@media (max-width: 1100px) {
  .heroCard,
  .contentGrid {
    grid-template-columns: 1fr;
  }

  .heroCard {
    flex-direction: column;
  }
}
</style>
