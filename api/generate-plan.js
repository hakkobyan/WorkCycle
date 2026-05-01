import { generatePlan } from "../server/ai-plan-service.mjs";

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.end(JSON.stringify(payload));
}

export const runtime = "nodejs";

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method === "POST") {
    try {
      const body =
        typeof request.body === "string"
          ? JSON.parse(request.body || "{}")
          : request.body || {};
      const prompt = String(body?.prompt ?? "").trim();

      if (!prompt) {
        return sendJson(response, 400, { error: "Prompt is required." });
      }

      return sendJson(response, 200, await generatePlan(prompt));
    } catch (error) {
      return sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Failed to generate a Vertex AI plan.",
      });
    }
  }

  return sendJson(response, 405, { error: "Method not allowed." });
}
