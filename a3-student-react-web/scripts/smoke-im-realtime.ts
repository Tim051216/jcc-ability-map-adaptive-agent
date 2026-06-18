const AI_BASE_ROOT = (process.env.A3_AI_BASE_ROOT || "http://127.0.0.1:18080").replace(/\/$/, "");
const API_BASE = `${AI_BASE_ROOT}/api/v1`;

type ImSessionSummaryResponse = {
  session_id: number;
  peer_user_id?: number | null;
  latest_message?: string | null;
  unread_count: number;
};

function buildHeaders(userId: string) {
  return {
    Authorization: "Bearer student-demo",
    "X-User-Id": userId,
    "user-info": userId,
    "Content-Type": "application/json",
  };
}

async function waitForRealtimeUpdate(expectedContent: string) {
  const response = await fetch(`${API_BASE}/chat/stream?user_id=1003`, {
    headers: {
      Authorization: "Bearer student-demo",
      "X-User-Id": "1003",
      "user-info": "1003",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`stream_not_available:${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawInitialEvent = false;
  const timeoutAt = Date.now() + 15000;

  try {
    while (Date.now() < timeoutAt) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let delimiterIndex = buffer.indexOf("\n\n");
      while (delimiterIndex >= 0) {
        const chunk = buffer.slice(0, delimiterIndex);
        buffer = buffer.slice(delimiterIndex + 2);
        delimiterIndex = buffer.indexOf("\n\n");

        const dataLine = chunk
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith("data: "));
        if (!dataLine) {
          continue;
        }

        const payload = JSON.parse(dataLine.slice(6)) as { items?: ImSessionSummaryResponse[] };
        const target = payload.items?.find((item) => item.session_id === 61012);
        if (!sawInitialEvent) {
          sawInitialEvent = true;
          continue;
        }
        if (target?.latest_message === expectedContent) {
          return {
            mirror_session_id: target.session_id,
            mirror_unread_count: target.unread_count,
            mirror_latest_message: target.latest_message,
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
    await response.body.cancel().catch(() => undefined);
  }

  throw new Error("stream_update_timeout");
}

async function main() {
  const content = `realtime-smoke-${Date.now()}`;
  const waitPromise = waitForRealtimeUpdate(content);

  const sendResponse = await fetch(`${API_BASE}/chat/sessions/61011/messages`, {
    method: "POST",
    headers: buildHeaders("1001"),
    body: JSON.stringify({ content }),
  });

  if (!sendResponse.ok) {
    throw new Error(`send_failed:${sendResponse.status}:${await sendResponse.text()}`);
  }

  const sendPayload = (await sendResponse.json()) as { message_id?: number };
  const streamResult = await waitPromise;

  console.log(
    JSON.stringify(
      {
        send_status: sendResponse.status,
        message_id: sendPayload.message_id ?? null,
        ...streamResult,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
