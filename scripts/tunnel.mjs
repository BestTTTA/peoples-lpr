// Local dev: forward localhost:15555 to Postgres on spark (127.0.0.1:5555 there)
// over Tailscale, and reconnect whenever the connection drops.
import { spawn } from "node:child_process";

const args = [
  "-N",
  "-o", "ExitOnForwardFailure=yes",
  "-o", "ServerAliveInterval=30",
  "-o", "ServerAliveCountMax=3",
  "-L", "15555:127.0.0.1:5555",
  "sparkle@100.68.248.102",
];

let stopping = false;
let child;

function connect() {
  const started = Date.now();
  console.log(`[tunnel] connecting (localhost:15555 -> spark postgres)`);
  child = spawn("ssh", args, { stdio: "inherit" });
  child.on("exit", (code) => {
    if (stopping) return;
    // Back off a little if it fails straight away (host down, port taken).
    const delay = Date.now() - started < 10_000 ? 10_000 : 2_000;
    console.log(`[tunnel] ssh exited (${code}); reconnecting in ${delay / 1000}s`);
    setTimeout(connect, delay);
  });
}

for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    stopping = true;
    child?.kill();
    process.exit(0);
  });

connect();
