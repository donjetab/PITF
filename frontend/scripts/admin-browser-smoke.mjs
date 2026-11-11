import { spawn } from "node:child_process";
import path from "node:path";

const [email, password] = process.argv.slice(2);
if (!email || !password) throw new Error("Usage: node scripts/admin-browser-smoke.mjs <email> <password>");

const edge = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const port = 9333;
const profile = path.resolve("..", "backend", ".tmp-edge-browser-smoke");
const browser = spawn(edge, [
  "--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "http://localhost:5173/admin/login",
], { windowsHide: true, stdio: "ignore" });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function target() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((item) => item.type === "page" && item.url.includes("localhost:5173"));
      if (page) return page;
    } catch { /* browser is still starting */ }
    await wait(250);
  }
  throw new Error("Edge DevTools target did not start.");
}

async function connect(url) {
  const socket = new WebSocket(url); const pending = new Map(); let sequence = 0;
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data); const request = pending.get(message.id);
    if (!request) return; pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result);
  });
  return {
    call(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); },
    close() { socket.close(); },
  };
}

async function evaluate(client, expression) {
  const result = await client.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitFor(client, expression, expected, label) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate(client, expression) === expected) return;
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

let client;
try {
  const login = await fetch("http://127.0.0.1:5136/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`Login API returned ${login.status}.`);
  const { token } = await login.json();
  client = await connect((await target()).webSocketDebuggerUrl);
  const storageId = { securityOrigin: "http://localhost:5173", isLocalStorage: true };
  await client.call("DOMStorage.enable");
  await client.call("DOMStorage.setDOMStorageItem", { storageId, key: "pitf_admin_token", value: token });
  await client.call("Page.navigate", { url: "http://localhost:5173/admin" });
  await waitFor(client, "location.pathname", "/admin", "authenticated admin route");
  await waitFor(client, "document.body.innerText.includes('Dashboard')", true, "admin dashboard render");
  await client.call("Page.navigate", { url: "http://localhost:5173/admin/homepage" });
  await waitFor(client, "location.pathname", "/admin/homepage", "homepage administration route");
  await waitFor(client, "document.querySelectorAll('.admin-home-section').length", 8, "all homepage section previews");
  await waitFor(client, "Boolean(document.querySelector('.admin-home-preview iframe'))", true, "live homepage preview frame");
  await client.call("DOMStorage.removeDOMStorageItem", { storageId, key: "pitf_admin_token" });
  await client.call("Page.navigate", { url: "http://localhost:5173/admin" });
  await waitFor(client, "location.pathname", "/admin/login", "logout redirect");
  console.log("ADMIN BROWSER LOGIN/HOMEPAGE PREVIEW/LOGOUT: PASS");
} finally {
  client?.close(); browser.kill();
}
