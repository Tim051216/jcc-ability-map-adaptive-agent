<template>
  <div class="aiPathEntry" @click="goPath">
    <div class="entryLabel">A3 学习路径页</div>
    <h3>进入学生端 AI 路径执行页</h3>
    <p>展示阶段路径、节点任务、资源推送和动态调优，更贴近答辩里的正式业务闭环。</p>
    <div class="entryMeta">
      <span>Learning Path</span>
      <strong>Open</strong>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

const goPath = () => {
  router.push("/main/ai-path");
};
</script>

<style scoped lang="scss">
.aiPathEntry {
  margin-top: 20px;
  padding: 24px 26px;
  border-radius: 28px;
  cursor: pointer;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 30%),
    linear-gradient(135deg, #153a75 0%, #0c63d6 48%, #1aa07a 100%);
  box-shadow: 0 26px 50px rgba(22, 69, 132, 0.2);
  color: #fff;
}

.entryLabel {
  display: inline-flex;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  letter-spacing: 0.08em;
}

h3 {
  margin-top: 16px;
  font-size: 30px;
  line-height: 1.2;
}

p {
  margin-top: 12px;
  max-width: 720px;
  line-height: 1.9;
  color: rgba(255, 255, 255, 0.88);
}

.entryMeta {
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  span {
    color: rgba(255, 255, 255, 0.72);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 12px;
  }

  strong {
    font-size: 22px;
  }
}
</style>
