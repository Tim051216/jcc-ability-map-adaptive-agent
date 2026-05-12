<template>
  <footer>
    <div class="container">
      <div class="links">
          <span v-for="item in Links" :key="item.title" @click="goDetails(item.link)">{{item.title}}</span>
        </div>
        <div class="about fx-sb">
          <div class="info">
            <p>A3 学习平台用于展示课程学习、教学运营与平台管理能力，当前版本面向软杯赛题本地演示。</p>
            <p>&#169 2026 A3 学习平台保留所有权利</p>
          </div>
          <div class="logo">
            <img src="@/assets/logo.png" alt="" srcset="">
          </div>
        </div>
    </div>
  </footer>
</template>
<script setup>
  // 站内-友情链接
  const Links = [
    {title: '项目介绍', link: '/'},
    {title: '功能模块', link: '/'},
    {title: '部署说明', link: '/'},
    {title: '技术支持', link: '/'},
    {title: '使用文档', link: '/'},
    {title: '赛题背景', link: '/'},
    {title: '课程内容', link: '/'},
    {title: '运营活动', link: '/'},
    {title: '联系我们', link: '/'}
  ]
  // 转入详情页
  const goDetails = (link) => {
    return false;
  }
</script>
<style lang="scss" scoped>
footer {
  width: 100%;
  background-color: var(--color-white);
  text-align: left;
  padding: 35px 0;
  font-size: 14px;
  .links {
    margin-bottom: 25px;
    cursor: pointer;
    span{
      margin-right: 30px;
    }
  }
  .about{
    line-height: 30px;
    color: var(--color-font2);
    img{
      width: 144px;
      height: 48px;
    }
  }
}
</style>
