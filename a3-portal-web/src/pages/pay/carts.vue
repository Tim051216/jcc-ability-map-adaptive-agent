<template>
  <div class="cartsWrapper">
    <div class="container bg-wt marg-bt-20">
      <div class="title">课程采购清单<span>共 {{ carts.length }} 门课程</span></div>
      <div v-if="carts.length > 0" class="introBanner">
        当前页面用于演示课程采购与结算链路，已统一为 A3 赛题场景文案，支持继续进入结算与支付页面。
      </div>
      <div v-if="carts.length > 0" class="tab">
        <div class="tabHead fx-sb">
          <div>课程名称</div>
          <div class="fx">
            <div class="cal">单价（元）</div>
            <div class="cal">操作</div>
          </div>
        </div>
        <el-checkbox-group v-model="checkedList" @change="handleCheckedChange">
          <div v-for="item in carts" :key="item.id" class="tabItem fx-sb">
            <div class="checkBox fx">
              <el-checkbox :label="item.id" :disabled="item.expired">
                <img :src="item.coverUrl" alt="" />
              </el-checkbox>
              <span class="name" style="cursor: pointer" @click="goDetails(item.courseId)">
                {{ item.courseName }}{{ item.expired ? "（已失效）" : "" }}
              </span>
            </div>
            <div class="fx" style="align-items: center">
              <div class="cart-price">
                <div class="cal ft-cl-err">¥{{ amountConversion(item.nowPrice) }}</div>
                <div v-if="item.nowPrice < item.price" class="cal ft-cl-err cart-price-div">
                  比原价优惠 ¥{{ amountConversion(item.price - item.nowPrice) }}
                </div>
              </div>
              <div class="cal font-bt2" @click="delHandle(item)">移除</div>
            </div>
          </div>
        </el-checkbox-group>
      </div>
      <div v-else class="empty">
        <div><img src="@/assets/img_gouwuche.png" width="200" alt="" /></div>
        <div class="desc">还没有加入课程。可以先去课程展示页挑选想演示的专题课，再回到这里统一结算。</div>
        <div class="bt" @click="() => $router.push('/classList/index')">继续选课</div>
      </div>
    </div>

    <div v-if="carts.length > 0" class="container bg-wt fx-sb">
      <div class="allAction fx">
        <div class="marg-rt-20">
          <el-checkbox v-model="checkAll" :indeterminate="isIndeterminate" @change="handleCheckAllChange">全选</el-checkbox>
        </div>
        <div class="bt bt-grey1" @click="delHandle('all')">批量移除</div>
      </div>
      <div class="count ft-14 fx fx-1">
        <div>
          <p>合计：<span class="pric">¥{{ amountConversion(totalAmount) }}</span></p>
          <p>优惠券与折扣会在下一步结算页统一展示，当前价格仅用于演示链路。</p>
        </div>
        <div class="bt bt-red" @click="goSettlement">去结算</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import router from "../../router";
import { delCarts, getCarts } from "@/api/order.js";
import { amountConversion } from "@/utils/tool.js";

const carts = ref([]);
const checkAll = ref(false);
const checkedList = ref([]);
const isIndeterminate = ref(false);
const totalAmount = ref(0);

const selectableIds = computed(() => carts.value.filter((item) => !item.expired).map((item) => item.id));

onMounted(() => {
  getCartsData();
});

const goDetails = (id) => {
  router.push({ path: "/details", query: { id } });
};

const getCartsData = async () => {
  try {
    const res = await getCarts();
    if (res.code === 200) {
      carts.value = res.data || [];
      checkedList.value = selectableIds.value;
      checkAll.value = checkedList.value.length > 0 && checkedList.value.length === selectableIds.value.length;
      isIndeterminate.value = false;
      calcTotalAmount();
      return;
    }
    ElMessage({ type: "error", message: res.msg || "购物车加载失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "购物车加载失败" });
  }
};

const calcTotalAmount = () => {
  totalAmount.value = carts.value
    .filter((item) => checkedList.value.includes(item.id))
    .reduce((sum, item) => sum + Number(item.nowPrice || 0), 0);
};

const handleCheckAllChange = (value) => {
  checkedList.value = value ? selectableIds.value : [];
  isIndeterminate.value = false;
  calcTotalAmount();
};

const handleCheckedChange = (value) => {
  const checkedCount = value.length;
  checkAll.value = checkedCount > 0 && checkedCount === selectableIds.value.length;
  isIndeterminate.value = checkedCount > 0 && checkedCount < selectableIds.value.length;
  calcTotalAmount();
};

const delHandle = async (item) => {
  const ids = item === "all" ? checkedList.value : [item.id];
  if (!ids.length) {
    ElMessage({ type: "warning", message: "请先选择要移除的课程" });
    return;
  }
  try {
    const res = await delCarts(ids);
    if (res.code === 200) {
      ElMessage({ type: "success", message: "课程已移出清单" });
      getCartsData();
      return;
    }
    ElMessage({ type: "error", message: res.msg || "移除失败" });
  } catch (error) {
    ElMessage({ type: "error", message: "移除失败" });
  }
};

const goSettlement = () => {
  if (!checkedList.value.length) {
    ElMessage({ type: "warning", message: "请先选择要结算的课程" });
    return;
  }
  const list = carts.value.filter((item) => checkedList.value.includes(item.id));
  router.push({
    path: "/pay/settlement",
    query: { courseIds: list.map((item) => item.courseId).join(",") },
  });
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
