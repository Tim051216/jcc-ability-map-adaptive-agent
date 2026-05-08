<template>
  <div class="classCards fx-sb fx-ct">
    <div class="marg-rt-20">
      <img
        :src="data.courseCoverUrl"
        alt=""
        @click="$router.push({ path: '/details/index', query: { id: data.courseId } })"
      />
    </div>
    <div class="info fx-1">
      <div class="tit">{{ data.courseName }}</div>
      <div>
        <span>有效期：</span>
        {{
          data.expireTime == null
            ? "长期有效"
            : `${new Date(data.createTime).toLocaleDateString()} - ${new Date(data.expireTime).toLocaleDateString()}`
        }}
      </div>
      <div><span>已学习：</span><em>{{ data.learnedSections }}</em> / {{ data.sections }}</div>
      <div v-if="type === '1'">
        <span>当前进度：</span>第 {{ data.latestSectionIndex }} 节 {{ data.latestSectionName }}
      </div>
    </div>
    <div class="btnCont">
      <div v-if="type === '1'" class="btn" @click="$router.push({ path: '/learning/index', query: { id: data.courseId } })">
        <span class="bt bt-round">继续学习</span>
      </div>
      <div
        v-if="type === '2' && data.status !== 3"
        class="btn"
        @click="$router.push({ path: '/learning/index', query: { id: data.courseId } })"
      >
        <span v-if="data.status === 0" class="bt bt-round">马上学习</span>
        <span v-if="data.status === 1" class="bt bt-round">继续学习</span>
        <span v-if="data.status === 2" class="bt bt-round">重新学习</span>
      </div>
      <div v-if="type === '2' && data.status !== 3 && data.planStatus === 0" class="btn" @click="planActive(data, 'add')">
        <span class="bt-grey bt-round">创建计划</span>
      </div>
      <div v-if="type === '2' && data.status !== 3 && data.planStatus === 1" class="btn" @click="planActive(data, 'edit')">
        <span class="bt-grey bt-round">修改计划</span>
      </div>
      <div v-if="type === '2' && data.status === 3" class="btn" @click="planActive(data, 'del')">
        <span class="bt-grey bt-round">删除课程</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  type: {
    type: String,
    default: "1",
  },
});

const emit = defineEmits(["planHandle"]);

const planActive = (item, type) => {
  emit("planHandle", { data: item, type });
};
</script>

<style lang="scss" scoped>
.classCards {
  img {
    width: 236px;
    height: 132px;
    border-radius: 8px;
  }

  .info {
    line-height: 30px;
    font-size: 14px;

    em {
      font-style: normal;
      color: var(--color-main);
    }

    span {
      display: inline-block;
      color: var(--color-font3);
      min-width: 85px;
    }

    .tit {
      font-size: 20px;
      font-weight: 500;
      line-height: 40px;
    }
  }

  .btnCont {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;

    .btn {
      width: 114px;
      height: 40px;
      display: flex;
      align-items: center;
      margin: 10px 0;
    }
  }
}
</style>
