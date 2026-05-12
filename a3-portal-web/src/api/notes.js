import request from "@/utils/request.js";
import {
  createAiLearningNote,
  deleteAiLearningNote,
  gatherAiLearningNote,
  listAiLearningNotes,
  ungatherAiLearningNote,
  updateAiLearningNote,
} from "@/api/ai.js";
import {
  addDemoNote,
  deleteDemoNote,
  gatherDemoNote,
  getDemoNotesPage,
  isPortalDemoMode,
  updateDemoNote,
} from "@/config/demo-learning";

const LEARNING_API_PREFIX = "/ls";
const isA3LocalMode = import.meta.env.MODE === "a3local";
const shouldUseAiLearningApi = () => isA3LocalMode && !isPortalDemoMode();
const wrapAiData = (data) => ({ code: 200, data });

export const addNotes = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: addDemoNote(params) ? 200 : 500,
        data: true,
      })
    : shouldUseAiLearningApi()
      ? createAiLearningNote(params).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/notes`,
        method: "post",
        data: params,
      });

export const getAllNotes = (params) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: 200,
        data: getDemoNotesPage(params),
      })
    : shouldUseAiLearningApi()
      ? listAiLearningNotes(params).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/notes/page`,
        method: "get",
        params,
      });

export const collectionNotes = (id) =>
  request({
    url: `${LEARNING_API_PREFIX}/notes/${id}`,
    method: "post",
  });

export const updateNotes = (data) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: updateDemoNote(data) ? 200 : 500,
        data: true,
      })
    : shouldUseAiLearningApi()
      ? updateAiLearningNote(data.id, data).then((result) => wrapAiData(result))
    : request({
        url: `${LEARNING_API_PREFIX}/notes/${data.id}`,
        method: "put",
        data,
      });

export const delNote = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: deleteDemoNote(id) ? 200 : 500,
        data: true,
      })
    : shouldUseAiLearningApi()
      ? deleteAiLearningNote(id).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/notes/${id}`,
        method: "delete",
      });

export const notesGathers = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: gatherDemoNote(id, true) ? 200 : 500,
        data: true,
      })
    : shouldUseAiLearningApi()
      ? gatherAiLearningNote(id).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/notes/gathers/${id}`,
        method: "post",
      });

export const unNotesGathers = (id) =>
  isPortalDemoMode()
    ? Promise.resolve({
        code: gatherDemoNote(id, false) ? 200 : 500,
        data: true,
      })
    : shouldUseAiLearningApi()
      ? ungatherAiLearningNote(id).then((data) => wrapAiData(data))
    : request({
        url: `${LEARNING_API_PREFIX}/notes/gathers/${id}`,
        method: "delete",
      });

export const likeed = (id) =>
  request({
    url: `${LEARNING_API_PREFIX}/note/${id}`,
    method: "post",
  });

export const unLikeed = (id) =>
  request({
    url: `${LEARNING_API_PREFIX}/note/${id}`,
    method: "delete",
  });
