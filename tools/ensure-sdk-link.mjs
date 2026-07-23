/**
 * tools/ensure-sdk-link.mjs
 *
 * 把旁路主仓的 @sfmc-bds/sdk 链到本仓 node_modules，并挂上 @sfmc/sdk 别名，
 * 这样 packages 里 `from "@sfmc/sdk/..."` 在 typecheck / IDE 里能解析。
 *
 * 期望布局（同级目录）:
 *   #MCBEProjects/ScriptsForMinecraftServer
 *   #MCBEProjects/sfmc-modules
 *
 * 可用环境变量覆盖:
 *   SFMC_PLATFORM_ROOT — 主仓绝对路径
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const platformRoot =
  process.env.SFMC_PLATFORM_ROOT ||
  path.resolve(REPO_ROOT, "..", "ScriptsForMinecraftServer");
const sdkSrc = path.join(platformRoot, "modules", "sdk", "@sfmc-sdk");
const nm = path.join(REPO_ROOT, "node_modules");
const linkBds = path.join(nm, "@sfmc-bds", "sdk");
const linkLegacy = path.join(nm, "@sfmc", "sdk");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function linkDir(target, linkPath) {
  ensureDir(path.dirname(linkPath));
  try {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink() || st.isDirectory()) fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {
    /* missing ok */
  }
  fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

if (!fs.existsSync(path.join(sdkSrc, "package.json"))) {
  console.warn(
    `[ensure-sdk-link] 找不到主仓 SDK: ${sdkSrc}\n` +
      `  请把 ScriptsForMinecraftServer 与 sfmc-modules 放在同级，或设 SFMC_PLATFORM_ROOT。\n` +
      `  跳过链接；standalone typecheck 将无法解析 @sfmc/sdk。`
  );
  process.exit(0);
}

ensureDir(nm);
linkDir(sdkSrc, linkBds);
linkDir(sdkSrc, linkLegacy);
console.log(`[ensure-sdk-link] linked @sfmc-bds/sdk + @sfmc/sdk → ${sdkSrc}`);
