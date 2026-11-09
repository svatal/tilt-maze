import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "src", "buildInfo.generated.ts");

function git(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", cwd: path.join(__dirname, "..") }).trim();
  } catch {
    return "";
  }
}

const branch =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  git("git rev-parse --abbrev-ref HEAD") ||
  "unknown";

// BUILD_INFO_SHA (CI: u PR = head větve) má přednost před GITHUB_SHA (merge ref u pull_request).
const shaFull =
  process.env.BUILD_INFO_SHA || process.env.GITHUB_SHA || git("git rev-parse HEAD") || "unknown";
const shaShort = shaFull.length >= 7 ? shaFull.slice(0, 7) : shaFull;

let prNum = process.env.PR_NUMBER || "";
if (!prNum && process.env.GITHUB_REF) {
  const m = process.env.GITHUB_REF.match(/^refs\/pull\/(\d+)\//);
  if (m) prNum = m[1];
}

const built = new Date().toLocaleString("cs-CZ", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

const parts = [prNum && `pr-${prNum}`, branch, shaShort, built].filter(Boolean);
const label = parts.join(" · ");

const src = `/* Automaticky generováno při buildu — neupravovat ručně; soubor je v .gitignore */
export const BUILD_INFO_LABEL = ${JSON.stringify(label)};
`;

fs.writeFileSync(out, src, "utf8");
console.log("wrote", out, label);
