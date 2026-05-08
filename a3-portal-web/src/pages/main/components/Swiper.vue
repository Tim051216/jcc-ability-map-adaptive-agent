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
        <div class="slideCard" :style="{ background: item.background }">
          <div class="slideGlow"></div>
          <div class="content">
            <div class="eyebrow">{{ item.eyebrow }}</div>
            <div class="title">{{ item.title }}</div>
            <div class="desc">{{ item.desc }}</div>
            <div class="meta">{{ item.meta }}</div>
          </div>
          <div class="metricPanel">
            <div class="metricValue">A3</div>
            <div class="metricLabel">赛题化门户</div>
            <div class="metricHint">更适合答辩展示、项目讲解与功能演示验收</div>
          </div>
        </div>
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup>
import { Swiper, SwiperSlide } from "swiper/vue";
import { Autoplay, Pagination } from "swiper";

defineProps({
  data: {
    type: Array,
    default: () => [],
  },
});
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
