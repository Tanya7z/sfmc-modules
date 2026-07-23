#!/usr/bin/env node
/**
 * tools/check-minecraft-versions.mjs — 委托主仓校验 @minecraft/* 版本
 *
 * 权威 pin 在主仓 ScriptsForMinecraftServer 根 package.json。
 * 本脚本将 --modules-root 指向本仓，由主仓 tools/check-minecraft-versions.mjs 扫描。
 *
 * 用法:
 *   node tools/check-minecraft-versions.mjs
 *   npm run check-minecraft-versions
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_ROOT = resolve(__dirname, "..");

function resolvePlatformRoot() {
  if (process.env.SFMC_PLATFORM_ROOT) {
    return resolve(process.env.SFMC_PLATFORM_ROOT);
  }
  const sibling = resolve(MODULES_ROOT, "..", "ScriptsForMinecraftServer");
  if (existsSync(resolve(sibling, "tools", "check-minecraft-versions.mjs"))) {
    return sibling;
  }
  return null;
}

const platformRoot = resolvePlatformRoot();
if (!platformRoot) {
  console.error(
    "[check-minecraft] FAIL: 找不到主仓 ScriptsForMinecraftServer\n" +
      "  设置 SFMC_PLATFORM_ROOT 或保持两仓同级目录"
  );
  process.exit(1);
}

const script = resolve(platformRoot, "tools", "check-minecraft-versions.mjs");
const r = spawnSync(
  process.execPath,
  [script, "--modules-root", MODULES_ROOT],
  { cwd: platformRoot, encoding: "utf8", stdio: "pipe" }
);

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
