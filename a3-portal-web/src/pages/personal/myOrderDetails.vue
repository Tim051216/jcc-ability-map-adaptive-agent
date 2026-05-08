<template>
  <div class="myOrderDetailsWrapper">
    <div class="content marg-bt-20">
      <BreadCrumb />
      <div class="label"><span>&#x8BA2;&#x5355;&#x8BE6;&#x60C5;</span> &#x8BA2;&#x5355;&#x53F7;&#xFF1A;{{ orderDetails?.id }}</div>
      <div class="orderTit">{{ orderDetails?.message }}</div>
      <div class="linePint">
        <div v-for="item in orderDetails?.progressNodes || []" :key="item.id" class="nodePoint">
          <div class="pintTit">{{ item.name }}</div>
          <div class="circular"></div>
          <div class="time">
            <p v-for="value in String(item.time).split(' ')" :key="value">{{ value }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <CardsTitle class="marg-bt-20" title="&#x8BFE;&#x7A0B;&#x4FE1;&#x606F;" />
      <el-table class="table" :data="orderDetails?.details || []">
        <el-table-column prop="courseName" center label="&#x8BFE;&#x7A0B;&#x540D;&#x79F0;">
          <template #default="scope">
            <div>{{ scope.row.name }}</div>
          </template>
        </el-table-column>
        <el-table-column align="center" label="&#x8BFE;&#x7A0B;&#x4EF7;&#x683C;" width="180">
          <template #default="scope">
            <div>{{ amountConversion(scope.row.price) }}</div>
          </template>
        </el-table-column>
        <el-table-column align="center" label="&#x5B9E;&#x4ED8;&#x91D1;&#x989D;" width="180">
          <template #default="scope">
            <div>{{ amountConversion(scope.row.realPayAmount) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="&#x64CD;&#x4F5C;" align="center" width="140">
          <template #default="scope">
            <div v-if="scope.row.canRefund" class="font-bt1" @click="openRefundDialog('refund', scope.row)">&#x7533;&#x8BF7;&#x9000;&#x6B3E;</div>
            <span v-else-if="!scope.row.refundStatus || scope.row.refundStatus === 3">--</span>
            <div v-else class="font-bt1" @click="openRefundDialog('details', scope.row)">&#x9000;&#x6B3E;&#x8BE6;&#x60C5;</div>
          </template>
        </el-table-column>
      </el-table>

      <div class="info">
        <div><span>&#x8BA2;&#x5355;&#x603B;&#x4EF7;&#xFF1A;</span><span class="pirc">{{ amountConversion(orderDetails?.totalAmount) || 0 }}</span></div>
        <div class="fx">
          <span>&#x4F18;&#x60E0;&#x89C4;&#x5219;&#xFF1A;</span>
          <span v-if="couponRule.length" class="ruleBox">
            <span v-for="(rule, index) in couponRule" :key="index">{{ rule }}</span>
          </span>
          <span v-else class="pirc">&#x65E0;</span>
        </div>
        <div><span>&#x4F18;&#x60E0;&#x91D1;&#x989D;&#xFF1A;</span><span class="pirc">{{ amountConversion(orderDetails?.discountAmount) || 0 }}</span></div>
        <div><span>&#x5B9E;&#x4ED8;&#x91D1;&#x989D;&#xFF1A;</span><span class="pirc red">{{ amountConversion(orderDetails?.realAmount) || 0 }}</span></div>
      </div>
    </div>

    <el-dialog v-model="refundDialog" title="&#x7533;&#x8BF7;&#x9000;&#x6B3E;" width="40%">
      <div class="refundCont">
        <div class="fx">
          <span class="lab">&#x9000;&#x6B3E;&#x539F;&#x56E0;&#xFF1A;</span>
          <el-select v-model="refundReason" style="width: 100%" placeholder="&#x8BF7;&#x9009;&#x62E9;&#x9000;&#x6B3E;&#x539F;&#x56E0;">
            <el-option v-for="item in refundsOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="fx">
          <span class="lab">&#x95EE;&#x9898;&#x63CF;&#x8FF0;&#xFF1A;</span>
          <el-input v-model="questionDesc" rows="4" maxlength="200" placeholder="&#x8BF7;&#x8F93;&#x5165;&#x9000;&#x6B3E;&#x8BF4;&#x660E;" show-word-limit type="textarea" />
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <div class="bt bt-grey" @click="refundDialog = false">&#x53D6;&#x6D88;</div>
          <div class="bt" @click="refundApplyReq">&#x63D0;&#x4EA4;&#x7533;&#x8BF7;</div>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="refundDetailsDialog" title="&#x9000;&#x6B3E;&#x8BE6;&#x60C5;" width="60%">
      <div class="refundDetailsCont">
        <div class="tab">
          <div class="ut"><p class="ft-wt-600">&#x9000;&#x6B3E; ID</p><p class="ft-cl-des">{{ refundDetailsData?.id }}</p></div>
          <div class="ut"><p class="ft-wt-600">&#x652F;&#x4ED8;&#x65B9;&#x5F0F;</p><p class="ft-cl-des">{{ refundDetailsData?.payChannel || "--" }}</p></div>
          <div class="ut"><p class="ft-wt-600">&#x9000;&#x6B3E;&#x6D41;&#x6C34;&#x53F7;</p><p class="ft-cl-des">{{ refundDetailsData?.refundOrderNo }}</p></div>
          <div class="ut"><p class="ft-wt-600">&#x9000;&#x6B3E;&#x65B9;&#x5F0F;</p><p class="ft-cl-des">{{ refundDetailsData?.refundChannel }}</p></div>
          <div class="ut"><p class="ft-wt-600">&#x8BA2;&#x5355; ID</p><p class="ft-cl-des">{{ refundDetailsData?.orderId }}</p></div>
          <div class="ut"><p class="ft-wt-600">&#x7533;&#x8BF7;&#x539F;&#x56E0;</p><p class="ft-cl-des">{{ refundDetailsData?.refundReason }}</p></div>
          <div class="row">
            <div class="ft-wt-600">&#x64CD;&#x4F5C;&#x65F6;&#x95F4;</div>
            <div class="ft-cl-des fx-wp">
              <span>&#x4E0B;&#x5355;&#x65F6;&#x95F4;&#xFF1A;{{ refundDetailsData?.orderTime }}</span>
              <span>&#x652F;&#x4ED8;&#x65F6;&#x95F4;&#xFF1A;{{ refundDetailsData?.paySuccessTime }}</span>
              <span>&#x7533;&#x8BF7;&#x65F6;&#x95F4;&#xFF1A;{{ refundDetailsData?.createTime }}</span>
              <span>&#x5BA1;&#x6838;&#x65F6;&#x95F4;&#xFF1A;{{ refundDetailsData?.approveTime }}</span>
            </div>
          </div>
          <div class="row">
            <p class="ft-wt-600">&#x5904;&#x7406;&#x7ED3;&#x679C;&#xFF1A;</p>
            <p class="ft-cl-des">&#x5BA1;&#x6279;&#x7ED3;&#x679C;&#xFF1A;{{ refundDetailsData?.remark ? "&#x540C;&#x610F;&#x9000;&#x6B3E;" : "&#x62D2;&#x7EDD;&#x9000;&#x6B3E;" }}</p>
            <p class="ft-cl-des">&#x5BA1;&#x6279;&#x610F;&#x89C1;&#xFF1A;{{ refundDetailsData?.approvalOpinion || "&#x6682;&#x65E0;" }}</p>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import { amountConversion } from "@/utils/tool.js";
import { getOrderDetails, refundsApply, refundsDetails } from "@/api/order.js";
import BreadCrumb from "./components/BreadCrumb.vue";
import CardsTitle from "./components/CardsTitle.vue";
import router from "../../router";

const route = useRoute();

const refundOrderDetail = ref({});
const refundDialog = ref(false);
const refundDetailsDialog = ref(false);
const refundDetailsData = ref();
const orderDetails = ref();
const questionDesc = ref("");
const refundReason = ref("");

const refundsOptions = [
  "\u8BFE\u7A0B\u5185\u5BB9\u6682\u65F6\u4E0D\u7B26\u5408\u5F53\u524D\u9700\u6C42",
  "\u6F14\u793A\u73AF\u5883\u4E0B\u5E0C\u671B\u91CD\u65B0\u5207\u6362\u8BFE\u7A0B",
  "\u8BA2\u5355\u8BEF\u64CD\u4F5C\u521B\u5EFA",
  "\u5E0C\u671B\u91CD\u65B0\u7EC4\u5408\u8D2D\u4E70\u65B9\u6848",
  "\u5176\u4ED6\u539F\u56E0",
];

const couponRule = computed(() => (orderDetails.value?.couponDesc ? orderDetails.value.couponDesc.split("/") : []));

onMounted(() => {
  getOrderDetailsData();
});

const openRefundDialog = (type, detail) => {
  refundOrderDetail.value = detail || {};
  if (type === "details") {
    refundDetailsReq();
    return;
  }
  refundDialog.value = true;
};

const refundApplyReq = async () => {
  if (!refundReason.value) {
    ElMessage({ message: "\u8BF7\u9009\u62E9\u9000\u6B3E\u539F\u56E0", type: "error" });
    return;
  }
  if (!questionDesc.value.trim()) {
    ElMessage({ message: "\u8BF7\u8F93\u5165\u9000\u6B3E\u8BF4\u660E", type: "error" });
    return;
  }
  try {
    const res = await refundsApply({
      orderDetailId: refundOrderDetail.value.id,
      questionDesc: questionDesc.value.trim(),
      refundReason: refundReason.value,
    });
    if (res.code === 200) {
      refundDialog.value = false;
      ElMessage({ message: "\u9000\u6B3E\u7533\u8BF7\u5DF2\u63D0\u4EA4", type: "success" });
      router.push("/personal/main/myOrder");
      return;
    }
    ElMessage({ message: res.msg || "\u9000\u6B3E\u7533\u8BF7\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u9000\u6B3E\u7533\u8BF7\u5931\u8D25", type: "error" });
  }
};

const refundDetailsReq = async () => {
  try {
    const res = await refundsDetails(refundOrderDetail.value.id);
    if (res.code === 200) {
      refundDetailsData.value = res.data;
      refundDetailsDialog.value = true;
      return;
    }
    ElMessage({ message: res.msg || "\u9000\u6B3E\u8BE6\u60C5\u52A0\u8F7D\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u9000\u6B3E\u8BE6\u60C5\u52A0\u8F7D\u5931\u8D25", type: "error" });
  }
};

const getOrderDetailsData = async () => {
  try {
    const res = await getOrderDetails(route.query.id);
    if (res.code === 200) {
      orderDetails.value = res.data;
      return;
    }
    ElMessage({ message: res.msg || "\u8BA2\u5355\u8BE6\u60C5\u52A0\u8F7D\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u8BA2\u5355\u8BE6\u60C5\u52A0\u8F7D\u5931\u8D25", type: "error" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
<style scoped>
.ruleBox {
  display: flex;
  flex-direction: column;
  width: 200px;
}

.ruleBox span {
  width: 200px;
  overflow: hidden;
  line-height: 20px;
  height: 20px;
  text-align: right;
}

.myOrderDetailsWrapper .info .pirc {
  width: 200px;
}
</style>
