import request from "@/utils/request.js";
import { generateAiLearningExam, submitAiLearningExam } from "@/api/ai.js";
import {
  getDemoSubject,
  isPortalDemoMode,
  submitDemoSubject,
} from "@/config/demo-learning";

const EXAM_API_PREFIX = "/es";
const isA3LocalMode = import.meta.env.MODE === "a3local";
const shouldUseAiLearningApi = () => isA3LocalMode && !isPortalDemoMode();
const wrapAiData = (data) => ({ code: 200, data });

export const getSubject = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoSubject(data),
      })
    : shouldUseAiLearningApi()
      ? generateAiLearningExam(data).then((result) => wrapAiData(result))
    : request({
        url: `${EXAM_API_PREFIX}/exams`,
        method: "POST",
        data,
      });

export const postSubject = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: submitDemoSubject(data),
      })
    : shouldUseAiLearningApi()
      ? submitAiLearningExam(data).then((result) => wrapAiData(result))
    : request({
        url: `${EXAM_API_PREFIX}/exams/details`,
        method: "post",
        data,
      });
