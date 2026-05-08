import axios from "axios";

const aiClient = axios.create({
  baseURL: "/aigw",
  // 多智能体综合场景会触发较长链路，演示页需要更宽松的超时时间。
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const chatWithAiAgents = (payload) => aiClient.post("/v1/chat", payload).then((res) => res.data);
export const submitAiChatTask = (payload) => aiClient.post("/v1/chat/tasks", payload).then((res) => res.data);
export const getAiChatTaskStatus = (taskId) => aiClient.get(`/v1/chat/tasks/${taskId}`).then((res) => res.data);
