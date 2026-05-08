<template>
  <div class="chapterItems fx-sb">
    <div class="items fx-wp fx-1" :class="{ open: !isOpen }">
      <div
        v-for="item in data"
        :key="item.id"
        class="item"
        :class="{ act: item.id === actChapterId }"
        @click="getAskHandle(item.id)"
      >
        {{ item.index }}
      </div>
    </div>
    <div class="openHandle" @click="openHandle">
      {{ isOpen ? "展开" : "收起" }}
      <iconOpen class="icon" :class="{ 'icon-open': isOpen }" />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import iconOpen from "@/assets/icon_open.svg";

const emit = defineEmits(["checkCahpter"]);

defineProps({
  data: {
    type: Array,
    default: () => [],
  },
});

const actChapterId = ref("");
const isOpen = ref(true);

const getAskHandle = (id) => {
  actChapterId.value = id;
  emit("checkCahpter", id);
};

const openHandle = () => {
  isOpen.value = !isOpen.value;
};
</script>

<style lang="scss" scoped>
.chapterItems {
  line-height: 36px;

  .items {
    justify-content: flex-start;
    height: 40px;
    overflow: hidden;
    position: relative;
    transition: 100ms;
    left: -5px;
  }

  .open {
    height: auto;
  }

  .item {
    margin: 5px;
    border: 1px solid var(--color-main);
    border-radius: 4px;
    color: var(--color-main);
    font-size: 14px;
    width: 50px;
    height: 26px;
    text-align: center;
    line-height: 24px;
    cursor: pointer;
  }

  .act {
    color: var(--color-white);
    background-color: var(--color-main);
  }

  .openHandle {
    font-size: 14px;
    cursor: pointer;

    .icon-open {
      transform: rotate(180deg);
    }

    .icon {
      transition: 100ms;
      position: relative;
      top: 3px;
    }
  }
}
</style>
