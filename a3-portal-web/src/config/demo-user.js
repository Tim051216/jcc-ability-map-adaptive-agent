import defaultAvatar from "@/assets/icon.jpeg";

export const DEMO_LOGIN = {
  username: "18810966208",
  password: "123456",
  token: "a3-portal-demo-token",
  userInfo: {
    id: 1,
    name: "A3演示用户",
    icon: defaultAvatar,
    gender: 0,
  },
};

export const isDemoCredential = (username, password) =>
  username === DEMO_LOGIN.username && password === DEMO_LOGIN.password;

export const isPortalDemoUser = (token) => token === DEMO_LOGIN.token;

export const getDemoUserInfo = () => ({ ...DEMO_LOGIN.userInfo });

export const updateDemoUserInfo = (payload = {}) => {
  DEMO_LOGIN.userInfo = {
    ...DEMO_LOGIN.userInfo,
    ...payload,
  };
  return getDemoUserInfo();
};
