import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const loadEnv = () => {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^"|"$/g, "");
    }
  }
};

const main = async () => {
  loadEnv();
  const port = process.env.SERVER_PORT || "6969";
  const token = process.env.CODEX_RELAY_TOKEN;
  if (!token) {
    console.error("CODEX_RELAY_TOKEN missing in env/.env");
    process.exit(1);
  }

  const url = `http://localhost:${port}/diag/codex`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error(`diag failed: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  const version = data?.codex_version;
  const ok = version?.ok;
  if (!ok) {
    console.error("codex --version failed");
    console.error(JSON.stringify(version, null, 2));
    process.exit(1);
  }

  console.log("codex ok:", (version?.stdout ?? "").trim());
};

main().catch((err) => {
  console.error(err?.message ?? String(err));
  process.exit(1);
});
