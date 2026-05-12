<template>
  <div class="paymenttWrapper container bg-wt">
    <div class="title">完成支付</div>
    <div class="successCont fx-sb">
      <div class="fx">
        <img src="@/assets/icon_success.png" width="72" height="72" alt="" />
        <div>
          <p class="tit">订单已创建，请完成支付</p>
          <p class="fx">
            请在
            <span class="ft-cl-err"><Countdown :endTime="orderInfo && orderInfo.payOutTime" @timeOver="timeOver" /></span>
            内完成支付，超时后订单会自动失效。
          </p>
        </div>
      </div>
      <div class="price">
        <span>应付金额：</span>
        <span class="ft-cl-err">¥{{ orderInfo ? amountConversion(orderInfo.payAmount) : route.query.payAmount || "0.00" }}</span>
      </div>
    </div>
    <div class="introBanner">
      支付页保留了渠道选择、二维码展示和倒计时结构。演示模式下可以直接完成“模拟支付”，便于继续验收前端流程。
    </div>
    <div class="pay">
      <div class="tit">选择一个支付方式</div>
      <div class="fx">
        <div
          v-for="item in payMethodList"
          :key="item.id"
          class="cont marg-rt-20"
          :class="{ act: payMethod.id === item.id }"
          @click="payMethodCheck(item)"
        >
          <img :src="item.channelIcon" width="44" height="44" alt="" />
          {{ item.name }}
        </div>
      </div>
      <div v-if="payMethodList.length === 0" class="emptyPayChannel">暂无可用支付渠道，请稍后重试或返回首页继续演示其他页面。</div>
    </div>

    <el-dialog v-model="dialogVisible" width="440px" :before-close="handleClose">
      <template #header>
        <span>{{ payMethod.name }} 扫码支付</span>
      </template>
      <div v-if="qrCodeUrl" style="padding: 0 40px">
        <qrcode-vue :key="qrCodeUrl" :value="qrCodeUrl" :size="320" level="H" />
      </div>
      <div class="dialogAction">
        <el-button round type="primary" @click="completeDemoPayment">我已完成演示支付</el-button>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <p>请使用 <em>{{ payMethod.name }}</em> 扫码</p>
          <p>或直接点击上方按钮，继续演示支付成功页面。</p>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import QrcodeVue from "qrcode.vue";
import { getPayMethod, getPayState, getPayUrl } from "@/api/order.js";
import { amountConversion } from "@/utils/tool.js";
import Countdown from "./components/Countdown.vue";

const route = useRoute();
const router = useRouter();

const dialogVisible = ref(false);
const payMethod = ref({});
const payMethodList = ref([]);
const qrCodeUrl = ref("");
const orderInfo = ref();
const timer = ref(null);

onMounted(() => {
  getPayMethodList();
  getPayStateData();
});

onUnmounted(() => {
  clearInterval(timer.value);
});

const payMethodCheck = (item) => {
  payMethod.value = item;
  getPayUrlData(item);
};

const getPayMethodList = async () => {
  try {
    const res = await getPayMethod();
    if (res.code === 200) {
      payMethodList.value = res.data || [];
      if (payMethodList.value.length > 0 && !payMethod.value.id) {
        payMethod.value = payMethodList.value[0];
      }
      return;
    }
    ElMessage({ type: "error", message: res.msg || "支付渠道加载失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "支付渠道加载失败" });
  }
};

const getPayUrlData = async (value) => {
  try {
    const res = await getPayUrl({
      orderId: route.query.orderId,
      payChannelCode: value.channelCode,
    });
    if (res.code === 200) {
      qrCodeUrl.value = res.data;
      dialogVisible.value = true;
      clearInterval(timer.value);
      timer.value = setInterval(() => {
        getPayStateData();
      }, 5000);
      return;
    }
    ElMessage({ type: "error", message: res.msg || "支付二维码生成失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "支付二维码生成失败" });
  }
};

const getPayStateData = async () => {
  try {
    const res = await getPayState({ orderId: route.query.orderId });
    if (res.code === 200) {
      orderInfo.value = res.data;
      if ([2, 5].includes(Number(res.data.status))) {
        clearInterval(timer.value);
        router.push({ path: "/pay/success", query: { order: res.data.id || route.query.orderId } });
      }
      return;
    }
    ElMessage({ type: "error", message: res.msg || "订单状态获取失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "订单状态获取失败" });
  }
};

const completeDemoPayment = () => {
  clearInterval(timer.value);
  dialogVisible.value = false;
  router.push({ path: "/pay/success", query: { order: route.query.orderId } });
};

const handleClose = (done) => {
  clearInterval(timer.value);
  done();
};

const timeOver = () => {
  router.push("/main/index");
};
</script>

<style lang="scss" src="./index.scss"></style>
<style lang="scss" scoped>
.introBanner {
  margin-top: 24px;
  padding: 14px 18px;
  line-height: 24px;
  border-radius: 8px;
  background: #f7f9fb;
  color: #4e5969;
}

.dialogAction {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.emptyPayChannel {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 8px;
  background: #f7f9fb;
  color: #5b6570;
}
</style>
