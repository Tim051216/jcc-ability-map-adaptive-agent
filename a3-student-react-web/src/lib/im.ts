import { COURSES } from "../constants";
import { getPersonaById } from "./personas";

export const IM_STATE_UPDATED_EVENT = "a3-im-state-updated";

export type ImConversationKind = "course_group" | "direct" | "system";

export type ImMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  direction: "incoming" | "outgoing";
  text: string;
  createdAt: string;
  status: "sent" | "read";
};

export type ImConversation = {
  id: string;
  title: string;
  subtitle: string;
  kind: ImConversationKind;
  courseId?: string;
  tag: string;
  unreadCount: number;
  online: boolean;
  participants: number;
  messages: ImMessage[];
};

export type ImState = {
  conversations: ImConversation[];
};

const STORAGE_PREFIX = "a3-im-state:";

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function emitImStateUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(IM_STATE_UPDATED_EVENT));
}

function nowOffsetMinutes(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function personaName(id: string, fallback: string) {
  return getPersonaById(id)?.name || fallback;
}

function buildSeedState(): ImState {
  const primaryCourse = COURSES[1] || COURSES[0];
  const designCourse = COURSES[0] || COURSES[1];
  const dataCourse = COURSES[3] || COURSES[2] || COURSES[0];

  const teacherLi = personaName("teacher-li", "李老师");
  const teacherSun = personaName("teacher-sun", "孙老师");
  const teacherQiao = personaName("teacher-qiao", "乔老师");
  const assistantZhou = personaName("assistant-zhou", "周知行");
  const assistantLin = personaName("assistant-lin", "林若澄");
  const assistantShen = personaName("assistant-shen", "沈序宁");
  const studentLin = personaName("student-lin", "林澈");
  const studentChen = personaName("student-chen", "陈星宇");
  const studentEmily = personaName("student-emily", "Emily UI");
  const studentSong = personaName("student-song", "宋知夏");

  return {
    conversations: [
      {
        id: "conv-course-react",
        title: `${primaryCourse.title} 学习群`,
        subtitle: "课堂交流群",
        kind: "course_group",
        courseId: primaryCourse.id,
        tag: "主线课程",
        unreadCount: 3,
        online: true,
        participants: 26,
        messages: [
          {
            id: "msg-react-1",
            senderId: "teacher-li",
            senderName: teacherLi,
            direction: "incoming",
            text: "这一节先抓住状态边界、组件职责和渲染链路，作业会围绕这三块展开。",
            createdAt: nowOffsetMinutes(-95),
            status: "read",
          },
          {
            id: "msg-react-2",
            senderId: "assistant-zhou",
            senderName: assistantZhou,
            direction: "incoming",
            text: "我已经把本节讲义、随堂练习和术语卡同步到课堂右侧，边看边用会更顺。",
            createdAt: nowOffsetMinutes(-41),
            status: "read",
          },
          {
            id: "msg-react-3",
            senderId: "student-lin",
            senderName: studentLin,
            direction: "incoming",
            text: "我把组件拆分的复盘清单整理好了，等会发到群文件里给大家参考。",
            createdAt: nowOffsetMinutes(-16),
            status: "read",
          },
          {
            id: "msg-react-4",
            senderId: "student-emily",
            senderName: studentEmily,
            direction: "incoming",
            text: "如果从界面层次去看，这节里讲的状态归属和交互节奏其实很像一套系统设计规则。",
            createdAt: nowOffsetMinutes(-9),
            status: "sent",
          },
          {
            id: "msg-react-5",
            senderId: "teacher-li",
            senderName: teacherLi,
            direction: "incoming",
            text: "先继续看完这一章，再回群里提具体场景问题，我会按真实项目写法帮你们对齐。",
            createdAt: nowOffsetMinutes(-4),
            status: "sent",
          },
        ],
      },
      {
        id: "conv-direct-assistant",
        title: assistantZhou,
        subtitle: `${primaryCourse.title} 1v1`,
        kind: "direct",
        courseId: primaryCourse.id,
        tag: "陪学助教",
        unreadCount: 1,
        online: true,
        participants: 2,
        messages: [
          {
            id: "msg-assistant-1",
            senderId: "assistant-zhou",
            senderName: assistantZhou,
            direction: "incoming",
            text: "你上次问的 Context 拆分问题，我已经按这门课的章节顺序整理成一张判断卡。",
            createdAt: nowOffsetMinutes(-72),
            status: "read",
          },
          {
            id: "msg-assistant-2",
            senderId: "assistant-zhou",
            senderName: assistantZhou,
            direction: "incoming",
            text: "如果你愿意，我可以继续按你今天的学习目标，直接给你排一个 45 分钟的学习顺序。",
            createdAt: nowOffsetMinutes(-6),
            status: "sent",
          },
        ],
      },
      {
        id: "conv-course-design",
        title: `${designCourse.title} 共创小组`,
        subtitle: "设计与前端协作",
        kind: "course_group",
        courseId: designCourse.id,
        tag: "项目协作",
        unreadCount: 1,
        online: true,
        participants: 11,
        messages: [
          {
            id: "msg-design-1",
            senderId: "teacher-sun",
            senderName: teacherSun,
            direction: "incoming",
            text: "今天的小组任务不是多做一个页面，而是把视觉规范真正沉淀成可复用的模块。",
            createdAt: nowOffsetMinutes(-143),
            status: "read",
          },
          {
            id: "msg-design-2",
            senderId: "student-chen",
            senderName: studentChen,
            direction: "incoming",
            text: "收藏页和课堂页的布局我已经对齐了一版，待会我把可交互原型发群里。",
            createdAt: nowOffsetMinutes(-28),
            status: "sent",
          },
        ],
      },
      {
        id: "conv-data-lab",
        title: `${dataCourse.title} 资料实验室`,
        subtitle: "图表与资料共学",
        kind: "course_group",
        courseId: dataCourse.id,
        tag: "拓展资料",
        unreadCount: 0,
        online: true,
        participants: 8,
        messages: [
          {
            id: "msg-data-1",
            senderId: "teacher-qiao",
            senderName: teacherQiao,
            direction: "incoming",
            text: "这周会多给你们几组对照案例，重点看同一份数据如何讲出不同层次的故事。",
            createdAt: nowOffsetMinutes(-180),
            status: "read",
          },
          {
            id: "msg-data-2",
            senderId: "student-song",
            senderName: studentSong,
            direction: "incoming",
            text: "我做了一版思维导图，把图表结构、叙事顺序和阅读路径串起来了。",
            createdAt: nowOffsetMinutes(-38),
            status: "read",
          },
        ],
      },
      {
        id: "conv-direct-resource",
        title: assistantShen,
        subtitle: "资料策展助教",
        kind: "direct",
        courseId: primaryCourse.id,
        tag: "资料补充",
        unreadCount: 1,
        online: true,
        participants: 2,
        messages: [
          {
            id: "msg-resource-1",
            senderId: "assistant-shen",
            senderName: assistantShen,
            direction: "incoming",
            text: "我看到你收藏了几份讲义，如果需要，我可以继续帮你补一版适合复习的精简版资料。",
            createdAt: nowOffsetMinutes(-52),
            status: "read",
          },
          {
            id: "msg-resource-2",
            senderId: "assistant-shen",
            senderName: assistantShen,
            direction: "incoming",
            text: "你也可以直接发一句‘按当前课程生成 PPT’给我，我会基于课堂上下文继续整理。",
            createdAt: nowOffsetMinutes(-11),
            status: "sent",
          },
        ],
      },
      {
        id: "conv-direct-study",
        title: assistantLin,
        subtitle: "学习节奏提醒",
        kind: "direct",
        courseId: designCourse.id,
        tag: "进度提醒",
        unreadCount: 0,
        online: true,
        participants: 2,
        messages: [
          {
            id: "msg-study-1",
            senderId: "assistant-lin",
            senderName: assistantLin,
            direction: "incoming",
            text: "我把你最近三次的课堂记录串起来了，下一步最值得补的是把知识点转成自己的案例表达。",
            createdAt: nowOffsetMinutes(-88),
            status: "read",
          },
        ],
      },
      {
        id: "conv-system",
        title: "系统通知",
        subtitle: "平台消息",
        kind: "system",
        tag: "通知",
        unreadCount: 1,
        online: false,
        participants: 1,
        messages: [
          {
            id: "msg-system-1",
            senderId: "system",
            senderName: "BiliLearn 系统",
            direction: "incoming",
            text: "站内私信、课程群和助教协作已开通，现在可以直接在项目里和讲师、助教、同学持续联动。",
            createdAt: nowOffsetMinutes(-3),
            status: "sent",
          },
        ],
      },
    ],
  };
}

function saveState(userId: string, state: ImState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  emitImStateUpdated();
}

export function loadImState(userId: string): ImState {
  if (typeof window === "undefined") return buildSeedState();
  const key = getStorageKey(userId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const seeded = buildSeedState();
      saveState(userId, seeded);
      return seeded;
    }
    return JSON.parse(raw) as ImState;
  } catch {
    const seeded = buildSeedState();
    saveState(userId, seeded);
    return seeded;
  }
}

export function getUnreadImCount(userId: string) {
  return loadImState(userId).conversations.reduce((sum, item) => sum + item.unreadCount, 0);
}

export function markConversationRead(userId: string, conversationId: string) {
  const state = loadImState(userId);
  const nextState: ImState = {
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            unreadCount: 0,
            messages: conversation.messages.map((message) =>
              message.direction === "incoming" ? { ...message, status: "read" } : message,
            ),
          }
        : conversation,
    ),
  };
  saveState(userId, nextState);
  return nextState;
}

export function sendImMessage(userId: string, conversationId: string, senderName: string, text: string) {
  const state = loadImState(userId);
  const trimmed = text.trim();
  if (!trimmed) return state;
  const nextState: ImState = {
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            unreadCount: 0,
            messages: [
              ...conversation.messages,
              {
                id: `msg-${Date.now()}`,
                senderId: userId,
                senderName,
                direction: "outgoing",
                text: trimmed,
                createdAt: new Date().toISOString(),
                status: "sent",
              },
            ],
          }
        : conversation,
    ),
  };
  saveState(userId, nextState);
  return nextState;
}

export function appendIncomingImMessage(
  userId: string,
  conversationId: string,
  message: Omit<ImMessage, "id" | "direction" | "createdAt" | "status">,
) {
  const state = loadImState(userId);
  const nextState: ImState = {
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            unreadCount: conversation.unreadCount + 1,
            messages: [
              ...conversation.messages,
              {
                id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                senderId: message.senderId,
                senderName: message.senderName,
                senderAvatar: message.senderAvatar,
                direction: "incoming",
                text: message.text,
                createdAt: new Date().toISOString(),
                status: "sent",
              },
            ],
          }
        : conversation,
    ),
  };
  saveState(userId, nextState);
  return nextState;
}

export function createAutoReply(conversation: ImConversation, outgoingText: string) {
  const text = outgoingText.trim();
  if (conversation.kind === "system") {
    return {
      senderId: "system",
      senderName: "BiliLearn 系统",
      text: "系统通知类会话暂不支持直接回复，你可以前往对应课程群或助教私聊继续沟通。",
    };
  }
  if (conversation.kind === "direct") {
    return {
      senderId: conversation.id === "conv-direct-resource" ? "assistant-shen" : "assistant-zhou",
      senderName: conversation.title,
      text: `收到，你刚刚提到“${text.slice(0, 18)}${text.length > 18 ? "..." : ""}”。我会结合你当前课程和上下文继续帮你推进。`,
    };
  }
  return {
    senderId: "teacher-li",
    senderName: conversation.title,
    text: `已同步到会话里。建议大家围绕“${text.slice(0, 16)}${text.length > 16 ? "..." : ""}”继续补充自己的做法，方便后面统一复盘。`,
  };
}

export function formatImTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
