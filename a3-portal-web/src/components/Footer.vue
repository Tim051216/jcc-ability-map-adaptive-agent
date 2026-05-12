<template>
  <footer>
    <div class="container">
      <div class="links">
        <span v-for="item in links" :key="item.title">{{ item.title }}</span>
      </div>
      <div class="about fx-sb">
        <div class="info">
          <p>A3 学习平台聚焦课程学习、引导式练习与赛题验收演示链路。</p>
          <p>&#169; 2026 A3 学习平台保留所有权利。</p>
        </div>
        <div class="logo">
          <div class="brand">
            <span class="brandMark">A3</span>
            <span class="brandText">
              <strong>A3 学习平台</strong>
              <em>学生演示版</em>
            </span>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
const links = [
  { title: "项目概览" },
  { title: "功能模块" },
  { title: "部署说明" },
  { title: "技术支持" },
  { title: "使用指南" },
  { title: "赛题背景" },
  { title: "课程学习" },
  { title: "互动练习" },
  { title: "联系我们" },
];
</script>

<style lang="scss" scoped>
footer {
  width: 100%;
  background-color: var(--color-white);
  border-top: 1px solid #eeeeee;
  text-align: left;
  padding: 35px 0;
  font-size: 14px;

  .links {
    margin-bottom: 25px;
    cursor: default;

    span {
      margin-right: 30px;
    }
  }

  .about {
    line-height: 30px;
    color: var(--color-font2);

    .brand {
      display: flex;
      align-items: center;
      justify-content: flex-end;
    }

    .brandMark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #0f6adf 0%, #28b381 100%);
      color: #fff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    .brandText {
      display: flex;
      flex-direction: column;
      margin-left: 12px;
      line-height: 1.1;

      strong {
        font-size: 18px;
        color: #172033;
      }

      em {
        margin-top: 4px;
        font-size: 11px;
        color: var(--color-font2);
        font-style: normal;
        letter-spacing: 0.08em;
      }
    }
  }
}
</style>
