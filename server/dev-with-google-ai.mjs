import { spawn } from "node:child_process";

function startProcess(command, args, label) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    windowsHide: false,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
    }
  });

  return child;
}

const apiProcess = startProcess("npm", ["run", "dev:google-ai"], "Google AI API");
const viteProcess = startProcess(
  "npm",
  ["run", "dev:ui", "--", "--host", "127.0.0.1", "--port", "4173"],
  "Vite",
);

function shutdown() {
  apiProcess.kill();
  viteProcess.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
