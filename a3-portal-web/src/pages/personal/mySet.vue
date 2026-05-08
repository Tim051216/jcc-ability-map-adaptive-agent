<template>
  <div class="mySetWrapper content">
    <CardsTitle class="marg-bt-40" title="&#x4E2A;&#x4EBA;&#x8BBE;&#x7F6E;" />
    <TableSwitchBar :data="tabData" @changeTable="checkHandle" />

    <div v-if="act === 0" class="fx-sb pd-tp-30">
      <div>
        <div class="fx">
          <div class="item fx">
            <span class="lab">&#x6635;&#x79F0;&#xFF1A;</span>
            <el-input v-model="user.name" placeholder="&#x8BF7;&#x8F93;&#x5165;&#x6635;&#x79F0;" />
          </div>
        </div>
        <div class="item fx">
          <span class="lab">&#x6027;&#x522B;&#xFF1A;</span>
          <el-radio-group v-model="user.gender" class="radioGroup">
            <el-radio :label="0">&#x7537;</el-radio>
            <el-radio :label="1">&#x5973;</el-radio>
          </el-radio-group>
        </div>
        <div class="item fx">
          <div class="bt" @click="updateUserInfoHandle">&#x66F4;&#x65B0;&#x4FE1;&#x606F;</div>
        </div>
      </div>

      <div>
        <el-upload
          class="avatar-uploader"
          :action="actions"
          :show-file-list="false"
          :on-success="handleAvatarSuccess"
          :headers="uploadHeaders"
        >
          <img v-if="imageUrl" :src="imageUrl" class="avatar" />
          <i v-else class="el-icon-plus avatar-uploader-icon"></i>
          <div class="uploadBut">
            <span>&#x4E0A;&#x4F20;&#x5934;&#x50CF;</span>
          </div>
        </el-upload>
      </div>
    </div>

    <div v-else class="set pd-tp-30">
      <div class="line fx-sb">
        <div>
          <span>&#x767B;&#x5F55;&#x5BC6;&#x7801;</span>
          &#x5F53;&#x524D;&#x5BC6;&#x7801;&#x5F3A;&#x5EA6;&#xFF1A;&#x4E2D;
        </div>
        <span class="font-bt" @click="changeHandle">&#x4FEE;&#x6539;</span>
      </div>
      <div class="line fx-sb">
        <div>
          <span>&#x7ED1;&#x5B9A;&#x624B;&#x673A;</span>
          &#x5F53;&#x524D;&#x624B;&#x673A;&#x53F7;&#xFF1A;{{ maskedPhone }}
        </div>
        <span class="font-bt" @click="changeHandle">&#x4FEE;&#x6539;</span>
      </div>
      <div class="line fx-sb">
        <div>
          <span>&#x7ED1;&#x5B9A;&#x90AE;&#x7BB1;</span>
          &#x5F53;&#x524D;&#x90AE;&#x7BB1;&#xFF1A;{{ maskedEmail }}
        </div>
        <span class="font-bt" @click="changeHandle">&#x4FEE;&#x6539;</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import proxy from "@/config/proxy";
import { getUserInfo, updateUserInfo } from "@/api/user.js";
import { useUserStore } from "@/store";
import CardsTitle from "./components/CardsTitle.vue";
import TableSwitchBar from "@/components/TableSwitchBar.vue";

const store = useUserStore();
const userInfo = ref(store.getUserInfo || {});

const env = import.meta.env.MODE || "development";
const uploadHost = proxy[env]?.host || proxy.local?.host || "/api";
const actions = `${uploadHost}/ms/files`;
const uploadHeaders = { authorization: store.getToken };

const tabData = [
  { id: 0, name: "\u57fa\u672c\u4fe1\u606f" },
  { id: 1, name: "\u5b89\u5168\u8bbe\u7f6e" },
];

const act = ref(0);
const user = reactive({
  name: userInfo.value?.name || "",
  icon: userInfo.value?.icon || "",
  gender: userInfo.value?.gender ?? 0,
});
const imageUrl = ref(user.icon);

const maskedPhone = computed(() => {
  const phone = userInfo.value?.cellPhone || userInfo.value?.phone;
  if (!phone || phone.length < 7) {
    return "\u672a\u8bbe\u7f6e";
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
});

const maskedEmail = computed(() => {
  const email = userInfo.value?.email;
  if (!email || !email.includes("@")) {
    return "\u672a\u8bbe\u7f6e";
  }
  const [name, domain] = email.split("@");
  if (name.length <= 2) {
    return `${name[0] || "*"}***@${domain}`;
  }
  return `${name.slice(0, 2)}***@${domain}`;
});

const checkHandle = (val) => {
  act.value = val;
};

function handleAvatarSuccess(res, file) {
  if (res.code === 200) {
    imageUrl.value = URL.createObjectURL(file.raw);
    user.icon = res.data.path;
    return;
  }
  ElMessage({
    message: "\u5934\u50cf\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5",
    type: "error",
  });
}

const changeHandle = () => {
  ElMessage({
    message: "\u6f14\u793a\u7248\u6682\u672a\u5f00\u653e\u8be5\u9879\u4fee\u6539",
    type: "info",
  });
};

const updateUserInfoHandle = async () => {
  try {
    const res = await updateUserInfo(user);
    if (res.code !== 200) {
      ElMessage({
        message: res.msg || "\u66f4\u65b0\u7528\u6237\u4fe1\u606f\u5931\u8d25",
        type: "error",
      });
      return;
    }

    const data = await getUserInfo();
    if (data.code === 200) {
      store.setUserInfo(data.data);
      userInfo.value = data.data;
      user.name = data.data?.name || "";
      user.icon = data.data?.icon || "";
      user.gender = data.data?.gender ?? 0;
      imageUrl.value = user.icon;
    }

    ElMessage({
      message: "\u4e2a\u4eba\u4fe1\u606f\u5df2\u66f4\u65b0",
      type: "success",
    });
  } catch (error) {
    ElMessage({
      message: "\u66f4\u65b0\u7528\u6237\u4fe1\u606f\u5931\u8d25",
      type: "error",
    });
  }
};
</script>

<style lang="scss" src="./index.scss"></style>
