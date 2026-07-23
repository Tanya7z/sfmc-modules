#!/usr/bin/env node
/**
 * tools/new-module.mjs — 跨平台生成新模块骨架（替代 tools/new.sh）
 *
 * 用法:
 *   node tools/new-module.mjs <folder> [显示名]
 *   node tools/new-module.mjs --help
 *   npm run new -- <folder> [显示名]
 *
 * 命名约定（文件夹不含 feature-/core- 前缀）:
 *   文件夹 / fetch-module install id  → 短名，如 my-mod、area
 *   package.json name                → @sfmc-bds/module-<folder>
 *   sapi/manifest.json id            → feature-<folder>（--type core → core-<folder>）
 *   configKey                        → <folder> 的 - 换成 _
 *
 * 产出:
 *   packages/<folder>/package.json
 *   packages/<folder>/sapi/manifest.json
 *   packages/<folder>/sapi/src/index.ts
 *   packages/<folder>/sapi/tsconfig.json
 *   packages/<folder>/configs-default/<configKey>.json
 *
 * 写完后会跑 sync-index.js 把 folder 记进 index.json。
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function printHelp() {
  console.log(`tools/new-module.mjs — scaffold a new SFMC v2 module

Usage:
  node tools/new-module.mjs <folder> [display-name]
  npm run new -- <folder> [display-name]

Convention:
  folder (install id)   my-mod / area   （禁止 feature-/core- 前缀）
  npm name              @sfmc-bds/module-my-mod
  manifest.id           feature-my-mod   （--type core → core-my-mod）
  configKey             my_mod

Flags:
  --type feature|core   默认 feature（决定 manifest.id 前缀）
  -h, --help            show this help
`);
}

/**
 * @param {string} folder
 * @param {"feature" | "core"} type
 * @returns {{ folder: string, manifestId: string, type: "feature" | "core", configKey: string, npmName: string }}
 */
function resolveNames(folder, type = "feature") {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(folder)) {
    throw new Error(`invalid folder "${folder}": use lowercase kebab-case (e.g. my-mod, area)`);
  }
  if (folder.startsWith("feature-") || folder.startsWith("core-")) {
    throw new Error(
      `folder must be short stem without type prefix (got "${folder}"; use e.g. "${folder.replace(/^(feature|core)-/, "")}" + --type ${folder.startsWith("core-") ? "core" : "feature"})`
    );
  }
  if (type !== "feature" && type !== "core") {
    throw new Error(`invalid --type "${type}" (use feature|core)`);
  }
  return {
    folder,
    manifestId: `${type}-${folder}`,
    type,
    configKey: folder.replace(/-/g, "_"),
    npmName: `@sfmc-bds/module-${folder}`,
  };
}

/**
 * @param {string} filePath
 * @param {string} contents
 */
function write(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

/**
 * @param {string} folder
 * @param {string} displayName
 * @param {"feature" | "core"} [type]
 */
function scaffold(folder, displayName, type = "feature") {
  const names = resolveNames(folder, type);
  const pkgDir = resolve(ROOT, "packages", names.folder);
  if (existsSync(pkgDir)) {
    throw new Error(`already exists: packages/${names.folder}`);
  }

  /** @type {string[]} */
  const created = [];

  const packageJson = {
    name: names.npmName,
    version: "0.1.0",
    private: true,
    type: "module",
    description: `SAPI module: ${displayName}`,
    main: "sapi/src/index.ts",
    scripts: {
      typecheck: "tsc --noEmit -p sapi/tsconfig.json",
    },
    dependencies: {
      "@sfmc-bds/sdk": "*",
    },
  };
  const packagePath = resolve(pkgDir, "package.json");
  write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  created.push(`packages/${names.folder}/package.json`);

  const manifest = {
    $schema: "../../../../node_modules/@sfmc-bds/sdk/schemas/sapi-manifest.v2.schema.json",
    schemaVersion: 2,
    id: names.manifestId,
    name: displayName,
    type: names.type,
    configKey: names.configKey,
    requires: [],
    permissions: [`config:read:${names.configKey}`, `config:write:${names.configKey}`],
    services: {
      provides: [],
      requires: [],
    },
    notes: "新建模块骨架。",
  };
  const manifestPath = resolve(pkgDir, "sapi", "manifest.json");
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  created.push(`packages/${names.folder}/sapi/manifest.json`);

  const indexTs = `/**
 * ${names.npmName} — v2 入口
 */

import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Permission } from "@sfmc-bds/sdk/sapi/runtime";

const MODULE_ID = "${names.manifestId}";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("${names.configKey}.use", Permission.Any);
    },
    async init() {
      // 在此调 db.defineTable / db.tx / service.get / config.get ...
    },
    cleanup() {},
  },
});
`;
  const indexPath = resolve(pkgDir, "sapi", "src", "index.ts");
  write(indexPath, indexTs);
  created.push(`packages/${names.folder}/sapi/src/index.ts`);

  const tsconfig = {
    extends: "../../../tsconfig.base.json",
    compilerOptions: {
      noEmit: true,
      rootDir: "./src",
    },
    include: ["src/**/*"],
  };
  const tsconfigPath = resolve(pkgDir, "sapi", "tsconfig.json");
  write(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
  created.push(`packages/${names.folder}/sapi/tsconfig.json`);

  const configStub = {
    schemaVersion: 1,
    // 按需扩展；联调时复制到主仓 configs/<configKey>.json
  };
  const configPath = resolve(pkgDir, "configs-default", `${names.configKey}.json`);
  write(configPath, `${JSON.stringify(configStub, null, 2)}\n`);
  created.push(`packages/${names.folder}/configs-default/${names.configKey}.json`);

  const sync = spawnSync(process.execPath, [resolve(ROOT, "tools", "sync-index.js"), names.folder], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (sync.status !== 0) {
    console.warn(`[new-module] sync-index failed: ${(sync.stderr || sync.stdout || "").trim()}`);
  }

  console.log(`✓ 已生成 packages/${names.folder}`);
  console.log(`  npm:          ${names.npmName}`);
  console.log(`  manifest.id:  ${names.manifestId}`);
  console.log(`  configKey:    ${names.configKey}`);
  console.log("  files:");
  for (const f of created) console.log(`    - ${f}`);
  console.log("  next:");
  console.log("    - 编辑 sapi/manifest.json 声明 permissions / services");
  console.log("    - 编辑 sapi/src/index.ts 写实际业务");
  console.log("    - npm run typecheck");
  console.log(
    `    - 主仓联调: node tools/fetch-module.mjs install ${names.folder} --from dir:../sfmc-modules/packages/${names.folder} --link`
  );
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    if (args.length === 0) process.exit(1);
    return;
  }

  /** @type {"feature" | "core"} */
  let type = "feature";
  /** @type {string[]} */
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--type") {
      const v = args[++i];
      if (v !== "feature" && v !== "core") {
        console.error(`ERR: invalid --type "${v}" (use feature|core)`);
        process.exit(1);
      }
      type = v;
      continue;
    }
    if (a.startsWith("--type=")) {
      const v = a.slice("--type=".length);
      if (v !== "feature" && v !== "core") {
        console.error(`ERR: invalid --type "${v}" (use feature|core)`);
        process.exit(1);
      }
      type = v;
      continue;
    }
    positional.push(a);
  }

  const folder = positional[0];
  if (!folder) {
    printHelp();
    process.exit(1);
  }
  const displayName = positional[1] || folder;
  try {
    scaffold(folder, displayName, type);
  } catch (err) {
    console.error(`ERR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
