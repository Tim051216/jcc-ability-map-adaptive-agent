<template>
  <div class="swiperWrapper fx-1">
    <swiper
      :modules="[Autoplay, Pagination]"
      :space-between="20"
      :autoplay="{
        delay: 5000,
        disableOnInteraction: false,
      }"
      :loop="true"
      :pagination="{ clickable: true }"
    >
      <swiper-slide v-for="(item, i) in data" :key="i" class="swiper-slide">
        <div
          class="slideCard"
          :class="{ clickable: Boolean(item.to) }"
          :style="{ background: item.background }"
          role="button"
          :tabindex="item.to ? 0 : -1"
          @click="handleJump(item)"
          @keydown.enter="handleJump(item)"
          @keydown.space.prevent="handleJump(item)"
        >
          <div class="slideGlow"></div>
          <div class="content">
            <div class="eyebrow">{{ item.eyebrow }}</div>
            <div class="title">{{ item.title }}</div>
            <div class="desc">{{ item.desc }}</div>
            <div class="meta">{{ item.meta }}</div>
            <div v-if="item.to" class="actionRow">
              <span class="actionText">{{ item.actionText || "进入对应功能" }}</span>
              <span class="actionArrow">-></span>
            </div>
          </div>
          <div class="metricPanel">
            <div class="metricValue">A3</div>
            <div class="metricLabel">赛题化学习入口</div>
            <div class="metricHint">更适合答辩展示、项目讲解和功能联调验收</div>
          </div>
        </div>
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup>
import { Swiper, SwiperSlide } from "swiper/vue";
import { Autoplay, Pagination } from "swiper";
import { useRouter } from "vue-router";

const router = useRouter();

defineProps({
  data: {
    type: Array,
    default: () => [],
  },
});

const handleJump = (item) => {
  if (!item?.to) {
    return;
  }
  router.push(item.to);
};
</script>

<style lang="scss" scoped>
.swiperWrapper {
  padding-left: 20px;
  border-radius: 24px;
  overflow: hidden;

  .slideCard {
    position: relative;
    display: flex;
    justify-content: space-between;
    gap: 24px;
    height: 388px;
    padding: 42px;
    border-radius: 24px;
    color: #fff;
    overflow: hidden;

    &.clickable {
      cursor: pointer;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 24px 44px rgba(16, 24, 40, 0.2);
      }
    }
  }

  .slideGlow {
    position: absolute;
    right: -60px;
    top: -40px;
    width: 280px;
    height: 280px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    filter: blur(6px);
  }

  .content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 62%;
  }

  .eyebrow {
    display: inline-flex;
    width: fit-content;
    padding: 7px 14px;
    border-radius: 999px;
    font-size: 12px;
    letter-spacing: 0.08em;
    background: rgba(255, 255, 255, 0.16);
    backdrop-filter: blur(6px);
  }

  .title {
    margin-top: 18px;
    font-size: 44px;
    line-height: 1.22;
    font-weight: 800;
  }

  .desc {
    margin-top: 16px;
    line-height: 1.9;
    font-size: 18px;
    color: rgba(255, 255, 255, 0.9);
  }

  .meta {
    margin-top: 24px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.78);
  }

  .actionRow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    width: fit-content;
    margin-top: 20px;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    backdrop-filter: blur(8px);
  }

  .actionText {
    font-size: 14px;
    font-weight: 700;
  }

  .actionArrow {
    font-size: 16px;
    font-weight: 800;
    line-height: 1;
  }

  .metricPanel {
    position: relative;
    z-index: 1;
    align-self: flex-end;
    width: 220px;
    padding: 22px 20px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }

  .metricValue {
    font-size: 56px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .metricLabel {
    margin-top: 10px;
    font-size: 16px;
    font-weight: 700;
  }

  .metricHint {
    margin-top: 12px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.82);
  }

  :deep(.swiper) {
    border-radius: 24px;
  }

  :deep(.swiper-pagination-bullet) {
    width: 28px;
    height: 5px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.5);
    opacity: 1;
  }

  :deep(.swiper-pagination-bullets, .swiper-pagination-bullets.swiper-pagination-horizontal) {
    bottom: 15px;
  }

  :deep(.swiper-pagination-bullet-active) {
    background-color: #fff;
  }
}
</style>
