<template>
  <div class="classCards" @click="goDetails(data.id)">
    <div class="image">
      <img :src="data.coverUrl" alt="" />
    </div>
    <div class="pd-10">
      <div class="title marg-bt-10 ft-14" v-html="data.name"></div>
      <div v-if="type === 'default' || type === 'search'" class="ft-cl-des">
        <span>导师：</span>
        {{ data.teacher }}
      </div>
      <div v-if="type === 'default'" class="ft-cl-des">
        <span>共</span>
        {{ data.sections }}
        <span>节</span>
      </div>
      <div v-if="type === 'default'" class="ft-cl-des fx-sb">
        <span>{{ data.sold }} 人正在学习</span>
        <span v-if="Number(data.price) !== 0" class="ft-16 ft-cl-err">¥{{ (data.price / 100).toFixed(2) }}</span>
        <span v-else class="ft-16 ft-cl-err">免费</span>
      </div>
      <div v-if="type === 'search'" class="ft-cl-des fx-sb">
        <span>共 {{ data.sections || 0 }} 节<em>·</em> {{ data.sold }} 人正在学习</span>
        <span v-if="Number(data.price) !== 0" class="ft-16 ft-cl-err">¥{{ (Number(data.price) / 100).toFixed(2) }}</span>
        <span v-else class="ft-16 ft-cl-err">免费</span>
      </div>
      <div v-if="type === 'like'" class="ft-cl-des">
        <span>推荐指数：</span>
        4.9
      </div>
      <div v-if="type === 'like'" class="ft-cl-des fx-sb">
        <span>{{ data.sections }} 节内容</span>
        <span v-if="Number(data.price) !== 0" class="ft-16 ft-cl-err">¥{{ (Number(data.price) / 100).toFixed(2) }}</span>
        <span v-else class="ft-16 ft-cl-err">免费</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import router from "../router";

defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  type: {
    type: String,
    default: "default",
  },
});

const goDetails = (id) => {
  router.push({ path: "/details", query: { id } });
};
</script>

<style lang="scss" scoped>
.classCards {
  position: relative;
  width: 23%;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 8px;
  font-size: 12px;
  line-height: 24px;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 6px 2px rgba(108, 112, 118, 0.17);
    top: -3px;
  }

  .title {
    line-height: 22px;

    :deep(em) {
      font-style: normal;
      color: var(--color-main);
    }
  }

  .image {
    width: 100%;
    height: 160px;
    overflow: hidden;
    position: relative;

    .label {
      position: absolute;
      top: 10px;
      left: 10px;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.49);
      padding: 2px 5px;
      color: #fff;
      border-radius: 3px;
    }

    img {
      width: 100%;
      border-radius: 8px 8px 0 0;
    }
  }

  em {
    position: relative;
    top: -3px;
  }
}
</style>
