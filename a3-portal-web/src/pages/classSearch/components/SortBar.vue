<template>
  <div class="sortBar">
    <span
      v-for="(item, index) in data"
      :key="index"
      :class="{ active: activeKey === item.value, checkBox: true }"
      class="font-bt3"
      @click="activeHandle(item.value)"
    >
      {{ item.key }}
    </span>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["sortHandle"]);
const activeKey = ref("all");

const activeHandle = (value) => {
  activeKey.value = value;
  emit("sortHandle", value);
};
</script>

<style lang="scss" scoped>
.sortBar {
  .checkBox {
    cursor: pointer;
    font-weight: 400;
    padding: 4px 14px;
    font-size: 14px;
    margin-right: 20px;
    border-radius: 20px;
  }

  .active {
    background: #2080f7;
    color: #fff;
    font-weight: 600;
    border-radius: 30px;
  }
}
</style>
