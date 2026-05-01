import { getAiHealth } from "../server/ai-plan-service.mjs";

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.end(JSON.stringify(payload));
}

export const runtime = "nodejs";

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method === "GET") {
    return sendJson(response, 200, getAiHealth());
  }

  return sendJson(response, 405, { error: "Method not allowed." });
}
