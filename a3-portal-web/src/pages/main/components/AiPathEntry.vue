<template>
  <div class="aiEntryPanel">
    <div class="primaryEntry" @click="goPage('/main/ai-path')">
      <div class="primaryGlow"></div>
      <div class="entryLabel">A3 学习专区</div>
      <h3 class="primaryTitle">进入学生端 AI 学习路径执行页</h3>
      <p class="primaryDesc">展示阶段路径、节点任务、资源推送和动态调优，首页只保留专区入口，详细执行过程放到内页承载。</p>
      <div class="entryMeta">
        <span>Learning Path</span>
        <strong>Open</strong>
      </div>
    </div>

    <div class="quickEntryGrid">
      <div class="quickEntryCard" @click="goPage('/main/ai-report')">
        <span>01</span>
        <strong>学习测评报告</strong>
        <p>查看测评结果、薄弱点分析和回流建议。</p>
      </div>
      <div class="quickEntryCard" @click="goPage('/main/ai-ops')">
        <span>02</span>
        <strong>AI 运维总览</strong>
        <p>从首页直接进入后台运维与服务总览页面。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

const goPage = (path) => {
  router.push(path);
};
</script>

<style scoped lang="scss">
.aiEntryPanel {
  margin-top: 20px;
}

.primaryEntry {
  position: relative;
  overflow: hidden;
  padding: 26px 28px;
  border-radius: 28px;
  cursor: pointer;
  background:
    radial-gradient(circle at 85% 18%, rgba(255, 255, 255, 0.2), transparent 18%),
    linear-gradient(135deg, #0f3f74 0%, #135ab2 42%, #138e7f 100%);
  box-shadow: 0 26px 50px rgba(22, 69, 132, 0.2);
  color: #fff;
}

.primaryGlow {
  position: absolute;
  right: -36px;
  top: -32px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.entryLabel,
.primaryTitle,
.primaryDesc,
.entryMeta {
  position: relative;
  z-index: 1;
}

.entryLabel {
  display: inline-flex;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.primaryTitle {
  margin-top: 16px;
  font-size: 30px;
  line-height: 1.2;
  color: #fff;
}

.primaryDesc {
  margin-top: 12px;
  max-width: 760px;
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
    color: #fff;
  }
}

.quickEntryGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.quickEntryCard {
  min-height: 188px;
  padding: 22px;
  border-radius: 24px;
  cursor: pointer;
  color: #17304d;
  background:
    radial-gradient(circle at top right, rgba(77, 143, 229, 0.16), transparent 30%),
    linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
  box-shadow: 0 18px 36px rgba(63, 107, 166, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 24px 40px rgba(46, 87, 146, 0.16);
  }

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 13px;
    font-weight: 700;
  }

  strong {
    display: block;
    margin-top: 18px;
    font-size: 24px;
    line-height: 1.35;
    color: #17304d;
  }

  p {
    margin-top: 10px;
    color: #52637a;
    line-height: 1.8;
  }
}

@media screen and (max-width: 1280px) {
  .quickEntryGrid {
    grid-template-columns: 1fr;
  }
}
</style>
