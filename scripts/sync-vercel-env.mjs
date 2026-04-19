/**
 * Pushes non-empty variables from .env.local to Vercel (production + preview).
 * Usage: node scripts/sync-vercel-env.mjs
 * Requires: linked project (`npx vercel link`), `npx vercel login`
 */
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const vercelCli = resolve(root, "node_modules/vercel/dist/vc.js");

config({ path: resolve(root, ".env.local"), override: true });

const KEYS = [
  "DATABASE_URL",
  "META_ACCESS_TOKEN",
  "META_PIXEL_ID",
  "META_TEST_EVENT_CODE",
  "YCLOUD_WEBHOOK_SECRET",
];

/** Preview env in Vercel CLI requires a git branch (or use Dashboard → Preview → “All branches”). */
const TARGETS = ["production"];

function runVercelEnvAdd(name, target, value) {
  execFileSync(
    process.execPath,
    [
      vercelCli,
      "env",
      "add",
      name,
      target,
      "--value",
      value,
      "--yes",
      "--sensitive",
      "--force",
    ],
    { cwd: root, stdio: "inherit", env: process.env },
  );
}

for (const name of KEYS) {
  const value = process.env[name];
  if (value === undefined || String(value).trim() === "") continue;
  for (const target of TARGETS) {
    console.log(`Setting ${name} for ${target}…`);
    runVercelEnvAdd(name, target, value);
  }
}

console.log("Done. Redeploy or wait for the next git push so functions pick up new env.");
