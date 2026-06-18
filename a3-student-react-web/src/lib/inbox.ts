export const INBOX_UPDATED_EVENT = "a3-inbox-updated";

const AI_BASE_URL = String(import.meta.env.VITE_AI_BASE_URL || "/ai/api/v1").replace(/\/$/, "");
const DEFAULT_NOTIFICATION_BASES = [import.meta.env.VITE_NOTIFICATION_BASE_URL, AI_BASE_URL];
const CONFIGURED_BASES = DEFAULT_NOTIFICATION_BASES
  .filter(Boolean)
  .map((value) => String(value).replace(/\/$/, ""))
  .filter((value, index, array) => array.indexOf(value) === index);

export interface InboxItem {
  id: string;
  type: number;
  title: string;
  content: string;
  isRead: boolean;
  publisher: string;
  pushTime: string;
}

interface InboxPageResponse {
  list?: InboxItem[];
  records?: InboxItem[];
  total?: number;
}

export interface InboxSummary {
  items: InboxItem[];
  unreadCount: number;
}

function getInboxHeaders(userId: string) {
  return {
    Accept: "application/json",
    Authorization: "Bearer student-demo",
    "user-info": userId,
    "X-User-Id": userId,
  };
}

async function fetchInboxJson<T>(path: string, userId: string, init?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (const baseUrl of CONFIGURED_BASES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...getInboxHeaders(userId),
          ...(init?.headers || {}),
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (response.status === 204) {
        return undefined as T;
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Inbox request failed");
}

export async function listInboxItems(userId: string, options?: { pageNo?: number; pageSize?: number; isRead?: boolean }) {
  const search = new URLSearchParams({
    pageNo: String(options?.pageNo ?? 1),
    pageSize: String(options?.pageSize ?? 20),
  });
  if (typeof options?.isRead === "boolean") {
    search.set("isRead", String(options.isRead));
  }
  const payload = await fetchInboxJson<InboxPageResponse>(`/inboxes?${search.toString()}`, userId);
  const items = Array.isArray(payload?.list) ? payload.list : Array.isArray(payload?.records) ? payload.records : [];
  return items;
}

export async function getInboxSummary(userId: string): Promise<InboxSummary> {
  const items = await listInboxItems(userId, { pageNo: 1, pageSize: 8 });
  return {
    items,
    unreadCount: items.filter((item) => !item.isRead).length,
  };
}

export async function markInboxItemRead(userId: string, inboxId: string) {
  if (!String(inboxId || "").trim()) {
    throw new Error("Inbox id is required");
  }
  await fetchInboxJson<void>(`/inboxes/${inboxId}/read`, userId, {
    method: "PUT",
  });
  window.dispatchEvent(new CustomEvent(INBOX_UPDATED_EVENT));
}
