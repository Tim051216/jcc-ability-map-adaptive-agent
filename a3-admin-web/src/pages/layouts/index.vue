<template>
  <div class="layoutsWrapper">
    <LeftSide />
    <div class="contain fx-1">
      <Header />
      <main class="contentShell">
        <div class="contentBackdrop"></div>
        <router-view class="mainWrapper" />
      </main>
    </div>
  </div>
</template>

<script setup>
import LeftSide from "./components/LeftSide.vue";
import Header from "./components/Header.vue";
</script>

<style lang="scss" scoped>
.layoutsWrapper {
  display: flex;
  min-height: 100vh;

  .contain {
    position: relative;
    min-width: 1280px;
    padding-left: var(--layout-sidebar-width);
  }
}

.contentShell {
  position: relative;
  min-height: 100vh;
  padding: calc(var(--layout-header-height) + 20px) 24px 28px;
}

.contentBackdrop {
  position: absolute;
  inset: 0 24px 24px;
  border-radius: 36px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.18) 100%),
    radial-gradient(circle at top right, rgba(255, 122, 69, 0.12), transparent 24%);
  pointer-events: none;
}

.mainWrapper {
  position: relative;
  z-index: 1;
}
</style>
