<template>
  <div class="swiperWrapper fx-1">
    <swiper :modules="[Pagination]" :space-between="20" :pagination="{ clickable: true }">
      <swiper-slide v-for="(item, i) in data" :key="i" class="swiper-slide">
        <div class="banCard" :style="{ background: item.background }">
          <div class="copy">
            <div class="eyebrow">{{ item.eyebrow }}</div>
            <div class="title">{{ item.title }}</div>
            <div class="desc">{{ item.desc }}</div>
          </div>
          <div class="badge">{{ item.badge }}</div>
        </div>
      </swiper-slide>
    </swiper>
  </div>
</template>

<script setup>
import { Swiper, SwiperSlide } from "swiper/vue";
import { Pagination } from "swiper";

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

  .banCard {
    position: relative;
    display: flex;
    justify-content: space-between;
    height: 388px;
    padding: 40px;
    border-radius: 24px;
    color: #fff;
    overflow: hidden;

    &::after {
      content: "";
      position: absolute;
      inset: auto -40px -80px auto;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
    }
  }

  .copy {
    position: relative;
    z-index: 1;
    max-width: 70%;
  }

  .eyebrow {
    display: inline-flex;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    background: rgba(255, 255, 255, 0.16);
  }

  .title {
    margin-top: 18px;
    font-size: 40px;
    line-height: 1.25;
    font-weight: 800;
  }

  .desc {
    margin-top: 16px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.9);
  }

  .badge {
    position: relative;
    z-index: 1;
    align-self: flex-end;
    padding: 12px 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.14);
    backdrop-filter: blur(8px);
    font-weight: 700;
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
