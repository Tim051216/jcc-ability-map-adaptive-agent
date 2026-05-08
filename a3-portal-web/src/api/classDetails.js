import request from "@/utils/request.js";
import {
  addDemoQuestion,
  getDemoAskPage,
  getDemoClassCatalog,
  getDemoClassDetails,
  getDemoClassTeachers,
  getDemoQuestionChapters,
  getDemoQuestionDetails,
  getDemoReplyPage,
  isPortalDemoMode,
  postDemoAnswer,
  toggleDemoQaLike,
} from "@/config/demo-learning";

const COURSE_API_PREFIX = "/cs";
const LEARNING_API_PREFIX = "/ls";

export const getClassDetails = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoClassDetails(id),
      })
    : request({
        url: `${COURSE_API_PREFIX}/courses/baseInfo/${id}`,
        method: "get",
      });

export const getClassTeachers = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoClassTeachers(id),
      })
    : request({
        url: `${COURSE_API_PREFIX}/courses/teachers/${id}`,
        method: "get",
      });

export const getClassList = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoClassCatalog(id),
      })
    : request({
        url: `${COURSE_API_PREFIX}/courses/catas/${id}`,
        method: "get",
      });

export const getClassCourses = (id) => getClassList(id);

export const getClassChapter = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoQuestionChapters(id),
      })
    : request({
        url: `${COURSE_API_PREFIX}/courses/catas/index/list/${id}`,
        method: "get",
      });

export const getAskList = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoAskPage(params),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/questions/page`,
        method: "get",
        params,
      });

export const postQuestions = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: addDemoQuestion(params) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${LEARNING_API_PREFIX}/questions`,
        method: "post",
        data: params,
      });

export const getQuestionsDetails = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoQuestionDetails(id),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/questions/${id}`,
        method: "get",
      });

export const putQuestions = (params) =>
  request({
    url: `${LEARNING_API_PREFIX}/questions/${params.id}`,
    method: "put",
    params,
  });

export const delQuestions = (id) =>
  request({
    url: `${LEARNING_API_PREFIX}/questions/${id}`,
    method: "delete",
  });

export const postAnswers = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: postDemoAnswer(params) ? 200 : 500,
        data: true,
      })
    : request({
        url: `${LEARNING_API_PREFIX}/replies`,
        method: "post",
        data: params,
      });

export const getReply = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoReplyPage(params),
      })
    : request({
        url: `${LEARNING_API_PREFIX}/replies/page`,
        method: "get",
        params,
      });

export const putLiked = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: toggleDemoQaLike(params) ? 200 : 500,
        data: true,
      })
    : request({
        url: `/rs/likes`,
        method: "post",
        data: params,
      });
