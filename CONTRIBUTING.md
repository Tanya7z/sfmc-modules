# Contributing / 贡献指南

Welcome to **sfmc-modules**.  
欢迎来到 **sfmc-modules**。

This repository holds first-party SFMC v2 modules. Each module is a small self-contained SAPI-side package that depends **only** on `@sfmc/sdk` and the Minecraft Bedrock Script API.  
此仓库包含 SFMC v2 的第一方模块。每个模块都是一个独立的、小型的 SAPI 端包，**仅**依赖于 `@sfmc/sdk` 和 Minecraft Bedrock 脚本 API。

---

## Module contract / 模块契约

See [README.md](./README.md#module-contract-v2). Every module MUST:  
参见 [README.md](./README.md#module-contract-v2)。每个模块**必须**：

1. Ship `sapi/manifest.json` with `schemaVersion: 2`.  
   提供 `sapi/manifest.json`，且 `schemaVersion: 2`。

2. Ship `sapi/src/index.ts` calling `ModuleRegistry.register({...})`.  
   提供 `sapi/src/index.ts`，并调用 `ModuleRegistry.register({...})`。

3. Declare **all** permissions it needs (db:read:*, db:write:*, config:*, service:*).  
   声明其所需的**所有**权限（`db:read:*`、`db:write:*`、`config:*`、`service:*`）。

4. Declare **all** cross-module calls via `services.requires`.  
   通过 `services.requires` 声明**所有**跨模块调用。

5. Not import other modules' source code (use `service.get(...)` instead).  
   不得导入其他模块的源代码（应改用 `service.get(...)`）。

---

## Adding a new module / 添加新模块

```bash
./tools/new.sh my-module-id
```

(Or copy `packages/land/` as a template.)  
（或复制 `packages/land/` 作为模板。）

---

## Testing locally / 本地测试

Without publishing, you can `npm link` the SDK into each module:  
在不发布的情况下，您可以将 SDK 通过 `npm link` 链接到每个模块中：

```bash
cd ../ScriptsForMinecraftServer/modules/sdk/@sfmc-sdk
npm link
cd ../sfmc-modules/packages/land
npm link @sfmc/sdk
```

Then in main repo:  
然后在主仓库中执行：

```bash
sfmc behavior-pack build
sfmc behavior-pack deploy
```

---

## Releases / 发布

Tag the module with semver. CI publishes:  
使用 semver 为模块打标签。CI 会发布：

```
sfmc-module-<id>-<X.Y.Z>.zip
```

to GitHub Releases + writes the entry into `index.json` on `main`.  
到 GitHub Releases，并将条目写入 `main` 分支的 `index.json` 中。

---

## Style / 代码风格

- TypeScript strict mode (`exactOptionalPropertyTypes: true`)  
  TypeScript 严格模式（`exactOptionalPropertyTypes: true`）

- No raw SQL — only `db.tx()` / `db.query()` with `WhereExpr`  
  禁止直接编写 SQL —— 只允许使用 `db.tx()` / `db.query()` 配合 `WhereExpr`

- No direct `fetch()` / `require("fs")` — only `@sfmc/sdk` capability surface  
  禁止直接调用 `fetch()` 或 `require("fs")` —— 只能使用 `@sfmc/sdk` 提供的功能接口

---

## License / 许可证

By contributing, you agree your code is licensed under ISC (matching this repo).  
通过贡献代码，您同意您的代码采用 ISC 许可证（与本仓库一致）。
