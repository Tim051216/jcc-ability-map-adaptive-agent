<template>
  <div class="dashboardPage">
    <section class="heroCard">
      <div class="heroMain">
        <span class="heroEyebrow">A3 Admin Console</span>
        <h2 class="heroTitle">让学习画像、资源生成与运营协同在一个界面里完成闭环</h2>
        <p class="heroDesc">
          面向演示、巡检和日常运营的统一工作台，帮助团队快速判断系统状态、推进待办并进入关键业务模块。
        </p>
        <div class="heroMeta">
          <button class="refreshBtn" type="button" @click="Refreshtime">
            <img :src="refreshIcon" alt="" />
            <span>刷新快照</span>
          </button>
          <span class="heroTime">数据更新时间：{{ nowtime }}</span>
        </div>
      </div>
      <div class="heroSide">
        <div class="heroStatus">
          <span class="statusDot"></span>
          <div>
            <strong>演示环境可用</strong>
            <p>画像更新、路径规划、资源生成、审核流转均已接入当前后台。</p>
          </div>
        </div>
      </div>
    </section>

    <section class="metricGrid">
      <article v-for="item in todayCards" :key="item.label" class="metricCard">
        <div class="metricIconWrap">
          <img :src="item.icon" :alt="item.label" class="metricIcon" />
        </div>
        <div class="metricBody">
          <span class="metricLabel">{{ item.label }}</span>
          <strong class="metricValue">
            {{ item.value }}<span class="metricUnit">{{ item.unit }}</span>
          </strong>
        </div>
      </article>
    </section>

    <div class="dashboardColumns">
      <div class="dashboardMain">
        <section class="panelCard boardPanel">
          <div class="panelHead">
            <div>
              <h3 class="section-title">数据看板</h3>
              <p class="section-desc">近 15 天关键经营指标趋势</p>
            </div>
            <el-tabs v-model="actId" @tab-change="chartsHandle" class="boardTabs">
              <el-tab-pane
                v-for="(item, index) in tableBar"
                :key="index + 1"
                :label="item.name"
                :name="index + 1"
              />
            </el-tabs>
          </div>
          <div class="chartShell">
            <coreChart v-if="actId == 1"></coreChart>
            <flowStatistics v-if="actId == 2"></flowStatistics>
            <userStatistics v-if="actId == 3"></userStatistics>
            <tranSaction v-if="actId == 4"></tranSaction>
          </div>
        </section>

        <section class="panelCard rankPanel">
          <div class="panelHead">
            <div>
              <h3 class="section-title">内容表现榜单</h3>
              <p class="section-desc">聚焦高热度与高转化内容，便于运营复盘</p>
            </div>
          </div>
          <TableSwitchBar :data="tableTop10" @changeTable="changeTable"></TableSwitchBar>
          <popularCourses :formData="tableTop10Datas"></popularCourses>
        </section>
      </div>

      <aside class="dashboardSide">
        <section class="panelCard sidePanel todoPanel">
          <div class="panelHead">
            <div>
              <h3 class="section-title">待办事项</h3>
              <p class="section-desc">需要优先处理的审核与发布动作</p>
            </div>
          </div>
          <div class="todoList">
            <router-link
              v-for="item in todoItems"
              :key="item.label"
              :to="item.path"
              class="todoCard"
              :class="item.tone"
            >
              <strong>{{ item.count }}</strong>
              <span>{{ item.label }}</span>
            </router-link>
          </div>
        </section>

        <section class="panelCard sidePanel">
          <div class="panelHead">
            <div>
              <h3 class="section-title">常用功能</h3>
              <p class="section-desc">常见后台动作入口，适合演示时快速跳转</p>
            </div>
          </div>
          <div class="actionGrid">
            <router-link
              v-for="item in quickActions"
              :key="item.label"
              :to="item.path"
              class="actionCard"
            >
              <div class="actionIconWrap">
                <img :src="item.icon" :alt="item.label" class="actionIcon" />
              </div>
              <strong>{{ item.label }}</strong>
              <span>{{ item.desc }}</span>
            </router-link>
          </div>
        </section>

        <section class="panelCard sidePanel keywordPanel">
          <div class="panelHead">
            <div>
              <h3 class="section-title">A3 重点场景</h3>
              <p class="section-desc">当前平台能力的核心主题标签</p>
            </div>
          </div>
          <div class="keywordCloud">
            <span
              v-for="item in focusKeywords"
              :key="item.label"
              class="keywordChip"
              :class="item.tone"
            >
              {{ item.label }}
            </span>
          </div>
        </section>

        <section class="panelCard sidePanel messagePanel">
          <div class="panelHead">
            <div>
              <h3 class="section-title">平台动态</h3>
              <p class="section-desc">面向运营和演示的近期系统播报</p>
            </div>
          </div>
          <div class="messageList">
            <article class="messageCard" v-for="(item, index) in messageData" :key="index">
              <div class="messageHead">
                <div class="messageAuthor">
                  <img :src="item.icon" alt="" class="messageIcon" />
                  <span>{{ item.name }}</span>
                </div>
                <span class="messageTag">{{ item.title }}</span>
              </div>
              <p class="messageBody">{{ item.desc }}</p>
              <span class="messageTime">{{ item.time }}</span>
            </article>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getToday, getTop10, getGrantInfo } from "@/api/main";
import coreChart from "./components/coreChart.vue";
import flowStatistics from "./components/flowStatistics.vue";
import tranSaction from "./components/tranSaction.vue";
import userStatistics from "./components/userStatistics.vue";
import popularCourses from "./components/popularCourses.vue";
import TableSwitchBar from "./components/TableSwitch.vue";
import iconImg from "@/assets/img_touxiang_small@2x.png";
import refreshIcon from "@/assets/btn-shx.png";
import visitsIcon from "@/assets/Visits.png";
import orderAmountIcon from "@/assets/todayordermoney.png";
import orderCountIcon from "@/assets/todayorders.png";
import studentIcon from "@/assets/todaynewstudent.png";
import adminIcon from "@/assets/houtairenyuan.png";
import teacherIcon from "@/assets/courseteacher.png";
import courseIcon from "@/assets/newcourse.png";
import orderIcon from "@/assets/order.png";

const messageData = [
  {
    icon: iconImg,
    name: "系统运营",
    title: "智能体监控",
    desc: "画像、规划、资源生成与评测链路已完成最新一轮巡检，当前运行状态稳定。",
    time: "12分钟前",
  },
  {
    icon: iconImg,
    name: "审核中心",
    title: "待办提醒",
    desc: "新增 6 条内容审核任务，包含资源简介、助教回复与学习报告摘要，请尽快处理。",
    time: "05.11 09:00",
  },
  {
    icon: iconImg,
    name: "资源工坊",
    title: "生成完成",
    desc: "个性化练习、知识讲义和随堂测验模板已同步到资源中心，可直接用于演示。",
    time: "05.11 08:30",
  },
  {
    icon: iconImg,
    name: "用户管理",
    title: "画像更新",
    desc: "最新一批学习画像已完成重算，用户兴趣标签与能力层级已更新。",
    time: "05.11 08:00",
  },
  {
    icon: iconImg,
    name: "系统配置",
    title: "策略发布",
    desc: "A3 演示环境的审核阈值、模型路由和资源生成策略已切换到最新配置。",
    time: "05.11 07:40",
  },
];

const todaydata = reactive({
  data: {},
});

const nowtime = ref("");
const tableBar = [
  { id: 1, name: "核心指标" },
  { id: 2, name: "交易统计" },
  { id: 3, name: "用户统计" },
  { id: 4, name: "流量统计" },
];
const tableTop10 = [
  { id: 1, name: "上周热门内容TOP10" },
  { id: 2, name: "上周高转化内容TOP10" },
];

const todoItems = [
  { count: 6, label: "退款待审批", path: "/order/refund", tone: "warm" },
  { count: 6, label: "活动待发布", path: "/marketing/index", tone: "soft" },
];

const quickActions = [
  { label: "新增管理账号", desc: "快速补充后台角色", path: "/user/users", icon: adminIcon },
  { label: "新增讲师账号", desc: "维护授课与答疑人员", path: "/user/teacher", icon: teacherIcon },
  { label: "创建课程内容", desc: "进入课程生产流程", path: "/curriculum/index", icon: courseIcon },
  { label: "订单管理", desc: "查看支付与退款状态", path: "/order/index", icon: orderIcon },
];

const focusKeywords = [
  { label: "多智能体协同", tone: "primary" },
  { label: "学习画像", tone: "soft" },
  { label: "资源生成", tone: "soft" },
  { label: "学习路径", tone: "accent" },
  { label: "内容审核", tone: "warn" },
  { label: "日志追踪", tone: "muted" },
  { label: "模型治理", tone: "muted" },
  { label: "权限编排", tone: "warn" },
  { label: "审核流转", tone: "accent" },
  { label: "运营看板", tone: "dark" },
];

const tableTop10Data = reactive({
  hot: [],
  hotSales: [],
});

const params1 = reactive({ types: "2,3,4,1" });
const params2 = reactive({ types: "2,3,5" });
const params3 = reactive({ types: "6,4,7" });
const params4 = reactive({ types: "8,9" });

onMounted(() => {
  getTodayData();
  getNowTime();
  gettop10Data();
});

const actId = ref(1);
const topId = ref(1);
const tableTop10Datas = ref([]);

const todayCards = computed(() => [
  {
    label: "今日访问量",
    value: todaydata.data.visits ?? "--",
    unit: "万",
    icon: visitsIcon,
  },
  {
    label: "今日订单金额",
    value: todaydata.data.orderAmount ?? "--",
    unit: "万",
    icon: orderAmountIcon,
  },
  {
    label: "今日订单笔数",
    value: todaydata.data.orderNum ?? "--",
    unit: "笔",
    icon: orderCountIcon,
  },
  {
    label: "今日新增学员",
    value: todaydata.data.stuNewNum ?? "--",
    unit: "人",
    icon: studentIcon,
  },
]);

const chartsHandle = (val) => {
  console.log(909090, val);
};

const changeTable = (id) => {
  topId.value = id;
  tableTop10Datas.value = id == 1 ? tableTop10Data.hot : tableTop10Data.hotSales;
};

const getTodayData = async () => {
  const res = await getToday();
  if (res.code === 200) {
    todaydata.data = res.data;
  } else {
    ElMessage.error(res.msg);
  }
};

const getNowTime = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  nowtime.value = hour === 0 ? `${year}.${month}.${day - 1} 23:00:00` : `${year}.${month}.${day} ${hour - 1}:00:00`;
};

const Refreshtime = () => {
  getNowTime();
};

const gettop10Data = async () => {
  const res = await getTop10();
  if (res.code === 200) {
    tableTop10Data.hotSales = res.data.hotSales;
    tableTop10Data.hot = res.data.hot;
    tableTop10Datas.value = res.data.hot;
  } else {
    ElMessage.error(res.msg);
  }
};

const watchArr = ref(null);
const coreChartData = ref(null);
const flowStatisticsData = ref(null);
const userStatisticsData = ref(null);
const tranSactionData = ref(null);

const getChartsData = async ({ type, params }) => {
  await getGrantInfo(params).then((res) => {
    if (res.code === 200) {
      if (type == 1) {
        const data = { amount: {}, count: {}, newStudents: {}, Visits: {} };
        data.amount.series = res.data.series[0];
        data.amount.xaxis = res.data.xaxis[0];
        data.amount.yaxis = res.data.yaxis[0];
        data.count.series = res.data.series[1];
        data.count.xaxis = res.data.xaxis[0];
        data.count.yaxis = res.data.yaxis[1];
        data.newStudents.series = res.data.series[2];
        data.newStudents.xaxis = res.data.xaxis[0];
        data.newStudents.yaxis = res.data.yaxis[2];
        data.Visits.series = res.data.series[3];
        data.Visits.xaxis = res.data.xaxis[0];
        data.Visits.yaxis = res.data.yaxis[3];
        coreChartData.value = data;
        watchArr.value = data;
      } else if (type == 2) {
        const data = {};
        data.amount.series = res.data.series[0];
        data.amount.yaxis = res.data.yaxis[0];
        data.amount.xaxis = res.data.xaxis[0];
        data.count.series = res.data.series[1];
        data.count.yaxis = res.data.yaxis[1];
        data.count.xaxis = res.data.xaxis[1];
        data.price.series = res.data.series[2];
        data.price.yaxis = res.data.yaxis[2];
        data.price.xaxis = res.data.xaxis[2];
        flowStatisticsData.value = data;
      } else if (type == 3) {
        const data = {};
        data.students.series = res.data.series[0];
        data.students.yaxis = res.data.yaxis[0];
        data.students.xaxis = res.data.xaxis[0];
        data.newstudents.series = res.data.series[1];
        data.newstudents.yaxis = res.data.yaxis[1];
        data.newstudents.xaxis = res.data.xaxis[1];
        data.users.series = res.data.series[2];
        data.users.yaxis = res.data.yaxis[2];
        data.users.xaxis = res.data.xaxis[2];
        userStatisticsData.value = data;
      } else if (type == 4) {
        const data = {};
        data.visitors.series = res.data.series[0];
        data.visitors.xaxis = res.data.xaxis[0];
        data.visitors.yaxis = res.data.yaxis[0];
        data.volume.series = res.data.series[1];
        data.volume.xaxis = res.data.xaxis[1];
        data.volume.yaxis = res.data.yaxis[1];
        tranSactionData.value = data;
      }
    }
  });
};
</script>

<style lang="scss" scoped src="./index.scss"></style>
