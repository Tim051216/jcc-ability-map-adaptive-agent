<template>
  <div class="like bg-wt">
    <div class="title">猜你喜欢</div>
    <div class="likeCards">
      <ClassCards
        v-for="(item, index) in data"
        :key="index"
        :data="item"
        class="marg-bt-20"
        style="width: 100%"
        type="like"
      />
    </div>
  </div>
</template>

<script setup>
import ClassCards from "@/components/ClassCards.vue";

defineProps({
  data: {
    type: Array,
    default: () => [],
  },
});
</script>

<style lang="scss" scoped>
.like {
  padding: 30px;
  border-radius: 8px;

  .title {
    font-weight: 600;
    font-size: 20px;
    margin-bottom: 10px;
  }

  .likeCards {
    .title {
      font-size: 14px;
      font-weight: 400;
      margin-bottom: 20px;
    }
  }
}
</style>
