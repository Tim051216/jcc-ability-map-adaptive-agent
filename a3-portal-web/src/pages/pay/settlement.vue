<template>
  <div class="settlementWrapper container bg-wt">
    <div class="title">&#x786E;&#x8BA4;&#x7ED3;&#x7B97;</div>
    <div class="introBanner">
      &#x8FD9;&#x91CC;&#x5C55;&#x793A;&#x7684;&#x662F; A3 &#x8D5B;&#x9898;&#x5316;&#x540E;&#x7684;&#x91C7;&#x8D2D;&#x7ED3;&#x7B97;&#x9875;&#xFF0C;&#x4FDD;&#x7559;&#x4E86;&#x4F18;&#x60E0;&#x5238;&#x3001;&#x603B;&#x4EF7;&#x4E0E;&#x652F;&#x4ED8;&#x8DF3;&#x8F6C;&#x7ED3;&#x6784;&#xFF0C;&#x4FBF;&#x4E8E;&#x540E;&#x7EED;&#x7EE7;&#x7EED;&#x63A5;&#x56DE;&#x771F;&#x5B9E;&#x540E;&#x7AEF;&#x3002;
    </div>
    <div class="tab">
      <div class="tabHead fx-sb">
        <div>&#x8BFE;&#x7A0B;&#x540D;&#x79F0;</div>
        <div class="cal">&#x5355;&#x4EF7;&#xFF08;&#x5143;&#xFF09;</div>
      </div>
      <div v-for="item in orderInfo.courses || []" :key="item.id" class="tabItem fx-sb">
        <div class="fx">
          <img :src="item.coverUrl" alt="" />
          <span>{{ item.name || item.courseName }}</span>
        </div>
        <div class="cal ft-cl-err">¥{{ amountConversion(item.nowPrice || item.price) }}</div>
      </div>
    </div>
    <div class="settiementInfo">
      <div class="coupon fx">
        <div v-if="formattedDiscounts.length > 0">
          &#x4F18;&#x60E0;&#x65B9;&#x6848;&#xFF1A;
          <el-select v-model="couponIds" placeholder="&#x8BF7;&#x9009;&#x62E9;&#x4F18;&#x60E0;&#x65B9;&#x6848;" @change="changeHandle">
            <el-option
              v-for="item in formattedDiscounts"
              :key="item.ids"
              :label="item.rule"
              :value="item.ids"
              :disabled="item.disabled"
            />
          </el-select>
        </div>
        <div v-else class="noData">&#x4F18;&#x60E0;&#x65B9;&#x6848;&#xFF1A;&#x6682;&#x65E0;&#x53EF;&#x7528;&#x4F18;&#x60E0;</div>
        <div class="price" style="width: 195px">
          <div class="fx-sb"><span>&#x8BA2;&#x5355;&#x603B;&#x4EF7;&#xFF1A;</span><span>¥{{ amountConversion(orderInfo.totalAmount) }}</span></div>
          <div class="fx-sb"><span>&#x4F18;&#x60E0;&#x91D1;&#x989D;&#xFF1A;</span><span>¥{{ amountConversion(discountAmount) }}</span></div>
        </div>
      </div>
      <div class="paid"><span>&#x5B9E;&#x4ED8;&#x91D1;&#x989D;&#xFF1A;</span><span class="ft-cl-err">¥{{ price }}</span></div>
      <div @click="orderHandle"><span class="bt bt-red">&#x63D0;&#x4EA4;&#x8BA2;&#x5355;</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { confirmOrderInfo, setOrder } from "@/api/order.js";
import { amountConversion } from "@/utils/tool.js";

const route = useRoute();
const router = useRouter();
const discountAmount = ref(0);
const couponIds = ref("");
const orderInfo = ref({ courses: [], discounts: [], totalAmount: 0 });

onMounted(() => {
  loadSettlementInfo();
});

const formattedDiscounts = computed(() =>
  (orderInfo.value.discounts || []).map((item) => ({
    ...item,
    ids: Array.isArray(item.ids) ? item.ids.join(",") : item.ids,
    rule:
      item.rules?.length > 1
        ? `\u7EC4\u5408\u4F18\u60E0\uFF1A\u5171\u51CF ¥${amountConversion(item.discountAmount)}`
        : item.rules?.[0] || "\u53EF\u7528\u4F18\u60E0",
  })),
);

const price = computed(() => {
  const current = (Number(orderInfo.value.totalAmount || 0) - Number(discountAmount.value || 0)) / 100;
  return current > 0 ? current.toFixed(2) : "0.00";
});

const loadSettlementInfo = async () => {
  try {
    const res = await confirmOrderInfo({ courseIds: route.query.courseIds });
    if (res.code === 200) {
      orderInfo.value = res.data || { courses: [], discounts: [], totalAmount: 0 };
      return;
    }
    ElMessage({ type: "error", message: res.msg || "\u7ED3\u7B97\u4FE1\u606F\u52A0\u8F7D\u5931\u8D25" });
  } catch (error) {
    ElMessage({ type: "error", message: "\u7ED3\u7B97\u4FE1\u606F\u52A0\u8F7D\u5931\u8D25" });
  }
};

const changeHandle = (value) => {
  const target = formattedDiscounts.value.find((item) => item.ids === value);
  discountAmount.value = Number(target?.discountAmount || 0);
};

const orderHandle = async () => {
  const courseIds = (orderInfo.value.courses || []).map((item) => item.courseId || item.id);
  const params = { courseIds, orderId: orderInfo.value.orderId };
  if (couponIds.value) {
    params.couponIds = couponIds.value.split(",");
  }
  try {
    const res = await setOrder(params);
    if (res.code === 200) {
      router.push({
        path: "/pay/payment",
        query: { orderId: res.data.orderId, payAmount: price.value },
      });
      return;
    }
    ElMessage({ type: "error", message: res.msg || "\u8BA2\u5355\u63D0\u4EA4\u5931\u8D25" });
  } catch (error) {
    ElMessage({ type: "error", message: "\u8BA2\u5355\u63D0\u4EA4\u5931\u8D25" });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
<style lang="scss" scoped>
.introBanner {
  margin-bottom: 20px;
  padding: 14px 18px;
  line-height: 24px;
  border-radius: 8px;
  background: #f7f9fb;
  color: #4e5969;
}
</style>
