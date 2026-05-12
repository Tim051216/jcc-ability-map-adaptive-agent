import { defineStore } from "pinia";

export const dataCacheStore = defineStore("notification", {
  state: () => ({
    courseClassDataes: [],
    // 首页课程区块单独缓存，返回首页时可以先秒开再后台刷新。
    homeFreeClassDataes: [],
    homeGoodClassDataes: [],
    homeNewClassDataes: [],
    searchKey: "",
    askDetails: "22",
    learingDataes: {
      classDetailsData: {},
      teacherData: {},
      classSectionMap: {},
      classCatalogs: {},
      planData: {},
    },
    currentPlayData: {},
    orderClassInfo: {},
    currentCourseInfo: {},
    myLearnClassInfo: {},
  }),
  getters: {
    getAskDetails: (state) => state.askDetails,
    getSearchKey: (state) => state.searchKey,
    getLearingDataes: (state) => state.learingDataes,
    getCurrentPlayData: (state) => state.currentPlayData,
    getOrderClassInfo: (state) => state.orderClassInfo,
    getCourseClassDataes: (state) => state.courseClassDataes,
    getHomeFreeClassDataes: (state) => state.homeFreeClassDataes,
    getHomeGoodClassDataes: (state) => state.homeGoodClassDataes,
    getHomeNewClassDataes: (state) => state.homeNewClassDataes,
    getCurrentCourseInfo: (state) => state.currentCourseInfo,
    getMyLearnClassInfo: (state) => state.myLearnClassInfo,
  },
  actions: {
    setCurrentCourseInfo(data) {
      this.currentCourseInfo = data;
    },
    setAskDetails(data) {
      this.askDetails = data;
    },
    setSearchKey(data) {
      this.searchKey = data;
    },
    setLearingDataes(data) {
      this.learingDataes = data;
    },
    setCurrentPlayData(data) {
      this.currentPlayData = data;
    },
    setOrderClassInfo(data) {
      this.orderClassInfo = data;
    },
    setCourseClassDataes(data) {
      this.courseClassDataes = data;
    },
    setHomeFreeClassDataes(data) {
      this.homeFreeClassDataes = data;
    },
    setHomeGoodClassDataes(data) {
      this.homeGoodClassDataes = data;
    },
    setHomeNewClassDataes(data) {
      this.homeNewClassDataes = data;
    },
    setMyLearnClassInfo(data) {
      this.myLearnClassInfo = data;
    },
  },
  persist: {
    enabled: true,
    encryptionKey: "data-catch",
  },
});
