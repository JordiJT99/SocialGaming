import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["--watch", "server/index.js", "--dev"], { stdio: "inherit", shell: false }),
  spawn(process.execPath, ["./node_modules/vite/bin/vite.js", "--host", "127.0.0.1"], { stdio: "inherit", shell: false }),
];

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) child.kill("SIGINT");
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
