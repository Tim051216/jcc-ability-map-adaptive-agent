<template>
  <div class="classCategory ft-14" :class="{ classCategoryHeader: type === 'float' }">
    <div @mouseleave="mouseoutHandle">
      <div class="items">
        <div
          v-for="item in data"
          :key="item.id"
          class="item"
          @mouseover="mouseoverHandle(item.children)"
        >
          <div class="topRow fx-sb">
            <div
              class="primaryName"
              @click="() => $router.push({ path: '/search', query: { type: 'categoryIdLv1', id: item.id } })"
            >
              {{ item.name }}
            </div>
            <img src="@/assets/icon_more.png" alt="" />
          </div>
          <div class="desc ft-12">
            <span
              v-if="item.children?.length > 0"
              class="secondaryName"
              @click="() => $router.push({ path: '/search', query: { type: 'categoryIdLv2', id: item.children[0].id } })"
            >
              {{ item.children[0].name }}
            </span>
            <span v-if="item.children?.length > 1"> / </span>
            <span
              v-if="item.children?.length > 1"
              class="secondaryName"
              @click="() => $router.push({ path: '/search', query: { type: 'categoryIdLv2', id: item.children[1].id } })"
            >
              {{ item.children[1].name }}
            </span>
          </div>
        </div>
      </div>

      <div v-show="isDetails" class="allCategory" @mouseover="mouseoverHandle()">
        <div class="detailTitle">专题方向总览</div>
        <div class="cont">
          <div v-for="item in categorys" :key="item.id" class="detailRow">
            <span
              class="tit"
              @click="() => $router.push({ path: '/search', query: { type: 'categoryIdLv2', id: item.id } })"
            >
              {{ item.name }}
            </span>
            <div class="name fx-1">
              <span
                v-for="it in item.children"
                :key="it.id"
                class="tag"
                @click="() => $router.push({ path: '/search', query: { type: 'categoryIdLv3', id: it.id } })"
              >
                {{ it.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const isDetails = ref(false);

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

const categorys = ref([]);

const mouseoverHandle = (item) => {
  if (item) {
    categorys.value = item;
  }
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
    left: 252px;
    width: 560px;
    height: 388px;
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

  .cont {
    margin-top: 18px;
    height: 320px;
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
}

.classCategoryHeader {
  .items {
    min-height: 388px;
    width: 236px;
    overflow: inherit;
  }
}
</style>
