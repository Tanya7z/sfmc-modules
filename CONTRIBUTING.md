# Contributing / 贡献指南

Welcome to **sfmc-modules**.  
欢迎来到 **sfmc-modules**。

This repository holds first-party SFMC v2 modules. Each module is a small self-contained SAPI-side package.  
此仓库包含 SFMC v2 的第一方模块。每个模块都是独立的 SAPI 端包。

---

## 本地依赖怎么装（推荐）

`sfmc-modules` **不是**完整运行时仓：真正的 SDK / BDS / BP 构建都在旁路的
[ScriptsForMinecraftServer](https://github.com/Shiroha7z/ScriptsForMinecraftServer)。
因此本仓的 `npm install` 只解决两件事：TypeScript + `@minecraft/*` 类型，以及把主仓 SDK 链到 `node_modules`。

期望目录（同级）：

```txt
MCBEProjects/
  ScriptsForMinecraftServer/   ← 平台 + @sfmc-bds/sdk
  sfmc-modules/                ← 本仓
```

```bash
# 1) 主仓先装好并构建 SDK
cd ../ScriptsForMinecraftServer
npm install
npm run sdk:build

# 2) 本仓安装
cd ../sfmc-modules
npm install
# postinstall 会自动 junction:
#   node_modules/@sfmc-bds/sdk  → 主仓 modules/sdk/@sfmc-sdk
#   node_modules/@sfmc/sdk      → 同上（兼容旧 import 路径）

# 3) 类型检查
npm run typecheck
npm run check
```

若两仓不在同级，设置系统变量：

```bash
# PowerShell
$env:SFMC_PLATFORM_ROOT = "D:\#WorkPlace\#MCBEProjects\ScriptsForMinecraftServer"
npm install
```

### 在主仓里联调

本仓改完后，用 `dir:` 装进主仓再 build/deploy。开发期推荐 `--link`（Windows junction / POSIX symlink），改本仓立刻反映到主仓，无需反复 copy：

```bash
cd ../ScriptsForMinecraftServer
# 复制安装（默认）
node tools/fetch-module.mjs install economy --from dir:../sfmc-modules/packages/economy
# 链接安装（Phase 0 DX，推荐日常联调）
node tools/fetch-module.mjs install economy --from dir:../sfmc-modules/packages/economy --link
# 或一次装多个：--from 指向 packages 父目录
node tools/fetch-module.mjs install afk economy --from dir:../sfmc-modules/packages --link
sfmc behavior-pack build
sfmc behavior-pack deploy
```

源码里仍可写 `import … from "@sfmc/sdk/…"`（`ensure-sdk-link` 会挂同名别名）；
`package.json` 依赖请写已发布名 `@sfmc-bds/sdk`（本仓根 `file:` 指到旁路主仓）。

---

## Module contract / 模块契约

See [README.md](./README.md#module-contract-v2). Every module MUST:  
参见 [README.md](./README.md#module-contract-v2)。每个模块**必须**：

1. Ship `sapi/manifest.json` with `schemaVersion: 2`.  
2. Ship `sapi/src/index.ts` calling `ModuleRegistry.register({...})`.  
3. Declare **all** permissions it needs (`db:read:*`, `db:write:*`, `config:*`, `service:*`).  
4. Declare **all** cross-module calls via `services.requires` / manifest `requires`.  
5. Not import other modules' source code (use `service.get` / `tx.call` instead).  
   跨模块运行时依赖写在 **manifest**；只有真正 `import type` 时才在 `package.json` 加模块依赖。

---

## Adding a new module / 添加新模块（Phase 0）

```bash
# 跨平台（推荐）
npm run new -- my-mod "我的模块"
# 等价
node tools/new-module.mjs my-mod "我的模块"
# bash 兼容入口仍可用
./tools/new.sh my-mod "我的模块"
```

命名约定：

| 层 | 示例 |
|----|------|
| 文件夹 / `fetch-module install` | `my-mod`（禁止 `feature-`/`core-` 前缀） |
| npm (`package.json` name) | `@sfmc-bds/module-my-mod`（与平台同组织） |
| `manifest.id` | `feature-my-mod`（`--type core` → `core-my-mod`） |
| `configKey` | `my_mod` |

骨架含 `package.json`（依赖 `@sfmc-bds/sdk`）、`sapi/manifest.json`、`sapi/src/index.ts`、`sapi/tsconfig.json`、`configs-default/<configKey>.json`，并增量写入 `index.json`。

然后在主仓 `--link` 联调（见上）
---

## Releases / 发布

Tag the module with semver. CI publishes zip artifacts and updates `index.json` on `main`.

---

## Style / 代码风格

- TypeScript strict (`exactOptionalPropertyTypes: true`)
- No raw SQL — only `db.tx()` / `db.query()` with `WhereExpr`
- No direct `fetch()` / `fs` — only `@sfmc/sdk` (alias of `@sfmc-bds/sdk`) capability surface

---

## @minecraft/* 版本 / Minecraft API pins

Bedrock Script API 类型与运行时须与主仓 **同一 preview 线** 对齐。权威 pin 在主仓
`ScriptsForMinecraftServer/package.json` 的 `devDependencies` + `overrides`（当前示例：`1.26.40-preview.30` 线）。

| 包 | 用途 |
| ---- | ------ |
| `@minecraft/server` | SAPI 核心 |
| `@minecraft/server-ui` | 表单 UI |
| `@minecraft/server-net` | Node 侧 net（主仓 dev） |
| `@minecraft/vanilla-data` | 原版数据枚举 |

业务模块 **不要** 声明 `@minecraft/*`（dependencies / peerDependencies / devDependencies）。  
类型来自本仓根 `devDependencies`（与主仓 pin 对齐）。`@sfmc-bds/sdk` 自身可选 peer 可保留 `>=` 最低兼容范围。

校验：

```bash
npm run check-minecraft-versions
# 或主仓侧（会顺带扫描同级 sfmc-modules）：
cd ../ScriptsForMinecraftServer && npm run check-minecraft-versions
```

升级 preview：先改主仓根 `devDependencies` + `overrides`，再两边根目录 `npm install`，同步本仓根 `devDependencies`，最后跑上述 check。

## Lint

本仓 `npm run lint` 启用 `@sfmc-bds/eslint-plugin`（`file:` 链到主仓 `modules/sdk/@sfmc-eslint-plugin`）。规则说明见该包 README 与主仓 `docs/dev/module-author.md`。

---

## License / 许可证

By contributing, you agree your code is licensed under ISC (matching this repo).
