import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

function git(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", cwd: repoRoot }).trim();
  } catch {
    return "";
  }
}

/**
 * Sestaví řádek build štítku (větev · zkrácený SHA · čas Europe/Prague).
 *
 * SHA v CI: preferuj BUILD_INFO_SHA (v PR workflow = head commit větve PR, ne merge ref GITHUB_SHA).
 * Lokálně: git rev-parse HEAD. Bez gitu / mimo repozitář: „unknown“ (nevymýšlíme hash).
 */
export function getBuildInfoLabel(): string {
  const branch =
    process.env.GITHUB_HEAD_REF ||
    process.env.GITHUB_REF_NAME ||
    git("git rev-parse --abbrev-ref HEAD") ||
    "unknown";

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
  return parts.join(" · ");
}
