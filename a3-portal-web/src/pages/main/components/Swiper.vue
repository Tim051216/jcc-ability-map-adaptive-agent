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
      <swiper-slide class="swiper-slide" v-for="(item, i) in data" :key="i">
        <div class="slideCard" :style="{ background: item.background }">
          <div class="eyebrow">{{ item.eyebrow }}</div>
          <div class="title">{{ item.title }}</div>
          <div class="desc">{{ item.desc }}</div>
          <div class="meta">{{ item.meta }}</div>
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
  border-radius: 8px;
  overflow: hidden;

  .slideCard {
    height: 388px;
    border-radius: 8px;
    color: #fff;
    padding: 40px 42px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .eyebrow {
    display: inline-flex;
    width: fit-content;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    letter-spacing: 0.08em;
    background: rgba(255, 255, 255, 0.18);
  }

  .title {
    margin-top: 16px;
    font-size: 38px;
    line-height: 1.25;
    font-weight: 700;
    max-width: 560px;
  }

  .desc {
    margin-top: 16px;
    max-width: 560px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.88);
  }

  .meta {
    margin-top: 18px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.76);
  }

  :deep(.swiper) {
    border-radius: 8px;
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
