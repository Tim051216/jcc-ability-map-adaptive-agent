<template>
  <div class="catalogueWrapper">
    <el-collapse v-model="actIndex" accordion>
      <el-collapse-item v-for="item in data" :key="item.id" :name="item.id">
        <template #title>
          <div class="title">
            <span class="ft-wt-600">{{ item.name }}</span>
          </div>
        </template>
        <div
          v-for="section in item.sections"
          :key="section.id"
          class="subTitle fx-sb"
          :class="isPlay(item.id, section)"
        >
          <i :class="startIcon(section)" @click="play(section, section.type === 2 ? 1 : section.type)"></i>
          <div class="subTit fx-1">
            <span class="marg-rt-10" @click="play(section, section.type === 2 ? 1 : section.type)">
              {{ section.name }}
            </span>
            <span v-if="section.hasTest" class="chapter" @click="play(section, section.type === 2 ? 2 : section.type)">
              练习
            </span>
            <span v-if="section.trailer" class="trailer-font">试看</span>
          </div>
          <div>
            <span v-if="section.mediaDuration" @click="play(section, section.type === 2 ? 1 : section.type)">
              {{ formatDuration(section.mediaDuration) }}
            </span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { inject, onMounted, ref, watchEffect } from "vue";

const props = defineProps({
  data: {
    type: Array,
    default: () => [],
  },
  statusList: {
    type: Array,
    default: () => [],
  },
  playId: {
    type: String,
    default: "",
  },
  finished: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["sortHandle", "playHadle", "openCatalogue"]);
const currentPlayData = inject("currentPlayData");
const playId = ref(props.playId);
const actIndex = ref("");

const formatDuration = (seconds = 0) => {
  const min = Math.floor(seconds / 60);
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
};

onMounted(() => {
  props.data.forEach((chapter) => {
    chapter.sections.forEach((section) => {
      if (String(section.id) === String(props.playId)) {
        actIndex.value = chapter.id;
      }
    });
  });
});

watchEffect(() => {
  playId.value = currentPlayData.sectionId || props.playId;
  if (props.finished) {
    next();
  }
});

const isPlay = (chapterId, section) => {
  const active = playId.value === section.id;
  if (active) {
    emit("openCatalogue", chapterId);
    actIndex.value = chapterId;
  }
  return { playAct: active };
};

const startIcon = (item) => {
  if (item.type === 3) {
    return "iconfont zhy-a-ico-jdks2x";
  }
  if (item.finished === true) {
    return "iconfont zhy-a-ico-wc2x";
  }
  if (item.finished === false) {
    return "iconfont zhy-a-ico-502x1";
  }
  return "iconfont zhy-a-ico-sp-sei2x";
};

const play = (item, tp) => {
  playId.value = item.id;
  emit("playHadle", { item, tp });
};

const next = () => {
  const sections = props.data.flatMap((chapter) =>
    chapter.sections.map((section) => ({
      ...section,
      chapterId: chapter.id,
    })),
  );
  const currentIndex = sections.findIndex((item) => item.id === playId.value);
  const nextItem = currentIndex >= 0 ? sections[currentIndex + 1] : null;
  if (!nextItem) {
    emit("playHadle", { item: null, tp: 0 });
    return;
  }
  if (nextItem.type === 3) {
    emit("playHadle", { item: nextItem, tp: 2 });
    return;
  }
  playId.value = nextItem.id;
  emit("playHadle", { item: nextItem, tp: 1 });
};
</script>

<style lang="scss" scoped>
.catalogueWrapper {
  padding: 0 10px;

  ::deep(.el-collapse-item__header) {
    background: transparent;
  }

  .title {
    font-size: 16px;
    height: 40px;
    line-height: 40px;
    width: 280px;
    overflow: hidden;

    span {
      display: inline-block;
      height: 40px;
    }
  }

  .subTitle {
    position: relative;
    line-height: 20px;
    cursor: pointer;
    margin: 5px 0 20px 0;
    color: #a0a9b2;

    ::before {
      position: relative;
      z-index: 2;
    }

    ::after {
      content: "";
      position: absolute;
      left: 7px;
      top: 21px;
      border-left: 1px dashed #667280;
      height: calc(100% - 2px);
    }

    i {
      position: relative;
      top: 1px;
      margin-right: 4px;
    }

    .subTit {
      width: 230px;
      line-height: 20px;

      .chapter {
        display: inline-block;
        width: 32px;
        text-align: center;
        line-height: 15.5px;
        font-weight: 400;
        font-size: 12px;
        border-radius: 2px;
        background: #a0a9b2;
        color: #1b2127;
      }
    }

    &:hover {
      color: #fff;

      .chapter {
        background: #ffffff !important;
        color: #1b2127 !important;
      }
    }
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 5px;
  }

  .subTitle:last-child {
    margin-bottom: 0;

    ::after {
      display: none;
    }
  }

  .playAct {
    color: var(--color-main);

    ::after {
      border-color: var(--color-main);
    }

    .chapter {
      background: var(--color-main) !important;
      color: #ffffff !important;
    }
  }

  .trailer-font {
    padding: 3px 12px;
    font-size: 12px;
    border-radius: 12px;
    color: #f20d0d;
    font-weight: 700;
    line-height: 20px;
  }
}
</style>
