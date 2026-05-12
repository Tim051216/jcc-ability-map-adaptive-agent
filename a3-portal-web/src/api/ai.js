import axios from "axios";

const aiClient = axios.create({
  baseURL: "/aigw",
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const chatWithAiAgents = (payload) => aiClient.post("/v1/chat", payload).then((res) => res.data);
export const submitAiChatTask = (payload) => aiClient.post("/v1/chat/tasks", payload).then((res) => res.data);
export const getAiChatTaskStatus = (taskId) => aiClient.get(`/v1/chat/tasks/${taskId}`).then((res) => res.data);

export const createAiChatTicket = (payload) => aiClient.post("/v1/chat/tickets", payload).then((res) => res.data);
export const listAiChatTickets = (params) => aiClient.get("/v1/chat/tickets", { params }).then((res) => res.data);
export const getAiChatTicket = (ticketId) => aiClient.get(`/v1/chat/tickets/${ticketId}`).then((res) => res.data);
export const replyAiChatTicket = (ticketId, payload) =>
  aiClient.post(`/v1/chat/tickets/${ticketId}/reply`, payload).then((res) => res.data);
export const updateAiChatTicketStatus = (ticketId, payload) =>
  aiClient.put(`/v1/chat/tickets/${ticketId}/status`, payload).then((res) => res.data);

export const buildAiProfile = (payload) => aiClient.post("/v1/profile/build", payload).then((res) => res.data);
export const getLatestAiProfile = (params) => aiClient.get("/v1/profile/latest", { params }).then((res) => res.data);
export const startAiProfileConversation = (payload) =>
  aiClient.post("/v1/profile/conversation/start", payload).then((res) => res.data);
export const sendAiProfileConversationMessage = (payload) =>
  aiClient.post("/v1/profile/conversation/message", payload).then((res) => res.data);
export const completeAiProfileConversation = (payload) =>
  aiClient.post("/v1/profile/conversation/complete", payload).then((res) => res.data);
export const getAiProfileConversationSession = (sessionId) =>
  aiClient.get(`/v1/profile/conversation/session/${sessionId}`).then((res) => res.data);
export const getAiConversationProfile = (userId) =>
  aiClient.get(`/v1/profile/conversation/profile/${userId}`).then((res) => res.data);
export const getAiConversationProfileSummary = (userId) =>
  aiClient.get(`/v1/profile/conversation/profile/${userId}/summary`).then((res) => res.data);
export const getAiConversationProfileHistory = (userId, params) =>
  aiClient.get(`/v1/profile/conversation/profile/${userId}/history`, { params }).then((res) => res.data);

export const listAiCourseCategories = () => aiClient.get("/v1/course/categories").then((res) => res.data);
export const listAiRecommendCourses = (bucket) => aiClient.get(`/v1/course/recommend/${bucket}`).then((res) => res.data);
export const listAiInterestCourses = (interestId) =>
  aiClient.get(`/v1/course/interest-courses/${interestId}`).then((res) => res.data);
export const searchAiCourses = (params) => aiClient.get("/v1/course/search", { params }).then((res) => res.data);
export const getAiCourseDetail = (courseId) => aiClient.get(`/v1/course/courses/${courseId}`).then((res) => res.data);
export const listAiCourseTeachers = (courseId) =>
  aiClient.get(`/v1/course/courses/${courseId}/teachers`).then((res) => res.data);
export const listAiCourseCatalog = (courseId) =>
  aiClient.get(`/v1/course/courses/${courseId}/catalog`).then((res) => res.data);
export const listAiCourseChapters = (courseId) =>
  aiClient.get(`/v1/course/courses/${courseId}/chapters`).then((res) => res.data);
export const getAiLearningCourseDetail = (courseId) =>
  aiClient.get(`/v1/course/courses/${courseId}/learning`).then((res) => res.data);
export const listAiLearningQuestions = (params) => aiClient.get("/v1/learning/questions/page", { params }).then((res) => res.data);
export const createAiLearningQuestion = (payload) => aiClient.post("/v1/learning/questions", payload).then((res) => res.data);
export const getAiLearningQuestion = (questionId) => aiClient.get(`/v1/learning/questions/${questionId}`).then((res) => res.data);
export const updateAiLearningQuestion = (questionId, payload) =>
  aiClient.put(`/v1/learning/questions/${questionId}`, payload).then((res) => res.data);
export const deleteAiLearningQuestion = (questionId) =>
  aiClient.delete(`/v1/learning/questions/${questionId}`).then((res) => res.data);
export const listAiLearningReplies = (params) => aiClient.get("/v1/learning/replies/page", { params }).then((res) => res.data);
export const createAiLearningReply = (payload) => aiClient.post("/v1/learning/replies", payload).then((res) => res.data);
export const toggleAiLearningLike = (payload) => aiClient.post("/v1/learning/likes", payload).then((res) => res.data);
export const listAiLearningNotes = (params) => aiClient.get("/v1/learning/notes/page", { params }).then((res) => res.data);
export const createAiLearningNote = (payload) => aiClient.post("/v1/learning/notes", payload).then((res) => res.data);
export const updateAiLearningNote = (noteId, payload) =>
  aiClient.put(`/v1/learning/notes/${noteId}`, payload).then((res) => res.data);
export const deleteAiLearningNote = (noteId) => aiClient.delete(`/v1/learning/notes/${noteId}`).then((res) => res.data);
export const gatherAiLearningNote = (noteId) => aiClient.post(`/v1/learning/notes/gathers/${noteId}`).then((res) => res.data);
export const ungatherAiLearningNote = (noteId) =>
  aiClient.delete(`/v1/learning/notes/gathers/${noteId}`).then((res) => res.data);
export const generateAiLearningExam = (payload) => aiClient.post("/v1/learning/exams", payload).then((res) => res.data);
export const submitAiLearningExam = (payload) => aiClient.post("/v1/learning/exams/details", payload).then((res) => res.data);

export const generateAiLearningPlan = (payload) => aiClient.post("/v1/plan/generate", payload).then((res) => res.data);
export const getLatestAiLearningPlan = (params) => aiClient.get("/v1/plan/latest", { params }).then((res) => res.data);
export const getAiLearningPlan = (planId) => aiClient.get(`/v1/plan/${planId}`).then((res) => res.data);
export const getAiLearningPlanProgress = (planId, params) =>
  aiClient.get(`/v1/plan/${planId}/progress`, { params }).then((res) => res.data);
export const completeAiLearningPlanStep = (planId, stepId, payload) =>
  aiClient.post(`/v1/plan/${planId}/steps/${stepId}/complete`, payload).then((res) => res.data);
export const pauseAiLearningPlanStep = (planId, stepId, payload) =>
  aiClient.post(`/v1/plan/${planId}/steps/${stepId}/pause`, payload).then((res) => res.data);
export const resumeAiLearningPlanStep = (planId, stepId, payload) =>
  aiClient.post(`/v1/plan/${planId}/steps/${stepId}/resume`, payload).then((res) => res.data);

export const generateAiResources = (payload) => aiClient.post("/v1/resource/generate", payload).then((res) => res.data);
export const listAiResources = (params) => aiClient.get("/v1/resource", { params }).then((res) => res.data);
export const getAiResource = (resourceId) => aiClient.get(`/v1/resource/${resourceId}`).then((res) => res.data);
export const listAiFavoriteResources = (params) =>
  aiClient.get("/v1/resource/favorites", { params }).then((res) => res.data);
export const favoriteAiResource = (resourceId, payload) =>
  aiClient.post(`/v1/resource/${resourceId}/favorite`, payload).then((res) => res.data);
export const unfavoriteAiResource = (resourceId, payload) =>
  aiClient.delete(`/v1/resource/${resourceId}/favorite`, { data: payload }).then((res) => res.data);

export const evaluateAiLearning = (payload) => aiClient.post("/v1/evaluation", payload).then((res) => res.data);
export const getLatestAiEvaluation = (params) => aiClient.get("/v1/evaluation/latest", { params }).then((res) => res.data);
export const generateAiEvaluationPaper = (payload) =>
  aiClient.post("/v1/evaluation/papers/generate", payload).then((res) => res.data);
export const getAiEvaluationPaper = (paperId) => aiClient.get(`/v1/evaluation/papers/${paperId}`).then((res) => res.data);
export const submitAiEvaluationPaper = (paperId, payload) =>
  aiClient.post(`/v1/evaluation/papers/${paperId}/submit`, payload).then((res) => res.data);
export const getAiEvaluationResult = (recordId) =>
  aiClient.get(`/v1/evaluation/results/${recordId}`).then((res) => res.data);
export const getAiWrongQuestions = (recordId) =>
  aiClient.get(`/v1/evaluation/results/${recordId}/wrong-questions`).then((res) => res.data);
export const getAiEvaluationHistory = (params) =>
  aiClient.get("/v1/evaluation/history", { params }).then((res) => res.data);
export const getAiEvaluationTrend = (params) =>
  aiClient.get("/v1/evaluation/trend", { params }).then((res) => res.data);

export const createAiReviewTask = (payload) => aiClient.post("/v1/admin/reviews", payload).then((res) => res.data);
export const listAiReviewTasks = (params) => aiClient.get("/v1/admin/reviews", { params }).then((res) => res.data);
export const getAiReviewTask = (reviewId) => aiClient.get(`/v1/admin/reviews/${reviewId}`).then((res) => res.data);
export const getAiReviewTaskHistory = (reviewId) =>
  aiClient.get(`/v1/admin/reviews/${reviewId}/history`).then((res) => res.data);
export const approveAiReviewTask = (reviewId, payload) =>
  aiClient.post(`/v1/admin/reviews/${reviewId}/approve`, payload).then((res) => res.data);
export const rejectAiReviewTask = (reviewId, payload) =>
  aiClient.post(`/v1/admin/reviews/${reviewId}/reject`, payload).then((res) => res.data);
export const approveAiReviewTasks = (payload) =>
  aiClient.post("/v1/admin/reviews/batch/approve", payload).then((res) => res.data);
export const rejectAiReviewTasks = (payload) =>
  aiClient.post("/v1/admin/reviews/batch/reject", payload).then((res) => res.data);

export const listAiAuditLogs = (params) => aiClient.get("/v1/admin/logs", { params }).then((res) => res.data);
export const exportAiAuditLogs = (params) =>
  aiClient.get("/v1/admin/logs/export", { params, responseType: "blob" });
export const listAiSystemConfigs = (params) => aiClient.get("/v1/admin/configs", { params }).then((res) => res.data);
export const updateAiSystemConfig = (configKey, payload) =>
  aiClient.put(`/v1/admin/configs/${configKey}`, payload).then((res) => res.data);
export const listAiSystemConfigHistory = (params) =>
  aiClient.get("/v1/admin/configs/history", { params }).then((res) => res.data);
export const listAiAgentStatus = () => aiClient.get("/v1/admin/agents/status").then((res) => res.data);
export const listAiAgentRuntimeLogs = (params) =>
  aiClient.get("/v1/admin/agents/logs", { params }).then((res) => res.data);
export const exportAiAgentRuntimeLogs = (params) =>
  aiClient.get("/v1/admin/agents/logs/export", { params, responseType: "blob" });
export const listAiAdminUsers = () => aiClient.get("/v1/admin/users").then((res) => res.data);
export const getAiAdminUserDetail = (userId) => aiClient.get(`/v1/admin/users/${userId}`).then((res) => res.data);
export const updateAiAdminUserStatus = (userId, payload) =>
  aiClient.put(`/v1/admin/users/${userId}/status`, payload).then((res) => res.data);
