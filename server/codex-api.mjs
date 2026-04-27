import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8787;
const SCHEMA_PATH = join(__dirname, "ai-plan.schema.json");

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

async function runCodexPlan(prompt) {
  const tempDir = await mkdtemp(join(tmpdir(), "pomodoro-codex-"));
  const outputPath = join(tempDir, "plan.json");
  const instruction = [
    "You are creating a focused work session plan for a Pomodoro dashboard.",
    "Return JSON only following the provided schema.",
    "Make the session name short and clear.",
    "Create 3 to 7 concrete, ordered tasks that lead directly to the user's goal.",
    "Task titles must be actionable and concise.",
    `User goal: ${prompt}`,
  ].join("\n");

  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        "codex",
        [
          "exec",
          "--skip-git-repo-check",
          "--color",
          "never",
          "--output-schema",
          SCHEMA_PATH,
          "-o",
          outputPath,
          instruction,
        ],
        {
          cwd: dirname(__dirname),
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(new Error(stderr.trim() || stdout.trim() || `Codex exited with code ${code}.`));
      });
    });

    const rawOutput = await readFile(outputPath, "utf8");
    return {
      plan: JSON.parse(rawOutput),
      logs: result.stderr || result.stdout,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
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

      const { plan } = await runCodexPlan(prompt);
      sendJson(response, 200, { plan });
      return;
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Failed to generate a Codex plan.",
      });
      return;
    }
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ok: true, provider: "codex" });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Codex API listening on http://127.0.0.1:${PORT}`);
});
