<template>
  <div class="classList">
    <el-collapse v-model="activeNames" accordion>
      <el-collapse-item v-for="(item, index) in data" :key="item.id || index" :name="index">
        <template #title>
          <div class="fx-sb">
            <span>{{ item.name }}</span>
            <span class="time">{{ formatDuration(item.mediaDuration) }}</span>
          </div>
        </template>
        <div
          v-for="(it, ind) in item.sections"
          :key="it.id || ind"
          class="item fx-sb"
          @click="playHandle($props.id, it)"
        >
          <div>
            <iconVideo v-if="it.type === 2" class="icon" />
            <iconJdks v-if="it.type === 3" class="icon" />
            {{ it.index }}. {{ it.name }}
          </div>
          <div class="time">
            <span v-if="it.trailer" class="trailer-font">试看</span>
            {{ formatDuration(it.mediaDuration) }}
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import iconVideo from "@/assets/ico-video.svg";
import iconJdks from "@/assets/ico-jdks.svg";

const router = useRouter();

const props = defineProps({
  data: {
    type: Array,
    default: () => [],
  },
  id: {
    type: String,
    default: "",
  },
  isSignUp: {
    type: Boolean,
    default: false,
  },
});

const activeNames = ref([0]);

const formatDuration = (seconds = 0) => {
  const mins = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${mins}.${remain}`;
};

const playHandle = (courseId, section) => {
  if (!section.trailer && !props.isSignUp) {
    ElMessage("该章节暂不支持试看，请加入学习后继续播放");
    return;
  }
  router.push({ path: "/learning/index", query: { id: courseId, sectionId: section.id } });
};
</script>

<style lang="scss" scoped>
.trailer-font {
  padding: 3px 12px;
  font-size: 12px;
  background: rgba(242, 13, 13, 0.1);
  border-radius: 12px;
  color: #f20d0d;
  font-weight: 700;
  line-height: 20px;
}

.trailer-font:hover {
  color: #fff;
  background: #f20d0d;
}

.classList {
  padding-top: 16px;

  .time {
    font-size: 14px;
    color: #80878c;
    font-weight: 400;
    padding-right: 20px;
    line-height: 50px;
  }

  .item {
    font-size: 16px;
    line-height: 50px;
    padding: 0 20px;
    cursor: pointer;

    .time {
      padding-right: 0;
    }

    .icon {
      position: relative;
      top: 3px;
      width: 16px;
      height: 16px;
      margin-right: 10px;
    }
  }

  :deep(.el-collapse-item__header) {
    background: #f5f6f9;
    color: var(--color-font1);
    border: none;
    border-radius: 8px;
    margin: 20px 0;
    font-weight: 600;
    font-size: 18px;
    padding: 0 10px 0 25px;
  }

  :deep(.el-collapse) {
    border: none;
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 0;
    font-size: 14px;
  }
}
</style>
