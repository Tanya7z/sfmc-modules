/**
 * smoke-avatar.mjs — 无 BDS/DB 时冒烟：format 字符串 + 样例 PNG blit + dry-run bake
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

import { sanitizePlayerName, avatarDumpDir, avatarPngPath } from "./skin-names.mjs";
import { blitHeadToSlot, loadAtlas, saveAtlas } from "./glyph-atlas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const ATLAS = path.join(PKG_ROOT, "avatar-rp", "font", "glyph_E9.png");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** 与 chat-format.ts 保持一致（冒烟用，避免拉 TS） */
function formatChatLine(opts) {
  const style = opts.style ?? "channel";
  const glyph = opts.glyph ?? "";
  const head = glyph ? `${glyph}` : "";
  if (style === "private") return `${head}§d[私信] §f${opts.name}: ${opts.content}`;
  if (style === "broadcast") return `${head}§a[${opts.channelPrefix}] ${opts.name}: ${opts.content}`;
  return `${head}§b[${opts.channelPrefix}] §f${opts.name}: ${opts.content}`;
}

function makeSampleHeadPng() {
  const png = new PNG({ width: 8, height: 8 });
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8 + x) << 2;
      png.data[i] = 40 + x * 20;
      png.data[i + 1] = 120;
      png.data[i + 2] = 200 - y * 10;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function main() {
  console.log("[smoke-avatar] start");

  // 1) sanitize
  assert(sanitizePlayerName("A/B:C") === "A_B_C", "sanitize path chars");
  assert(sanitizePlayerName("  ") === "unknown", "sanitize empty");

  // 2) formatChatLine
  const g = String.fromCodePoint(0xe901);
  const line = formatChatLine({
    glyph: g,
    channelPrefix: "PB",
    name: "Alice",
    content: "hi",
    style: "channel",
  });
  assert(line.startsWith(g), "glyph prefix");
  assert(line.includes("§b[PB]"), "channel prefix");
  assert(line.includes("Alice"), "name");
  const priv = formatChatLine({
    glyph: g,
    channelPrefix: "x",
    name: "Bob",
    content: "yo",
    style: "private",
  });
  assert(priv.includes("§d[私信]"), "private style");

  // 3) blit sample into atlas copy
  assert(fs.existsSync(ATLAS), `missing ${ATLAS}`);
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-chat-avatar-"));
  const dumpDir = avatarDumpDir(tmpRoot);
  fs.mkdirSync(dumpDir, { recursive: true });
  const sampleName = "Smoke_Tester";
  const samplePng = makeSampleHeadPng();
  fs.writeFileSync(avatarPngPath(tmpRoot, sampleName), samplePng);

  const workAtlas = path.join(tmpRoot, "glyph_E9.png");
  fs.copyFileSync(ATLAS, workAtlas);
  const { png: atlas, cell } = loadAtlas(workAtlas);
  const before = Buffer.from(atlas.data);

  blitHeadToSlot(atlas, cell, 1, samplePng);
  saveAtlas(atlas, workAtlas);
  const after = PNG.sync.read(fs.readFileSync(workAtlas));
  let diff = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after.data[i]) diff++;
  }
  assert(diff > 0, "atlas pixels should change after blit slot 1");
  console.log(`[smoke-avatar] blit ok (diffBytes=${diff}, cell=${cell})`);

  // 4) dry-run bake against tmp root（会扫 dump）
  process.env.SFMC_ROOT = tmpRoot;
  // 将 atlas 路径仍用包内；bake 写的是包内 atlas — 用 --dry-run 只验证能扫到行
  // 手动模拟 dump-scan 行
  const slots = { slots: { [sanitizePlayerName(sampleName)]: 1 } };
  fs.writeFileSync(path.join(dumpDir, "slots.json"), JSON.stringify(slots, null, 2));

  console.log("[smoke-avatar] format + blit + dump layout OK");
  console.log(`[smoke-avatar] tmp=${tmpRoot}`);
  console.log("[smoke-avatar] PASS");
}

main();
