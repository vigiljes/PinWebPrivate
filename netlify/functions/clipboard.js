let currentText = "";
let updatedAt = 0;

// Keep these aligned with index.html
const MAX_TEXT_BYTES = 200_000;       // 200 KB of UTF-8 text
const MAX_BODY_BYTES = 260_000;       // JSON overhead safety

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

export async function handler(event) {
  const method = event.httpMethod;

  if (method === "GET") {
    return json(200, { text: currentText, updatedAt, maxTextBytes: MAX_TEXT_BYTES });
  }

  if (method === "DELETE") {
    currentText = "";
    updatedAt = Date.now();
    return json(200, { ok: true });
  }

  if (method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  try {
    // Guard: request body too big (before parsing)
    const bodyStr = event.body || "";
    const bodyBytes = Buffer.byteLength(bodyStr, "utf8");
    if (bodyBytes > MAX_BODY_BYTES) {
      return json(413, { error: "payload too large", maxTextBytes: MAX_TEXT_BYTES });
    }

    const body = JSON.parse(bodyStr);
    let text = body.text ?? "";
    if (typeof text !== "string") text = String(text);

    // Guard: text too big (UTF-8 bytes)
    const textBytes = Buffer.byteLength(text, "utf8");
    if (textBytes > MAX_TEXT_BYTES) {
      return json(413, { error: "text too large", maxTextBytes: MAX_TEXT_BYTES });
    }

    currentText = text;          // no slicing / no chopping
    updatedAt = Date.now();

    return json(200, { ok: true, updatedAt, maxTextBytes: MAX_TEXT_BYTES });
  } catch {
    return json(400, { error: "bad json" });
  }
}