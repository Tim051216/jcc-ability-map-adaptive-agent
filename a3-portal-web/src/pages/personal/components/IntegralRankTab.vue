<template>
  <div class="integralRankTab">
    <div class="item head fx-sb">
      <span>&#x6392;&#x540D;</span>
      <span class="ct">&#x59D3;&#x540D;</span>
      <span>&#x79EF;&#x5206;</span>
    </div>
    <div class="item myItem fx-sb">
      <span>{{ data.rank || "--" }}</span>
      <span class="ct">&#x6211;</span>
      <span>{{ data.points || "--" }}</span>
    </div>
    <div v-if="data.boardList">
      <div v-for="(item, index) in data.boardList" :key="index" class="item fx-sb">
        <img v-if="index <= 2" :src="ranking(index + 1)" alt="" />
        <span v-else class="lt">{{ ranking(index + 1) }}</span>
        <span class="ct">{{ item.name || "--" }}</span>
        <span>{{ item.points }}</span>
      </div>
    </div>
    <div v-else class="onData">
      <Empty />
    </div>
  </div>
</template>

<script setup>
import Empty from "@/components/Empty.vue";
import rank1 from "@/assets/icon_rank1.png";
import rank2 from "@/assets/icon_rank2.png";
import rank3 from "@/assets/icon_rank3.png";

const ranks = [rank1, rank2, rank3];

const ranking = (num) => (num <= 3 ? ranks[num - 1] : num);

defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  type: {
    type: Boolean,
    default: false,
  },
});
</script>

<style lang="scss" scoped>
.integralRankTab {
  border: solid 1px #eeeeee;
  height: calc(100% - 86.7px);

  .item {
    padding: 0 30px;
    line-height: 40px;
    height: 41px;
    font-weight: 400;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: solid 1px #eeeeee;

    img {
      width: 40px;
      height: 40px;
    }

    span:first-child {
      display: inline-block;
      text-align: center;
      width: 40px;
    }

    span:last-child {
      display: inline-block;
      text-align: center;
      width: 40px;
    }

    .ct {
      flex: 1;
      display: inline-block;
      text-align: center;
      width: 120px;
    }
  }

  .item:last-child {
    border-bottom: solid 1px #eeeeee;
  }

  .item:nth-child(10) {
    border-bottom: none;
  }

  .head {
    height: 60px;
    line-height: 60px;
    font-weight: 600;
  }

  .myItem {
    line-height: 40px;
    background: #ecf4ff;
    color: var(--color-main);
  }

  .onData {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    height: calc(100% - 100px);
  }
}

.fxTab {
  .item:last-child {
    border-bottom: none;
  }
}
</style>
