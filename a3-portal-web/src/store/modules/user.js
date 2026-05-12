import { defineStore } from "pinia";
import { TOKEN_NAME } from "@/config/global";
import store from "@/store";
import { tryRefreshToken } from "@/utils/refreshToken";

const InitUserInfo = {};

const safeParseUserInfo = () => {
  const raw = sessionStorage.getItem("userInfo");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem("userInfo");
    return null;
  }
};

export const useUserStore = defineStore("user", {
  id: "userInfo",
  state: () => ({
    token: sessionStorage.getItem(TOKEN_NAME),
    userInfo: safeParseUserInfo(),
  }),
  persist: {
    enabled: true,
    strategies: [{ storage: sessionStorage, paths: ["token", "userInfo"] }],
  },
  getters: {
    getToken: (state) => state.token,
    getUserInfo: (state) => state.userInfo,
  },
  actions: {
    async setToken(token) {
      this.token = token;
      sessionStorage.setItem(TOKEN_NAME, token);
    },
    async setUserInfo(userInfo) {
      this.userInfo = userInfo;
      sessionStorage.setItem("userInfo", JSON.stringify(userInfo));
    },
    async logout() {
      sessionStorage.removeItem(TOKEN_NAME);
      sessionStorage.removeItem("userInfo");
      this.token = "";
      this.userInfo = InitUserInfo;
    },
    async removeToken() {
      this.token = "";
    },
  },
});

async function refresh() {
  return await tryRefreshToken();
}

export function getToken() {
  return useUserStore(store);
}

export function isLogin() {
  if (sessionStorage.getItem(TOKEN_NAME)) {
    return true;
  }
  return refresh();
}
