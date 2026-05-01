import { createServer } from "node:http";
import { GoogleGenAI } from "@google/genai";

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.GOOGLE_AI_MODEL || process.env.VERTEX_AI_MODEL || "gemini-2.5-flash";
const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT;
const LOCATION =
  process.env.GOOGLE_CLOUD_LOCATION ||
  process.env.VERTEX_AI_LOCATION ||
  "us-central1";
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

function getGenAIClient() {
  if (API_KEY) {
    return new GoogleGenAI({
      apiKey: API_KEY,
      vertexai: true,
    });
  }

  if (!PROJECT_ID) {
    throw new Error(
      "Missing Google Cloud project. Set GOOGLE_CLOUD_PROJECT before using Vertex AI.",
    );
  }

  return new GoogleGenAI({
    vertexai: true,
    project: PROJECT_ID,
    location: LOCATION,
  });
}

async function runGooglePlan(prompt) {
  const ai = getGenAIClient();
  const result = await ai.models.generateContent({
    model: MODEL,
    contents: buildInstruction(prompt),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: PLAN_SCHEMA,
    },
  });
  const planText = result.text?.trim();

  if (!planText) {
    throw new Error("Vertex AI did not return plan content.");
  }

  try {
    return { plan: JSON.parse(planText) };
  } catch {
    throw new Error("Vertex AI returned a plan in an unexpected format.");
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
      sendJson(response, 200, { plan, provider: "vertex-ai", model: MODEL });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Failed to generate a Vertex AI plan.",
      });
      return;
    }
  }

  if (request.method === "GET" && request.url === "/api/health") {
    const configured = Boolean(API_KEY || PROJECT_ID);

    sendJson(response, 200, {
      ok: configured,
      configured,
      provider: "vertex-ai",
      model: MODEL,
      project: API_KEY ? null : PROJECT_ID ?? null,
      location: API_KEY ? null : LOCATION,
      authMode: API_KEY ? "api-key" : "application-default-credentials",
    });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Vertex AI API listening on http://127.0.0.1:${PORT}`);
});
