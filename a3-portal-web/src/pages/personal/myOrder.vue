<template>
  <div class="myOrderWrapper content">
    <CardsTitle class="marg-bt-20" title="&#x6211;&#x7684;&#x8BA2;&#x5355;" />
    <TableSwitchBar :data="tableBar" @changeTable="changeTable" />

    <div class="table">
      <div class="tabHead">
        <span class="fx-1 alignLeft">&#x8BFE;&#x7A0B;&#x4FE1;&#x606F;</span>
        <span>&#x8BA2;&#x5355;&#x91D1;&#x989D;</span>
        <span>&#x5B9E;&#x4ED8;&#x91D1;&#x989D;</span>
        <span>&#x8BA2;&#x5355;&#x72B6;&#x6001;</span>
        <span>&#x64CD;&#x4F5C;</span>
      </div>

      <div v-for="item in orderListData" :key="item.id" class="marg-bt-20">
        <div class="tabInfo">
          <div>
            <span class="time alignLeft">{{ item.createTime }}</span>
            &#x8BA2;&#x5355;&#x53F7;&#xFF1A;{{ item.id }}
          </div>
        </div>
        <div class="tabCont">
          <div class="orderList">
            <div class="fx-1 alignLeft">
              <OrderCards v-for="detail in item.details" :key="detail.id || detail.courseId" :data="detail" />
            </div>
            <span>{{ amountConversion(item.totalAmount) }}</span>
            <span>{{ amountConversion(item.realAmount) }}</span>
            <span>{{ orderStatus(item) }}</span>
            <span class="btCont">
              <span v-if="isOrderPaid(item)" class="bt">&#x8BFE;&#x7A0B;&#x5DF2;&#x53EF;&#x5B66;&#x4E60;</span>
              <span class="bt bt-grey1" @click="goOrderDetails(item.id)">&#x67E5;&#x770B;&#x8BA2;&#x5355;</span>
              <span v-if="item.status === 1" class="bt bt-grey" @click="cancelOrderHandle(item)">&#x53D6;&#x6D88;&#x8BA2;&#x5355;</span>
              <span v-if="item.status === 1" class="bt" @click="goPay(item.id)">&#x53BB;&#x652F;&#x4ED8;</span>
              <span v-if="item.status === 3 || item.status === 5" class="bt bt-grey1" @click="delOrderHandle(item)">&#x5220;&#x9664;&#x8BA2;&#x5355;</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-show="count > 0" class="pageination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="count"
        class="mt-4"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";
import { amountConversion } from "@/utils/tool.js";
import { cancelOrder, delOrder, getOrderListes } from "@/api/order.js";
import CardsTitle from "./components/CardsTitle.vue";
import TableSwitchBar from "./components/TableSwitch.vue";
import OrderCards from "./components/OrderCards.vue";

const router = useRouter();

const tableBar = [
  { id: 0, name: "\u5168\u90E8" },
  { id: 1, name: "\u5F85\u652F\u4ED8" },
  { id: 2, name: "\u5DF2\u652F\u4ED8" },
  { id: 3, name: "\u5DF2\u5173\u95ED" },
  { id: 4, name: "\u5DF2\u5B8C\u6210" },
  { id: 5, name: "\u5DF2\u62A5\u540D" },
  { id: 6, name: "\u9000\u6B3E\u4E2D" },
];

const actId = ref(0);
const count = ref(0);
const orderListData = ref([]);
const params = reactive({
  status: undefined,
  pageNo: 1,
  pageSize: 10,
});

onMounted(() => {
  getOrderListesData();
});

const changeTable = (id) => {
  actId.value = id;
  params.status = id === 0 ? undefined : id;
  params.pageNo = 1;
  getOrderListesData();
};

const handleSizeChange = (val) => {
  params.pageSize = val;
  params.pageNo = 1;
  getOrderListesData();
};

const handleCurrentChange = (val) => {
  params.pageNo = val;
  getOrderListesData();
};

const getOrderListesData = async () => {
  try {
    const res = await getOrderListes(params);
    if (res.code === 200) {
      orderListData.value = res.data?.list || [];
      count.value = Number(res.data?.total || 0);
      return;
    }
    ElMessage({ message: res.msg || "\u8BA2\u5355\u5217\u8868\u52A0\u8F7D\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u8BA2\u5355\u5217\u8868\u52A0\u8F7D\u5931\u8D25", type: "error" });
  }
};

const isOrderPaid = (item) => [2, 4, 5].includes(item.status);

const orderStatus = (item) => {
  switch (item.status) {
    case 1:
      return "\u5F85\u652F\u4ED8";
    case 2:
      return "\u5DF2\u652F\u4ED8";
    case 3:
      return "\u5DF2\u5173\u95ED";
    case 4:
      return "\u5DF2\u5B8C\u6210";
    case 5:
      return "\u5DF2\u62A5\u540D";
    case 6:
      return item.details?.some((detail) => detail.refundStatus === 5) ? "\u5DF2\u9000\u6B3E" : "\u9000\u6B3E\u4E2D";
    default:
      return "\u5904\u7406\u4E2D";
  }
};

const goOrderDetails = (id) => {
  router.push({
    path: "/personal/main/myOrderDetails",
    query: { id },
  });
};

const goPay = (orderId) => {
  router.push({
    path: "/pay/payment",
    query: { orderId },
  });
};

const cancelOrderHandle = (item) => {
  ElMessageBox.confirm("\u786E\u8BA4\u53D6\u6D88\u8FD9\u7B14\u8BA2\u5355\u5417\uFF1F", "\u53D6\u6D88\u8BA2\u5355", {
    confirmButtonText: "\u786E\u8BA4\u53D6\u6D88",
    cancelButtonText: "\u8FD4\u56DE",
    type: "warning",
  })
    .then(() => cancelOrderAction(item))
    .catch(() => {});
};

const cancelOrderAction = async (item) => {
  try {
    const res = await cancelOrder(item.id);
    if (res.code === 200) {
      item.status = 3;
      ElMessage({ message: "\u8BA2\u5355\u5DF2\u53D6\u6D88", type: "success" });
      return;
    }
    ElMessage({ message: res.msg || "\u53D6\u6D88\u8BA2\u5355\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u53D6\u6D88\u8BA2\u5355\u5931\u8D25", type: "error" });
  }
};

const delOrderHandle = (item) => {
  ElMessageBox.confirm("\u786E\u8BA4\u5220\u9664\u8FD9\u7B14\u8BA2\u5355\u5417\uFF1F\u5220\u9664\u540E\u5C06\u65E0\u6CD5\u6062\u590D\u3002", "\u5220\u9664\u8BA2\u5355", {
    confirmButtonText: "\u5220\u9664",
    cancelButtonText: "\u8FD4\u56DE",
    type: "warning",
  })
    .then(() => delOrderAction(item))
    .catch(() => {});
};

const delOrderAction = async (item) => {
  try {
    const res = await delOrder(item.id);
    if (res.code === 200) {
      await getOrderListesData();
      ElMessage({ message: "\u8BA2\u5355\u5DF2\u5220\u9664", type: "success" });
      return;
    }
    ElMessage({ message: res.msg || "\u5220\u9664\u8BA2\u5355\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u5220\u9664\u8BA2\u5355\u5931\u8D25", type: "error" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
