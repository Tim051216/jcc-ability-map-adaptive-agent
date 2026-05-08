<template>
  <div v-for="(item, index) in data" :key="index" class="couponCards fx">
    <div v-if="[1, 3, 4].includes(item.discountType)" class="price ft-cl-wt">
      <div>&yen;<em>{{ item.discountValue / 100 }}</em></div>
      <div class="desc">{{ item.rule }}</div>
    </div>
    <div v-if="[2, 5].includes(item.discountType)" class="price ft-cl-wt">
      <div><em>{{ item.discountValue / 10 }}</em> &#x6298;</div>
      <div class="desc">{{ item.rule }}</div>
    </div>
    <div class="info">
      <div class="tit">{{ item.name }}</div>
      <div><em>&#x9002;&#x7528;&#x8303;&#x56F4;&#xFF1A;</em>{{ item.specific ? "&#x9650;&#x5B9A;&#x5206;&#x7C7B;&#x8BFE;&#x7A0B;" : "&#x5168;&#x90E8;&#x8BFE;&#x7A0B;" }}</div>
      <div><em>&#x6709;&#x6548;&#x671F;&#xFF1A;</em>{{ item.termDays ? `${item.termDays} 天` : moment(item.termEndTime).format("YYYY-MM-DD HH:mm:ss") }}</div>
    </div>
    <div v-if="type === 1" class="butCont fx-ct">
      <span class="bt" @click="$router.push({ path: '/classList/index' })">&#x53BB;&#x4F7F;&#x7528;</span>
    </div>
  </div>
</template>

<script setup>
import moment from "moment";

defineProps({
  data: {
    type: Array,
    default: () => [],
  },
  type: {
    type: Number,
    default: 1,
  },
});
</script>

<style lang="scss" scoped>
.couponCards {
  width: calc(50% - 18px);
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-left: none;
  border-radius: 8px;
  margin-bottom: 30px;
  margin-right: 35px;

  &:nth-child(2n) {
    margin-right: 0;
  }

  .price {
    width: 138px;
    height: 124px;
    background: url("@/assets/bg_yhq1.png") left center no-repeat;
    background-size: cover;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-weight: 400;
    font-size: 12px;

    em {
      font-style: normal;
      font-family: PingFangSC-Semibold;
      font-weight: 600;
      font-size: 42px;
    }

    .desc {
      padding: 0 15px;
      text-align: center;
    }
  }

  .info {
    display: flex;
    padding-left: 25px;
    text-align: left;
    flex-direction: column;
    justify-content: center;
    font-size: 12px;
    flex: 1;
    line-height: 28px;

    .tit {
      font-weight: 500;
      font-size: 18px;
      margin-bottom: 15px;
    }

    em {
      font-style: normal;
      color: var(--color-font3);
    }
  }

  .butCont {
    padding-right: 20px;

    span {
      font-size: 12px;
      min-width: 80px;
      text-align: center;
      padding: 0 15px;
      height: 28px;
      line-height: 28px;
      border-radius: 28px;
    }
  }
}
</style>
