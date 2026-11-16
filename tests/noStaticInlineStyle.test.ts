import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");

const DISPLAY_WRITE =
  /(?:\.style\.display\s*=|\.style\.setProperty\s*\(\s*["']display["']|\.style\.removeProperty\s*\(\s*["']display["'])/;

const CSS_TEXT_WRITE = /\.style\.cssText\s*=/;

const DISPLAY_HINT =
  "Use the hidden attribute and colocated *.module.css layout classes instead of style.display.";

const CSS_TEXT_HINT =
  "Static layout belongs in colocated *.module.css; use element.className and runtime style.setProperty for dynamic geometry only.";

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

function scan(pattern: RegExp): string[] {
  const violations: string[] = [];
  for (const file of walkTsFiles(srcDir)) {
    const rel = path.relative(root, file);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        violations.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }
  return violations;
}

describe("overlay DOM styling guards", () => {
  it("must not write display via element.style", () => {
    const violations = scan(DISPLAY_WRITE);
    expect(violations, [DISPLAY_HINT, ...violations].join("\n")).toEqual([]);
  });

  it("must not assign style.cssText (use CSS modules)", () => {
    const violations = scan(CSS_TEXT_WRITE);
    expect(violations, [CSS_TEXT_HINT, ...violations].join("\n")).toEqual([]);
  });
});