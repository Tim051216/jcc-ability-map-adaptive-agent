<template>
  <div class="Interest">
    <div class="head fx-sb">
      <TableSwitchBar :data="[...data]" @changeTable="checkHandle" />
      <div class="ft-14 font-bt">
        <span @click="changeHandle">调整方向</span>
      </div>
    </div>

    <div v-if="teacherInfo" class="classInfo fx">
      <div
        class="teacherInfo fx-1"
        :style="{ 'background-image': `url(${teacherInfo.coverUrl})` }"
      >
        <div class="info fx-sb">
          <div class="fx-al-ct fx-1">
            <img :src="teacherInfo.icon || '/img-tx/1.jpg'" alt="" />
            <span>导师：{{ teacherInfo.teacher }}</span>
          </div>
          <div @click="$router.push({ path: '/details', query: { id: teacherInfo.id } })">
            <span class="bt">加入学习</span>
          </div>
        </div>
      </div>

      <div class="classList fx-1 bg-wt">
        <div class="box">
          <div
            v-for="(item, index) in classList"
            :key="index"
            class="fx-sb item"
            @mouseover="teacherInfo = item"
            @click="$router.push({ path: '/details', query: { id: item.id } })"
          >
            <span class="title">{{ item.name }}</span>
            <span class="desc">共 {{ item.sections }} 节 <i>·</i> {{ item.sold }} 人在学</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="classInfo">
      <div class="nodata bg-wt fx-ct">
        <span>当前方向下暂无课程</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getClassList } from "@/api/class.js";
import TableSwitchBar from "@/components/TableSwitchBar.vue";

const props = defineProps({
  data: {
    type: Set,
    default: () => [],
  },
});

const emit = defineEmits(["setInterest"]);

const actId = ref();
const teacherInfo = ref({});
const classList = ref({});

onMounted(() => {
  const iterator = props.data[Symbol.iterator]();
  const first = iterator.next().value;
  if (!first?.id) {
    return;
  }
  actId.value = first.id;
  getClassListData(actId.value);
});

const checkHandle = (id) => {
  actId.value = id;
  getClassListData(id);
};

const changeHandle = () => {
  emit("setInterest", true);
};

const getClassListData = async (id) => {
  try {
    const res = await getClassList(id);
    if (res.code === 200) {
      classList.value = res.data || [];
      teacherInfo.value = classList.value[0] || null;
      return;
    }
    ElMessage({
      message: res.msg || "课程列表加载失败",
      type: "error",
    });
  } catch (error) {
    ElMessage({
      message: "课程列表加载失败",
      type: "error",
    });
  }
};
</script>

<style lang="scss" scoped>
.Interest {
  .head {
    .title {
      display: inline-block;
      margin-right: 20px;
      font-weight: 400;
      cursor: pointer;
    }

    .act {
      font-weight: 600;
      position: relative;

      &::before {
        position: absolute;
        content: "";
        width: 33px;
        height: 4px;
        border-radius: 4px;
        bottom: -8px;
        background: var(--color-main);
      }
    }
  }

  .classInfo {
    height: 331px;
    padding-top: 30px;
    margin-bottom: 40px;

    .teacherInfo {
      position: relative;
      background-size: cover;
      background-repeat: no-repeat;
      border-radius: 8px 0 0 8px;

      .info {
        background: rgba(0, 0, 0, 0.45);
        border-radius: 0 0 0 8px;
        padding: 20px;
        position: absolute;
        line-height: 30px;
        width: 100%;
        bottom: 0;
        color: #fff;

        img {
          width: 30px;
          height: 30px;
          border-radius: 100%;
          margin-right: 10px;
        }

        .bt {
          line-height: 32px;
          padding: 0 20px;
          font-size: 14px;
        }
      }
    }

    .classList {
      padding: 20px 21px 20px 18px;

      .box {
        height: 266px;
        overflow: hidden;
      }

      .item {
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;

        .desc {
          display: none;
          font-size: 12px;

          i {
            position: relative;
            font-size: 16px;
            top: -3px;
          }
        }

        &:hover {
          background-color: #f5f6f9;
          color: var(--color-main);
          font-weight: 600;

          .desc {
            display: block;
            color: var(--color-font3);
            font-weight: 400;
          }
        }
      }
    }

    .nodata {
      width: 100%;
      height: calc(100% - 0px);
      margin-top: 0px;
    }
  }
}
</style>
