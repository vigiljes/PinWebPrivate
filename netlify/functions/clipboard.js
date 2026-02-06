let currentText = "";
let updatedAt = 0;

// Temporary chunk buffers (in-memory; resets on cold start)
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
    return json(200, { text: currentText, updatedAt });
  }

  if (method === "DELETE") {
    currentText = "";
    updatedAt = Date.now();
    uploads.clear();
    return json(200, { ok: true });
  }

  if (method !== "POST") {
    return json(405, { error: "method not allowed" });
  }

  // POST
  try {
    const body = JSON.parse(event.body || "{}");

    // Chunked mode:
    // { uploadId, chunk, index, total }
    if (body.uploadId && typeof body.chunk === "string") {
      const uploadId = String(body.uploadId);
      const index = Number(body.index);
      const total = Number(body.total);

      if (!Number.isFinite(index) || !Number.isFinite(total) || total <= 0) {
        return json(400, { error: "bad chunk metadata" });
      }

      const entry = uploads.get(uploadId) || { parts: [], total, received: 0 };

      // store chunk
      entry.parts[index] = body.chunk;
      entry.total = total;

      // count received without being expensive
      // (safe because total is usually not huge)
      entry.received = entry.parts.reduce((acc, x) => acc + (typeof x === "string" ? 1 : 0), 0);

      uploads.set(uploadId, entry);

      // If complete, assemble
      if (entry.received >= entry.total) {
        currentText = entry.parts.join("");
        updatedAt = Date.now();
        uploads.delete(uploadId);
        return json(200, { ok: true, done: true });
      }

      return json(200, { ok: true, done: false, received: entry.received, total: entry.total });
    }

    // Normal mode:
    // { text }
    let text = body.text ?? "";
    if (typeof text !== "string") text = String(text);

    // NO clamp here. (Platform may still have max request size; chunk mode avoids that.)
    currentText = text;
    updatedAt = Date.now();

    return json(200, { ok: true });
  } catch {
    return json(400, { error: "bad json / payload too large" });
  }
}