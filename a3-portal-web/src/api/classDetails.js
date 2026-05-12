import request from "@/utils/request.js";
import {
  createAiLearningQuestion,
  createAiLearningReply,
  deleteAiLearningQuestion,
  getAiCourseDetail,
  listAiCourseCatalog,
  listAiCourseChapters,
  listAiCourseTeachers,
  getAiLearningQuestion,
  listAiLearningQuestions,
  listAiLearningReplies,
  toggleAiLearningLike,
  updateAiLearningQuestion,
} from "@/api/ai.js";
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
const isA3LocalMode = import.meta.env.MODE === "a3local";
const shouldUseAiCourseApi = () => isA3LocalMode && !isPortalDemoMode();

const wrapAiData = (data) => ({ code: 200, data });

export const getClassDetails = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoClassDetails(id),
      })
    : shouldUseAiCourseApi()
      ? getAiCourseDetail(id).then((data) =>
          wrapAiData({
            id: data.id,
            courseCode: data.course_code,
            name: data.name,
            coverUrl: data.cover_url,
            price: data.price,
            sold: data.sold,
            teacher: data.teacher,
            teacherName: data.teacher_name,
            cataTotalNum: data.cata_total_num,
            validDuration: data.valid_duration,
            score: data.score,
            cateNames: data.cate_names,
            introduce: data.introduce,
            usePeople: data.use_people,
            detail: data.detail,
          }),
        )
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
    : shouldUseAiCourseApi()
      ? listAiCourseTeachers(id).then((data) =>
          wrapAiData(
            (data || []).map((item) => ({
              id: item.id,
              name: item.name,
              role: item.role,
              intro: item.intro,
              icon: item.icon,
              isShow: item.is_show,
            })),
          ),
        )
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
    : shouldUseAiCourseApi()
      ? listAiCourseCatalog(id).then((data) =>
          wrapAiData(
            (data || []).map((chapter) => ({
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
          ),
        )
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
    : shouldUseAiCourseApi()
      ? listAiCourseChapters(id).then((data) => wrapAiData(data || []))
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
    : shouldUseAiCourseApi()
      ? listAiLearningQuestions(params).then((data) => wrapAiData(data))
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
    : shouldUseAiCourseApi()
      ? createAiLearningQuestion(params).then((data) => wrapAiData(data))
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
    : shouldUseAiCourseApi()
      ? getAiLearningQuestion(id).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/questions/${id}`,
        method: "get",
      });

export const putQuestions = (params) =>
  shouldUseAiCourseApi()
    ? updateAiLearningQuestion(params.id, params).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/questions/${params.id}`,
        method: "put",
        params,
      });

export const delQuestions = (id) =>
  shouldUseAiCourseApi()
    ? deleteAiLearningQuestion(id).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/questions/${id}`,
        method: "delete",
      });

export const postAnswers = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: postDemoAnswer(params) ? 200 : 500,
        data: true,
      })
    : shouldUseAiCourseApi()
      ? createAiLearningReply(params).then((data) => wrapAiData(data))
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
    : shouldUseAiCourseApi()
      ? listAiLearningReplies(params).then((data) => wrapAiData(data))
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
    : shouldUseAiCourseApi()
      ? toggleAiLearningLike(params).then((data) => wrapAiData(data))
    : request({
        url: `/rs/likes`,
        method: "post",
        data: params,
      });
