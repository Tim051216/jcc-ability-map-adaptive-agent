<template>
  <div class="search fx">
    <div class="tit">{{ data.title }}:</div>
    <div
      v-for="(item, index) in data.searchKeys"
      :key="index"
      :class="{ active: activeId === String(item.id), checkBox: true, 'font-bt1': true }"
      @click="activeHandle(item.id)"
    >
      {{ item.name }}
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  active: {
    type: String,
    default: "all",
  },
});

const activeId = ref(String(props.active));
const emit = defineEmits(["searchKey"]);

onMounted(() => {
  const items = props.data?.searchKeys || [];
  const current = items.filter((item) => String(item.id) === String(props.active));
  if (current.length === 0) {
    activeId.value = "all";
  }
});

watch(
  () => props.active,
  (value) => {
    activeId.value = String(value ?? "all");
  },
);

const activeHandle = (id) => {
  activeId.value = String(id);
  emit("searchKey", { key: props.data.subKey, value: id });
};
</script>

<style lang="scss" scoped>
.search {
  font-weight: 600;
  margin: 20px 0;
  line-height: 32px;

  .tit {
    width: 70px;
  }

  .checkBox {
    cursor: pointer;
    font-weight: 400;
    padding: 0 10px;
    margin: 0 20px;
  }

  .active {
    background: #d5e8ff;
    color: var(--color-main);
    font-weight: 600;
    border-radius: 4px;
  }
}
</style>
