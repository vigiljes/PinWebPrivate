let currentText = "";
let updatedAt = 0;
let lastDevice = "";

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

  if (method === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      let text = body.text ?? "";
      const device = body.device ?? "";

      if (typeof text !== "string") text = String(text);
      if (text.length > 6000) text = text.slice(0, 6000);

      currentText = text;
      updatedAt = Date.now();
      lastDevice = device;

      return json(200, { ok: true });
    } catch {
      return json(400, { error: "bad json" });
    }
  }

  if (method === "DELETE") {
    currentText = "";
    updatedAt = Date.now();
    lastDevice = "";
    return json(200, { ok: true });
  }

  return json(405, { error: "method not allowed" });
}