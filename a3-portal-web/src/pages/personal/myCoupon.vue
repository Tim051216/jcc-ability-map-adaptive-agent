<template>
  <div class="couponWrapper">
    <div class="personalCards">
      <div class="headTop fx-sb">
        <CardsTitle class="marg-bt-20" title="&#x6211;&#x7684;&#x4F18;&#x60E0;&#x5238;" />
        <div class="fx">
          <span class="font-bt ft-14" @click="dialogVisible = true">&#x5151;&#x6362;&#x4F18;&#x60E0;&#x5238;&gt;</span>
          <span class="font-bt ft-14" @click="goCouponExplain">&#x4F7F;&#x7528;&#x8BF4;&#x660E; &gt;</span>
        </div>
      </div>

      <TableSwitchBar :data="tableBar" @changeTable="changeTable" />

      <div class="myCouponItems">
        <CouponCards v-if="myCoupon.length > 0" :data="myCoupon" :type="actId" />
        <div v-else class="nodata">
          <Empty />
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="&#x5151;&#x6362;&#x4F18;&#x60E0;&#x5238;" width="30%">
      <div class="exchangeCoupon fx">
        <span>&#x4F18;&#x60E0;&#x7801;&#xFF1A;</span>
        <el-input v-model="inputVal" type="text" placeholder="&#x8BF7;&#x8F93;&#x5165;&#x4F18;&#x60E0;&#x7801;" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <div class="bt bt-grey" @click="dialogVisible = false">&#x53D6;&#x6D88;</div>
          <div class="bt" @click="exchangeCouponHandle">&#x7ACB;&#x5373;&#x5151;&#x6362;</div>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { exchangeCoupon, getMyCoupon } from "@/api/class.js";
import CardsTitle from "./components/CardsTitle.vue";
import TableSwitchBar from "./components/TableSwitch.vue";
import CouponCards from "@/components/CouponCards.vue";
import Empty from "@/components/Empty.vue";

const router = useRouter();

const tableBar = [
  { id: 1, name: "\u672A\u4F7F\u7528" },
  { id: 2, name: "\u5DF2\u4F7F\u7528" },
  { id: 3, name: "\u5DF2\u8FC7\u671F" },
];

const actId = ref(1);
const myCoupon = ref([]);
const dialogVisible = ref(false);
const inputVal = ref("");

onMounted(() => {
  getMyCouponData();
});

const formatRule = (item) => {
  switch (item.discountType) {
    case 1:
      return `\u6BCF\u6EE1 ${item.thresholdAmount / 100} \u5143\u51CF ${item.discountValue / 100} \u5143\uFF0C\u6700\u9AD8\u51CF ${item.maxDiscountAmount / 100} \u5143`;
    case 2:
      return `\u6EE1 ${item.thresholdAmount / 100} \u5143\u6253 ${item.discountValue / 10} \u6298\uFF0C\u6700\u9AD8\u51CF ${item.maxDiscountAmount / 100} \u5143`;
    case 3:
      return `\u65E0\u95E8\u69DB\u62B5\u6263 ${item.discountValue / 100} \u5143`;
    case 4:
      return `\u6EE1 ${item.thresholdAmount / 100} \u5143\u51CF ${item.discountValue / 100} \u5143`;
    default:
      return "\u4EE5\u5238\u9762\u89C4\u5219\u4E3A\u51C6";
  }
};

const changeTable = (id) => {
  actId.value = id;
  getMyCouponData();
};

const goCouponExplain = () => {
  router.push({ path: "/personal/main/myCouponExplain" });
};

const getMyCouponData = async () => {
  try {
    const res = await getMyCoupon({
      status: actId.value,
      pageNo: 1,
      pageSize: 1000,
    });
    if (res.code === 200) {
      myCoupon.value = (res.data?.list || []).map((item) => ({
        ...item,
        rule: formatRule(item),
      }));
      return;
    }
    ElMessage({ message: res.msg || "\u4F18\u60E0\u5238\u5217\u8868\u52A0\u8F7D\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u4F18\u60E0\u5238\u5217\u8868\u52A0\u8F7D\u5931\u8D25", type: "error" });
  }
};

const exchangeCouponHandle = async () => {
  if (!inputVal.value.trim()) {
    ElMessage({ message: "\u8BF7\u8F93\u5165\u4F18\u60E0\u7801", type: "warning" });
    return;
  }

  try {
    const res = await exchangeCoupon({ code: inputVal.value.trim() });
    if (res.code === 200) {
      ElMessage({ message: "\u4F18\u60E0\u5238\u5151\u6362\u6210\u529F", type: "success" });
      dialogVisible.value = false;
      inputVal.value = "";
      getMyCouponData();
      return;
    }
    ElMessage({ message: res.msg || "\u4F18\u60E0\u5238\u5151\u6362\u5931\u8D25", type: "error" });
  } catch (error) {
    ElMessage({ message: "\u4F18\u60E0\u5238\u5151\u6362\u5931\u8D25", type: "error" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
