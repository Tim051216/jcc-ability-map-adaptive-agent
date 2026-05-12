<template>
  <div class="aiEntryPanel">
    <router-link class="entryLink primaryEntry" to="/main/ai-path">
      <div class="entryLabel">A3 学习专区</div>
      <h3>进入学生端 AI 学习闭环专区</h3>
      <p>
        这里集中承载学习画像、资源推荐、学习路径、学习日历、错题复盘、智能助教和学习报告等页面，
        适合按赛题验收顺序展示学生端完整业务链路。
      </p>
      <div class="entryMeta">
        <span>学生端主链路</span>
        <strong>可直接演示</strong>
      </div>
    </router-link>

    <div class="quickEntryGrid">
      <router-link v-for="card in studentCards" :key="card.path" class="entryLink quickEntryCard" :to="card.path">
        <span>{{ card.index }}</span>
        <strong>{{ card.title }}</strong>
        <p>{{ card.desc }}</p>
      </router-link>
    </div>

    <div class="adminEntryPanel">
      <div class="adminHeader">
        <div>
          <div class="adminBadge">后台管控台</div>
          <h4>后台管理端入口</h4>
          <p>
            用于展示用户管理、内容审核、智能体监控和运行日志等后台能力，补足赛题要求中的平台治理视角。
          </p>
        </div>
        <router-link class="adminAction" to="/main/ai-admin">进入后台管控首页</router-link>
      </div>
      <div class="adminGrid">
        <router-link v-for="card in adminCards" :key="card.path" class="entryLink adminCard" :to="card.path">
          <strong>{{ card.title }}</strong>
          <p>{{ card.desc }}</p>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { a3AdminEntries, a3StudentEntries } from "@/mock/a3DemoData";

const studentCards = a3StudentEntries;
const adminCards = a3AdminEntries;
</script>

<style scoped lang="scss">
.aiEntryPanel {
  margin-top: 20px;
}

.entryLink {
  display: block;
  text-decoration: none;
}

.primaryEntry {
  padding: 24px 26px;
  border-radius: 28px;
  cursor: pointer;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 30%),
    linear-gradient(135deg, #153a75 0%, #0c63d6 48%, #1aa07a 100%);
  box-shadow: 0 26px 50px rgba(22, 69, 132, 0.2);
  color: #fff;
}

.entryLabel,
.adminBadge {
  display: inline-flex;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.entryLabel {
  background: rgba(255, 255, 255, 0.14);
}

h3 {
  margin-top: 16px;
  font-size: 30px;
  line-height: 1.2;
}

p {
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
  }
}

.quickEntryGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.quickEntryCard,
.adminCard {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-3px);
  }
}

.quickEntryCard {
  min-height: 196px;
  padding: 22px;
  border-radius: 24px;
  color: #17304d;
  background:
    radial-gradient(circle at top right, rgba(77, 143, 229, 0.16), transparent 30%),
    linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
  box-shadow: 0 18px 36px rgba(63, 107, 166, 0.12);

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
    max-width: none;
    color: #52637a;
  }
}

.adminEntryPanel {
  margin-top: 18px;
  padding: 24px;
  border-radius: 28px;
  background: linear-gradient(180deg, #0f172a 0%, #16253f 100%);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
  color: #fff;
}

.adminHeader {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;

  h4 {
    margin-top: 14px;
    font-size: 28px;
  }

  p {
    margin-top: 10px;
    color: rgba(255, 255, 255, 0.8);
  }
}

.adminBadge {
  background: rgba(59, 130, 246, 0.18);
  color: #bfdbfe;
}

.adminAction {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 164px;
  height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #123b74;
  font-weight: 700;
}

.adminGrid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.adminCard {
  min-height: 140px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);

  strong {
    display: block;
    font-size: 20px;
    line-height: 1.35;
    color: #fff;
  }

  p {
    margin-top: 10px;
    color: rgba(255, 255, 255, 0.74);
    line-height: 1.75;
  }
}

@media screen and (max-width: 1280px) {
  .quickEntryGrid,
  .adminGrid {
    grid-template-columns: 1fr;
  }

  .adminHeader {
    flex-direction: column;
  }
}
</style>
