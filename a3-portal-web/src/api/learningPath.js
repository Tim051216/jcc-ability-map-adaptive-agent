import request from "@/utils/request";

const LEARNING_API_PREFIX = "/ls";

/** 当前登录用户进行中的学习路径（Java learning-service） */
export const getCurrentLearningPath = () =>
  request({
    url: `${LEARNING_API_PREFIX}/learning/path/current`,
    method: "get",
  });

/** 路径下节点列表 */
export const getLearningPathNodes = (pathId) =>
  request({
    url: `${LEARNING_API_PREFIX}/learning/node/path/${pathId}`,
    method: "get",
  });
