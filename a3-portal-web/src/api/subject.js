import request from "@/utils/request.js";
import {
  getDemoSubject,
  isPortalDemoMode,
  submitDemoSubject,
} from "@/config/demo-learning";

const EXAM_API_PREFIX = "/es";

export const getSubject = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoSubject(data),
      })
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
    : request({
        url: `${EXAM_API_PREFIX}/exams/details`,
        method: "post",
        data,
      });
