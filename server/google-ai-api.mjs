import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.GOOGLE_AI_MODEL || "gemini-2.5-flash";
const API_KEY =
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_AI_API_KEY;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sessionName: {
      type: "string",
      description: "A short, clear work session name.",
    },
    tasks: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description: "A concise, actionable task title.",
          },
        },
        required: ["title"],
      },
    },
    outcome: {
      type: "string",
      description: "A short description of the intended result.",
    },
  },
  required: ["sessionName", "tasks", "outcome"],
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(raw));
    request.on("error", reject);
  });
}

function buildInstruction(prompt) {
  return [
    "You are creating a focused work session plan for a Pomodoro dashboard.",
    "Return a short session name, 3 to 7 concrete ordered tasks, and a concise outcome.",
    "Make the session name short and clear.",
    "Task titles must be actionable and concise.",
    `User goal: ${prompt}`,
  ].join("\n");
}

async function runGooglePlan(prompt) {
  if (!API_KEY) {
    throw new Error(
      "Missing Google AI API key. Set GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_AI_API_KEY.",
    );
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildInstruction(prompt) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: PLAN_SCHEMA,
      },
    }),
  });

  const rawText = await response.text();
  let data = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error("Google AI returned invalid JSON.");
  }

  if (!response.ok) {
    const apiMessage =
      data?.error?.message ||
      data?.error?.status ||
      `Google AI request failed with status ${response.status}.`;
    throw new Error(apiMessage);
  }

  const planText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!planText) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Google AI blocked the request: ${blockReason}.`);
    }

    throw new Error("Google AI did not return plan content.");
  }

  try {
    return { plan: JSON.parse(planText) };
  } catch {
    throw new Error("Google AI returned a plan in an unexpected format.");
  }
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Missing request URL." });
    return;
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate-plan") {
    try {
      const rawBody = await readRequestBody(request);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const prompt = String(body?.prompt ?? "").trim();

      if (!prompt) {
        sendJson(response, 400, { error: "Prompt is required." });
        return;
      }

      const { plan } = await runGooglePlan(prompt);
      sendJson(response, 200, { plan, provider: "google-ai", model: MODEL });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Failed to generate a Google AI plan.",
      });
      return;
    }
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ok: true, provider: "google-ai", model: MODEL });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Google AI API listening on http://127.0.0.1:${PORT}`);
});
