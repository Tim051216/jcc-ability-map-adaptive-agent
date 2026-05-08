<template>
  <div class="countdown">
    <span class="timeValue">{{ timeData.m }}</span>
    <span class="timeLabel">分</span>
    <span class="timeValue">{{ timeData.s }}</span>
    <span class="timeLabel">秒</span>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, watch } from "vue";
import moment from "moment";

const props = defineProps({
  endTime: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["timeOver"]);

const timeData = reactive({
  m: "00",
  s: "00",
  timer: null,
});

onMounted(() => {
  startTimer();
});

watch(
  () => props.endTime,
  () => {
    startTimer();
  },
);

const startTimer = () => {
  clearInterval(timeData.timer);
  updateTime();
  timeData.timer = setInterval(updateTime, 1000);
};

const updateTime = () => {
  const diff = moment(props.endTime).diff(moment());
  if (diff <= 0) {
    timeData.m = "00";
    timeData.s = "00";
    clearInterval(timeData.timer);
    emit("timeOver");
    return;
  }
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  timeData.m = String(minutes).padStart(2, "0");
  timeData.s = String(remainSeconds).padStart(2, "0");
};

onUnmounted(() => {
  clearInterval(timeData.timer);
});
</script>

<style lang="scss">
.countdown {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.timeValue {
  min-width: 24px;
  text-align: center;
  font-weight: 600;
}

.timeLabel {
  color: #80878c;
}
</style>
