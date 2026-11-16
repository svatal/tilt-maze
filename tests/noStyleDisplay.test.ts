import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");

const DISPLAY_WRITE =
  /(?:\.style\.display\s*=|\.style\.setProperty\s*\(\s*["']display["']|\.style\.removeProperty\s*\(\s*["']display["'])/;

const HINT =
  "Use the hidden attribute and layout classes in src/ui/domOverlays.css instead of style.display.";

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("overlay visibility: no style.display in src", () => {
  it("must not write display via element.style", () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(srcDir)) {
      const rel = path.relative(root, file);
      const lines = fs.readFileSync(file, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (DISPLAY_WRITE.test(lines[i])) {
          violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
    expect(violations, [HINT, ...violations].join("\n")).toEqual([]);
  });
});