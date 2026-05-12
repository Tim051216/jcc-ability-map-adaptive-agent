import { a3DemoScenario } from "@/mock/a3DemoData";

const COURSE_CODE_BY_ID = {
  1: a3DemoScenario.courseCode,
  101: a3DemoScenario.courseCode,
};

export const resolveCourseCode = (courseId) => {
  const normalizedId = Number(courseId);
  if (Number.isFinite(normalizedId) && COURSE_CODE_BY_ID[normalizedId]) {
    return COURSE_CODE_BY_ID[normalizedId];
  }
  if (Number.isFinite(normalizedId) && normalizedId > 0) {
    return `course_${normalizedId}`;
  }
  return a3DemoScenario.courseCode;
};

export const normalizeCourseAwareText = (value) =>
  String(value || "")
    .replace(new RegExp(a3DemoScenario.courseCode, "g"), a3DemoScenario.currentTopic)
    .replace(/\s+/g, " ")
    .trim();
