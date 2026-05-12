<template>
  <div class="classCategory ft-14" :class="{ classCategoryHeader: type === 'float' }">
    <div class="categoryShell" @mouseleave="mouseoutHandle">
      <div class="items">
        <div
          v-for="item in safeData"
          :key="item.id"
          class="item"
          @mouseenter="mouseoverHandle(item)"
        >
          <div class="topRow fx-sb">
            <div class="primaryName" @click="goSearch('categoryIdLv1', item.id)">
              {{ item.name }}
            </div>
            <img src="@/assets/icon_more.png" alt="" />
          </div>
          <div class="desc ft-12">
            <span
              v-if="item.children?.length > 0"
              class="secondaryName"
              @click="goSearch('categoryIdLv2', item.children[0].id)"
            >
              {{ item.children[0].name }}
            </span>
            <span v-if="item.children?.length > 1"> / </span>
            <span
              v-if="item.children?.length > 1"
              class="secondaryName"
              @click="goSearch('categoryIdLv2', item.children[1].id)"
            >
              {{ item.children[1].name }}
            </span>
          </div>
        </div>
      </div>

      <div v-show="isDetails && activeCategory" class="allCategory">
        <div class="detailTitle">分类导航</div>
        <div class="detailLead">{{ activeCategory?.name }}</div>
        <div class="cont">
          <div class="detailRow">
            <span class="tit" @click="goSearch('categoryIdLv1', activeCategory?.id)">
              {{ activeCategory?.name }}
            </span>
            <div class="name fx-1">
              <span
                v-for="it in activeCategory?.children || []"
                :key="it.id"
                class="tag"
                @click="goSearch('categoryIdLv2', it.id)"
              >
                {{ it.name }}
              </span>
            </div>
          </div>
          <div v-if="(activeCategory?.children || []).length === 0" class="emptyTip">
            暂无更细分类，点击分类标题可查看该方向下的全部课程。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const isDetails = ref(false);
const activeCategory = ref(null);

const props = defineProps({
  data: {
    type: Array,
    default: () => [],
  },
  type: {
    type: String,
    default: "",
  },
});

// 过滤掉空数据，避免悬浮层在接口返回异常数据时出现空白。
const safeData = computed(() => (props.data || []).filter((item) => item && item.id != null));

const goSearch = (type, id) => {
  router.push({ path: "/search", query: { type, id } });
};

const mouseoverHandle = (item) => {
  if (!item) {
    return;
  }
  activeCategory.value = item;
  isDetails.value = true;
};

const mouseoutHandle = () => {
  isDetails.value = false;
};
</script>

<style lang="scss" scoped>
.classCategory,
.classCategoryHeader {
  position: relative;
  z-index: 12;

  .categoryShell {
    position: relative;
  }

  .items {
    height: 388px;
    overflow: hidden;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(10px);
  }

  .item {
    padding: 18px 18px 16px;
    min-height: 96px;
    border-bottom: 1px solid rgba(226, 232, 240, 0.92);
    transition: background 0.2s ease, transform 0.2s ease;

    img {
      width: 20px;
      height: 20px;
      opacity: 0.42;
    }

    &:hover {
      background: linear-gradient(90deg, rgba(37, 99, 235, 0.08), rgba(15, 118, 110, 0.04));
    }

    &:last-child {
      border-bottom: none;
    }
  }

  .topRow {
    align-items: center;
  }

  .primaryName {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    cursor: pointer;
  }

  .desc {
    padding-top: 10px;
    line-height: 1.7;
    color: #64748b;
  }

  .secondaryName {
    color: #64748b;
    cursor: pointer;

    &:hover {
      color: #2563eb;
    }
  }

  .allCategory {
    position: absolute;
    top: 0;
    left: calc(100% + 16px);
    z-index: 20;
    width: min(420px, calc(100vw - 320px));
    min-height: 220px;
    max-height: 388px;
    padding: 22px 24px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.97);
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.14);
    backdrop-filter: blur(12px);
  }

  .detailTitle {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }

  .detailLead {
    margin-top: 8px;
    font-size: 24px;
    font-weight: 800;
    color: #111827;
  }

  .cont {
    margin-top: 18px;
    max-height: 280px;
    overflow: auto;
  }

  .detailRow {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 14px;
  }

  .tit {
    min-width: 92px;
    font-weight: 700;
    color: #0f172a;
    cursor: pointer;
  }

  .name {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    color: #475569;
    background: #f8fafc;
    cursor: pointer;

    &:hover {
      color: #0f766e;
      background: #ecfeff;
    }
  }

  .emptyTip {
    padding: 14px 16px;
    border-radius: 16px;
    background: #f8fafc;
    color: #64748b;
    line-height: 1.7;
  }
}

.classCategoryHeader {
  .items {
    min-height: 388px;
    width: 236px;
    overflow: inherit;
  }
}

@media (max-width: 1100px) {
  .classCategory,
  .classCategoryHeader {
    .allCategory {
      left: 0;
      top: calc(100% + 14px);
      width: min(100%, 520px);
    }
  }
}
</style>
