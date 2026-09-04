import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const outputDirectory = resolve(root, "firebase-public");
const port = "4179";

async function hostingAssets(directory, prefix = "") {
  const assets = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith(".") || item.name === "_headers" || item.name === "sw.js") continue;
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) assets.push(...await hostingAssets(resolve(directory, item.name), relative));
    else assets.push(`/${relative}`);
  }
  return assets;
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(resolve(root, "dist/client"), outputDirectory, { recursive: true });

const server = spawn(resolve(root, "node_modules/.bin/vinext"), ["start"], {
  cwd: root,
  env: { ...process.env, PORT: port, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
  stdio: ["ignore", "pipe", "pipe"],
});

let diagnostics = "";
server.stdout.on("data", (chunk) => { diagnostics += chunk.toString(); });
server.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });

try {
  let response;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
    try { response = await fetch(`http://127.0.0.1:${port}/`); if (response.ok) break; } catch { /* Server is still starting. */ }
  }
  if (!response?.ok) throw new Error(`Production server did not become ready.\n${diagnostics}`);
  const html = await response.text();
  if (!html.includes("Buyala Waste Operations") || !html.includes("Opening Buyala")) throw new Error("The rendered entry page was incomplete.");
  await writeFile(resolve(outputDirectory, "index.html"), html);
  const manifest = await readFile(resolve(outputDirectory, "manifest.webmanifest"), "utf8");
  JSON.parse(manifest);
  const assets = ["/", ...await hostingAssets(outputDirectory).then((items) => items.filter((item) => item !== "/index.html"))];
  const serviceWorkerPath = resolve(outputDirectory, "sw.js");
  const serviceWorker = await readFile(serviceWorkerPath, "utf8");
  await writeFile(serviceWorkerPath, serviceWorker.replace("const PRECACHE_ASSETS = APP_SHELL; // BUYALA_PRECACHE_ASSETS", `const PRECACHE_ASSETS = ${JSON.stringify(assets)}; // BUYALA_PRECACHE_ASSETS`));
  console.log("Firebase Hosting package prepared in firebase-public.");
} finally {
  server.kill("SIGTERM");
}
