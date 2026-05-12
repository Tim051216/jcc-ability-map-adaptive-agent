import request from "@/utils/request.js";
import {
  getAiLearningCourseDetail,
  listAiCourseCategories,
  listAiInterestCourses,
  listAiRecommendCourses,
  searchAiCourses,
} from "@/api/ai.js";
import {
  demoInterests,
  demoRecommendCourses,
  enrollDemoCourse,
  exchangeDemoCoupon,
  getDemoBoard,
  getDemoCouponPage,
  getDemoCourseLearning,
  getDemoCurrentLesson,
  getDemoExamPage,
  getDemoLearningDetails,
  getDemoLessonsPage,
  getDemoMediaSignature,
  getDemoPlans,
  getDemoSearchPage,
  getDemoSeasonOptions,
  getDemoSignRecords,
  getDemoTodayPoints,
  isPortalDemoMode,
  recordDemoPlayLog,
  removeDemoLesson,
  saveDemoPlan,
  signDemoPoints,
} from "@/config/demo-learning";
import courseCoverAiStudy from "@/assets/course-covers/course-cover-ai-study.jpg";
import courseCoverBootcamp from "@/assets/course-covers/course-cover-bootcamp.jpg";
import courseCoverFrontend from "@/assets/course-covers/course-cover-frontend.jpg";
import courseCoverLlm from "@/assets/course-covers/course-cover-llm.jpg";
import courseCoverMicroservice from "@/assets/course-covers/course-cover-microservice.jpg";

const SEARCH_API_PREFIX = "/ss";
const COURSE_API_PREFIX = "/cs";
const LEARNING_API_PREFIX = "/ls";
const MEDIA_API_PREFIX = "/ms";
const PROMOTION_API_PREFIX = "/prs";
const EXAM_API_PREFIX = "/es";
const isA3LocalMode = import.meta.env.MODE === "a3local";
const shouldUseAiCourseApi = () => isA3LocalMode && !isPortalDemoMode();

const A3_PORTAL_CATEGORIES = [
  {
    id: 1,
    name: "\u4eba\u5de5\u667a\u80fd",
    children: [
      { id: 11, name: "\u673a\u5668\u5b66\u4e60" },
      { id: 12, name: "\u5927\u6a21\u578b\u5e94\u7528" },
    ],
  },
  {
    id: 2,
    name: "\u540e\u7aef\u5f00\u53d1",
    children: [
      { id: 21, name: "Java \u5fae\u670d\u52a1" },
      { id: 22, name: "Spring Cloud" },
    ],
  },
  {
    id: 3,
    name: "\u524d\u7aef\u5f00\u53d1",
    children: [
      { id: 31, name: "Vue 3" },
      { id: 32, name: "\u5de5\u7a0b\u5316" },
    ],
  },
];

const cloneDemoData = (value) => JSON.parse(JSON.stringify(value));

const A3_RECOMMEND_COURSE_OVERRIDES = {
  101: {
    name: "A3 智能学习助手实战",
    teacher: "A3 教学团队",
    teacherName: "A3 教学团队",
    coverUrl: courseCoverAiStudy,
  },
  102: {
    name: "Spring Cloud 微服务训练营",
    teacher: "平台研发组",
    teacherName: "平台研发组",
    coverUrl: courseCoverMicroservice,
  },
  201: {
    name: "Vue 3 项目工程化落地",
    teacher: "前端架构组",
    teacherName: "前端架构组",
    coverUrl: courseCoverFrontend,
  },
  301: {
    name: "大模型应用开发导论",
    teacher: "A3 AI 实验室",
    teacherName: "A3 AI 实验室",
    coverUrl: courseCoverLlm,
  },
  302: {
    name: "软挑赛题项目实训",
    teacher: "竞赛辅导组",
    teacherName: "竞赛辅导组",
    coverUrl: courseCoverBootcamp,
  },
};

const normalizeRecommendCourseCards = (courses = []) =>
  cloneDemoData(courses).map((course) => ({
    ...course,
    ...(A3_RECOMMEND_COURSE_OVERRIDES[course?.id] || {}),
  }));

const isSuspiciousCategoryName = (value = "") => {
  if (typeof value !== "string") {
    return false;
  }
  const text = value.trim();
  if (!text) {
    return true;
  }
  if (/[\[\]{}]/.test(text)) {
    return true;
  }
  if (/_/.test(text) && !/^[A-Za-z]+\s\d+$/.test(text)) {
    return true;
  }
  return !/[\u4e00-\u9fa5]/.test(text) && /[A-Za-z]/.test(text) && /\d/.test(text) && text.length >= 6;
};

const shouldFallbackCategories = (categories = []) =>
  !Array.isArray(categories) ||
  categories.length === 0 ||
  categories.some((item) => {
    const children = Array.isArray(item?.children) ? item.children : [];
    return isSuspiciousCategoryName(item?.name) || children.some((child) => isSuspiciousCategoryName(child?.name));
  });

export const normalizeCategoryData = (categories = []) =>
  shouldFallbackCategories(categories) ? cloneDemoData(A3_PORTAL_CATEGORIES) : categories;

const normalizeAiCourseCard = (course = {}) => ({
  id: course.id,
  courseCode: course.course_code,
  name: course.name,
  coverUrl: course.cover_url,
  price: course.price,
  sold: course.sold,
  sections: course.sections,
  teacher: course.teacher,
  teacherName: course.teacher_name,
  summary: course.summary,
  categoryPath: course.category_path,
  validDuration: course.valid_duration,
  score: course.score,
});

const wrapAiData = (data) => ({ code: 200, data });

export const getClassCategorys = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({ code: 200, data: cloneDemoData(A3_PORTAL_CATEGORIES) })
    : shouldUseAiCourseApi()
      ? listAiCourseCategories().then((data) => wrapAiData(normalizeCategoryData(data || [])))
    : request({
        url: `${COURSE_API_PREFIX}/categorys/all`,
        method: "get",
        params,
      }).then((res) => {
        if (res?.code === 200) {
          return {
            ...res,
            data: normalizeCategoryData(res.data),
          };
        }
        return res;
      });

export const getRecommendClassList = (type) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: normalizeRecommendCourseCards(demoRecommendCourses[type] || []),
      })
    : shouldUseAiCourseApi()
      ? listAiRecommendCourses(type).then((data) => wrapAiData((data || []).map(normalizeAiCourseCard)))
    : request({
        url: `${SEARCH_API_PREFIX}/recommend/${type}`,
        method: "get",
      });

export const getClassList = (id) =>
  shouldUseAiCourseApi()
    ? listAiInterestCourses(id).then((data) => wrapAiData((data || []).map(normalizeAiCourseCard)))
    : request({
    url: `${SEARCH_API_PREFIX}/interests/${id}/courses`,
    method: "get",
  });

export const getLearningPlan = () =>
  request({
    url: `${LEARNING_API_PREFIX}/plans`,
    method: "get",
  });

export const getCourseLearning = (courseId) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoCourseLearning(courseId),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/lessons/${courseId}`,
        method: "get",
      });

export const classSeach = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoSearchPage(params),
      })
    : shouldUseAiCourseApi()
      ? searchAiCourses(params).then((data) =>
          wrapAiData({
            ...data,
            list: (data?.list || []).map(normalizeAiCourseCard),
          }),
        )
    : request({
        url: `${SEARCH_API_PREFIX}/courses/portal`,
        method: "get",
        params,
      });

export const getLearningClassDetails = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoLearningDetails(id),
      })
    : shouldUseAiCourseApi()
      ? getAiLearningCourseDetail(id).then((data) =>
          wrapAiData({
            id: data.id,
            courseCode: data.course_code,
            name: data.name,
            coverUrl: data.cover_url,
            teacherName: data.teacher_name,
            lessonId: data.lesson_id,
            latestSectionId: data.latest_section_id,
            moment: data.moment,
            chapters: (data.chapters || []).map((chapter) => ({
              id: chapter.id,
              index: chapter.index,
              name: chapter.name,
              mediaDuration: chapter.media_duration,
              sections: (chapter.sections || []).map((section) => ({
                id: section.id,
                index: section.index,
                name: section.name,
                type: section.type,
                mediaDuration: section.media_duration,
                trailer: section.trailer,
                subjectNum: section.subject_num,
                moment: section.moment,
              })),
            })),
          }),
        )
    : request({
        url: `${COURSE_API_PREFIX}/courses/${id}/catalogs`,
        method: "get",
      });

export const setInterests = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({ code: 200, data: true })
    : request({
        url: `${SEARCH_API_PREFIX}/interests`,
        method: "post",
        data: params,
        params,
      });

export const getInterests = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({ code: 200, data: Array.from(demoInterests) })
    : request({
        url: `${SEARCH_API_PREFIX}/interests`,
        method: "get",
        params,
      });

export const getMediasSignature = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoMediaSignature(params.sectionId),
      })
    : request({
        url: `${MEDIA_API_PREFIX}/medias/signature/play`,
        method: "get",
        params,
      });

export const formatRule = (coupon) => {
  const threshold = Number(coupon.thresholdAmount || 0) / 100;
  const value = Number(coupon.discountValue || 0) / 100;
  const max = Number(coupon.maxDiscountAmount || 0) / 100;

  switch (coupon.discountType) {
    case 1:
      return `每满 ${threshold} 元减 ${value} 元，最高减 ${max} 元`;
    case 2:
      return `满 ${threshold} 元打 ${Number(coupon.discountValue || 0) / 10} 折，最高减 ${max} 元`;
    case 3:
      return `无门槛抵扣 ${value} 元`;
    case 4:
      return `满 ${threshold} 元减 ${value} 元`;
    case 5:
      return `限时 ${Number(coupon.discountValue || 0) / 10} 折优惠`;
    default:
      return "以券面规则为准";
  }
};

export const getCollectableCoupon = (params) =>
  request({
    url: `${PROMOTION_API_PREFIX}/coupons/list`,
    method: "get",
    params,
  });

export const getMyCoupon = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoCouponPage(params),
      })
    : request({
        url: `${PROMOTION_API_PREFIX}/user-coupons/page`,
        method: "get",
        params,
      });

export const getCoupon = (params) =>
  request({
    url: `${PROMOTION_API_PREFIX}/user-coupons/${params.id}/receive`,
    method: "post",
  });

export const exchangeCoupon = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: exchangeDemoCoupon(data.code) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${PROMOTION_API_PREFIX}/user-coupons/${data.code}/exchange`,
        method: "post",
      });

export const getMylessons = () =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoLessonsPage(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/lessons/page`,
        method: "get",
      });

export const getMyLearning = () =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoCurrentLesson(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/lessons/now`,
        method: "get",
      });

export const getMyPlan = () =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoPlans(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/lessons/plans`,
        method: "get",
      });

export const signUp = (courseId) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: enrollDemoCourse(courseId) ? 200 : 500,
        data: true,
      })
    : request({
        url: `/ts/orders/freeCourse/${courseId}`,
        method: "post",
      });

export const delMyClass = (courseId) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: removeDemoLesson(courseId) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${LEARNING_API_PREFIX}/lessons/${courseId}`,
        method: "delete",
      });

export const creatPlans = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: saveDemoPlan(params) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${LEARNING_API_PREFIX}/lessons/plans`,
        method: "post",
        data: params,
      });

export const getExamList = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoExamPage(params),
      })
    : request({
        url: `${EXAM_API_PREFIX}/exams/page`,
        method: "get",
        params,
      });

export const getExamDetails = (id) =>
  request({
    url: `${EXAM_API_PREFIX}/exams/${id}`,
    method: "get",
  });

export const submitExamRecords = (params) =>
  request({
    url: `${EXAM_API_PREFIX}/exam-records/details`,
    method: "post",
    data: params,
  });

export const addExamRecords = (params) =>
  request({
    url: `${EXAM_API_PREFIX}/exam-records`,
    method: "post",
    data: params,
  });

export const getLearningLog = (lessonId) =>
  request({
    url: `${LEARNING_API_PREFIX}/learning-records/lessons/${lessonId}`,
    method: "get",
  });

export const addPlayLog = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: recordDemoPlayLog(params) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${LEARNING_API_PREFIX}/learning-records`,
        method: "post",
        data: params,
      });

export const pointsSign = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: signDemoPoints(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/sign-records`,
        method: "post",
        data: params,
      });

export const getSignRecords = () =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoSignRecords(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/sign-records`,
        method: "get",
      });

export const getTodayPoints = () =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoTodayPoints(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/points/today`,
        method: "get",
      });

export const getSeasons = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoBoard(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/boards`,
        method: "get",
        params,
      });

export const getSelectOptions = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoSeasonOptions(),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/boards/seasons/list`,
        method: "get",
        params,
      });

