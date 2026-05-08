<template>
  <div class="classAbout">
    <div class="title">课程简介</div>
    <div class="marg-bt-20">
      {{ baseDetailsData.introduce || "围绕 A3 学习平台演示与课程学习场景展开。" }}
    </div>

    <div class="title">适学人群</div>
    <div class="marg-bt-20">
      {{ baseDetailsData.usePeople || "适合需要完成赛题化演示、页面验收与后续联调的团队成员。" }}
    </div>

    <div class="title">授课老师</div>
    <div class="classTeacher">
      <div class="navigat">
        <div class="prev"><span class="iconfont zhy-a-shouqi2x"></span></div>
        <div class="next"><span class="iconfont zhy-a-shouqi2x"></span></div>
      </div>
      <swiper
        :centeredSlides="true"
        :pagination="{ clickable: true }"
        :navigation="{ nextEl: '.next', prevEl: '.prev' }"
        :modules="[Navigation]"
        :space-between="20"
        :controller="{ control: secondSwiper }"
      >
        <swiper-slide v-for="(item, i) in baseClassTeacher" :key="i" class="swiper-slide">
          <div class="cards fx">
            <div v-for="(it, ind) in item" :key="ind" class="teacherInfo">
              <div class="teach">
                <img :src="it.icon || '/img-tx/default-user-icon.jpg'" alt="" />
                <div>
                  <div class="name">{{ it.name }}</div>
                  <div>{{ it.job || it.role }}</div>
                </div>
              </div>
              <div class="about">
                {{ it.introduce || it.intro }}
              </div>
            </div>
          </div>
        </swiper-slide>
      </swiper>
    </div>

    <div class="title">课程详情</div>
    <div class="marg-bt-20">
      {{ baseDetailsData.detail || "当前课程主要用于 A3 赛题演示和学习流程体验。" }}
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Navigation } from "swiper";
import { Swiper, SwiperSlide } from "swiper/vue";
import "swiper/css";
import "swiper/css/navigation";

defineProps({
  baseDetailsData: {
    type: Object,
    default: () => ({}),
  },
  baseClassTeacher: {
    type: Array,
    default: () => [],
  },
});

const secondSwiper = ref(null);
</script>

<style lang="scss" scoped>
.classAbout {
  margin-top: 40px;
  font-weight: 400;
  font-size: 14px;
  line-height: 30px;

  .title {
    font-weight: 600;
    font-size: 20px;
    margin: 10px 0;
  }

  .classTeacher {
    position: relative;
    margin-bottom: 30px;
    left: 50%;
    transform: translate(-50%);
    width: 795px;
    max-width: 1015px;
    min-width: 795px;
    margin-top: 20px;

    .teacherInfo {
      height: 255px;
      overflow: hidden;
      width: 50%;
      background-color: var(--color-background5);
      padding: 20px 30px;
      margin-right: 20px;
      border-radius: 8px;

      .teach {
        display: flex;
        margin-bottom: 10px;

        img {
          width: 64px;
          height: 64px;
          border-radius: 64px;
          margin-right: 15px;
        }

        .name {
          font-weight: 600;
        }
      }

      .about {
        font-size: 14px;
      }

      &:last-child {
        margin-right: 0;
      }
    }
  }

  .navigat {
    position: absolute;
    top: -40px;
    right: 0;

    .next,
    .prev {
      position: relative;
      display: inline-block;
      width: 21px;
      height: 21px;
      border-radius: 21px;
      margin-left: 17px;
      box-shadow: 0 0 10px rgba(211, 211, 211, 1);
      cursor: pointer;
      color: var(--color-main);

      span {
        position: relative;
        display: inline-block;
        left: 1px;
        top: -5px;
        width: 20px;
        height: 20px;
        font-size: 12px;
        text-align: center;
      }
    }

    .prev {
      transform: rotate(180deg);
    }

    .swiper-button-disabled {
      color: #e1eaf6;
    }
  }
}
</style>
