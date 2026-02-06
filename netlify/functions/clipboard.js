let currentText = "";
let updatedAt = 0;
let lastDevice = "";

// temp chunk buffers (in-memory; resets on cold start)
const uploads = new Map();

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
    return json(200, { text: currentText, updatedAt, device: lastDevice });
  }

  if (method === "DELETE") {
    currentText = "";
    updatedAt = Date.now();
    lastDevice = "";
    uploads.clear();
    return json(200, { ok: true });
  }

  if (method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  // POST
  try {
    const body = JSON.parse(event.body || "{}");

    // --- Chunked mode ---
    // { uploadId, chunk, index, total, device }
    if (body.uploadId && typeof body.chunk === "string") {
      const uploadId = String(body.uploadId);
      const index = Number(body.index);
      const total = Number(body.total);
      const device = body.device ?? "";

      if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) {
        return json(400, { error: "bad chunk metadata" });
      }

      const entry = uploads.get(uploadId) || { parts: [], total, received: 0, device };
      if (entry.total !== total) entry.total = total;

      entry.parts[index] = body.chunk;
      entry.received = entry.parts.filter((x) => typeof x === "string").length;
      entry.device = device;

      uploads.set(uploadId, entry);

      // If complete, assemble + commit
      if (entry.received === total) {
        currentText = entry.parts.join("");
        updatedAt = Date.now();
        lastDevice = device;
        uploads.delete(uploadId);
        return json(200, { ok: true, done: true });
      }

      return json(200, { ok: true, done: false, received: entry.received, total: entry.total });
    }

    // --- Normal mode ---
    // { text, device }
    let text = body.text ?? "";
    const device = body.device ?? "";

    if (typeof text !== "string") text = String(text);

    // No clamp here (platform still has request size ceiling)
    currentText = text;
    updatedAt = Date.now();
    lastDevice = device;

    return json(200, { ok: true });
  } catch (e) {
    // If request is too big, some platforms fail parsing.
    return json(400, { error: "bad json / payload too large" });
  }
}