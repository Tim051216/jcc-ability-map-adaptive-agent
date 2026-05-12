<template>
  <div class="classCards" @click="goDetails(data.id)">
    <div class="cover" :style="coverStyle">
      <img v-if="showImage" :src="data.coverUrl" alt="" @error="handleImageError" />
      <div v-else class="fallbackCover">
        <div class="fallbackTag">{{ visual.tag }}</div>
        <div class="fallbackLabel">{{ visual.label }}</div>
        <div class="fallbackName">{{ data.name || "A3 智能学习专题" }}</div>
      </div>
      <div class="coverBadge">{{ priceText }}</div>
    </div>

    <div class="cardBody">
      <div class="title ft-16" v-html="data.name || 'A3 智能学习专题'"></div>

      <div class="teacherRow">
        <span class="teacherLabel">导师</span>
        <span class="teacherName">{{ data.teacher || "A3 教学团队" }}</span>
      </div>

      <div class="metaGrid">
        <div class="metaItem">
          <span class="metaLabel">章节</span>
          <span class="metaValue">{{ data.sections || 0 }}</span>
        </div>
        <div class="metaItem">
          <span class="metaLabel">学习人数</span>
          <span class="metaValue">{{ data.sold || 0 }}</span>
        </div>
      </div>

      <div class="footerRow">
        <div class="chip">{{ typeLabel }}</div>
        <div class="cta">查看详情</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import router from "../router";
import { getCourseVisual } from "@/utils/courseVisual";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  type: {
    type: String,
    default: "default",
  },
});

const imageFailed = ref(false);

const visual = computed(() => getCourseVisual(props.data));
const isUnsuitableBannerCover = computed(() => {
  const coverUrl = String(props.data?.coverUrl || "");
  return /banner\d+\.[a-z0-9]+$/i.test(coverUrl) || /\/assets\/banner\d+\./i.test(coverUrl);
});

const showImage = computed(() => Boolean(props.data?.coverUrl) && !imageFailed.value && !isUnsuitableBannerCover.value);
const coverStyle = computed(() => ({
  background: visual.value.gradient,
}));

const priceText = computed(() => {
  if (Number(props.data?.price || 0) === 0) {
    return "免费体验";
  }
  return `¥${(Number(props.data.price) / 100).toFixed(2)}`;
});

const typeLabelMap = {
  default: "精选课程",
  search: "搜索结果",
  like: "相似推荐",
};

const typeLabel = computed(() => typeLabelMap[props.type] || "课程推荐");

const handleImageError = () => {
  imageFailed.value = true;
};

const goDetails = (id) => {
  router.push({ path: "/details", query: { id } });
};
</script>

<style lang="scss" scoped>
.classCards {
  position: relative;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(209, 213, 219, 0.72);
  border-radius: 24px;
  cursor: pointer;
  transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
  backdrop-filter: blur(10px);

  &:hover {
    transform: translateY(-6px);
    border-color: rgba(59, 130, 246, 0.24);
    box-shadow: 0 22px 46px rgba(15, 23, 42, 0.12);
  }

  .cover {
    position: relative;
    height: 220px;
    overflow: hidden;

    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.24), transparent 30%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.04), rgba(15, 23, 42, 0.28));
      pointer-events: none;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .fallbackCover {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: 100%;
    padding: 20px;
    color: #fff;
  }

  .fallbackTag {
    width: fit-content;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(6px);
  }

  .fallbackLabel {
    margin-top: 18px;
    font-size: 40px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .fallbackName {
    margin-top: 12px;
    max-width: 90%;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.88);
  }

  .coverBadge {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 2;
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: rgba(15, 23, 42, 0.32);
    backdrop-filter: blur(8px);
  }

  .cardBody {
    padding: 20px;
  }

  .title {
    min-height: 52px;
    line-height: 1.6;
    font-weight: 700;
    color: #111827;

    :deep(em) {
      font-style: normal;
      color: #2563eb;
    }
  }

  .teacherRow {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }

  .teacherLabel {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    color: #0f766e;
    background: rgba(15, 118, 110, 0.1);
  }

  .teacherName {
    color: #4b5563;
    line-height: 1.6;
  }

  .metaGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .metaItem {
    padding: 12px 14px;
    border-radius: 16px;
    background: #f8fafc;
  }

  .metaLabel {
    display: block;
    font-size: 12px;
    color: #94a3b8;
  }

  .metaValue {
    display: block;
    margin-top: 6px;
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
  }

  .footerRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
  }

  .chip {
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 12px;
    color: #475569;
    background: #eef2ff;
  }

  .cta {
    color: #2563eb;
    font-weight: 700;
  }
}
</style>
