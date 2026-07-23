# sfmc-modules

SFMC v2 协议模块。为 [ScriptsForMinecraftServer](https://github.com/Shiroha7z/ScriptsForMinecraftServer) 构建的第一方模块，基于 `@sfmc/sdk`。

每个 `packages/<id>/` 下的模块包含：

- `sapi/manifest.json` — v2 协议声明（`schemaVersion: 2`）
- `sapi/src/index.ts` — SAPI 入口点（`ModuleRegistry.register({...})`）
- `package.json` — 依赖 `@sfmc/sdk`
- 可选 `configs-default/` — 初始 `configs/<configKey>.json` 默认配置
- 可选 `resource_pack/` — 与行为包打包在一起的资源文件

## 目录结构

```txt
sfmc-modules/
├── packages/
│   ├── land/                       # 领地 + GUI（v2 标准示例）
│   ├── economy/                    # 经济系统
│   ├── chat/  chat-gui/            # 聊天
│   ├── coop/  coop-gui/            # 合作社
│   ├── fly/                        # 区域飞行
│   ├── afk/                        # 挂机判定
│   ├── peace/                      # 和平区域
│   ├── spawn-protect/              # 重生保护
│   ├── clean/                      # 地面掉落清理
│   ├── qa/                         # 问答
│   ├── tps/                        # TPS 监控
│   ├── chat-sounds/                # 聊天音效
│   ├── daily-task/                 # 每日任务
│   ├── online-time/                # 在线时长
│   ├── monitor/                    # 服务器监控
│   ├── activity-log/               # 行为日志
│   ├── scoreboard-sync/            # 计分板快照
│   ├── inventory-switcher/         # 背包切换
│   ├── creative/                   # 创造区域
│   ├── survival/                   # 生存区域
│   ├── data-backup/                # 数据备份
│   ├── gui/                        # 主菜单 GUI
│   └── ...
├── index.json                      # 模块目录镜像
├── tools/
│   ├── check-modules.js            # 校验所有 manifest.json 是否合法
│   └── build.js                    # 批量 esbuild 到 ./build/
├── .github/workflows/ci.yml
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## 模块契约（v2）

每个模块必须包含 `sapi/manifest.json`：

```json
{
  "schemaVersion": 2,
  "id": "feature-land",
  "name": "领地系统",
  "type": "feature",
  "configKey": "land",
  "requires": ["feature-economy"],
  "permissions": [
    "db:read:lands",
    "db:write:lands",
    "config:read:land",
    "config:write:land",
    "service:economy.account"
  ],
  "services": {
    "provides": [
      { "name": "land.byOwner", "input": {...}, "output": {...} }
    ],
    "requires": [
      { "name": "economy.account" }
    ]
  },
  "notes": "..."
}
```

包含 `routes` / `tables` / `migrations` / `handlers` 的 v1 清单会在平台启动时被拒绝。

## 模块作者快速入门

```bash
mkdir -p packages/my-module/sapi/src
cat > packages/my-module/sapi/manifest.json <<'EOF'
{
  "schemaVersion": 2,
  "id": "feature-my-module",
  "name": "My Module",
  "type": "feature",
  "configKey": "my_module",
  "requires": [],
  "permissions": ["db:read:my_table", "db:write:my_table", "config:read:my_module"],
  "services": { "provides": [], "requires": [] },
  "notes": ""
}
EOF
cat > packages/my-module/package.json <<'EOF'
{
  "name": "@sfmc-bds/module-my-module",
  "version": "0.1.0",
  "type": "module",
  "main": "sapi/src/index.ts",
  "private": true,
  "dependencies": {
    "@sfmc/sdk": "^0.1.0"
  },
  "peerDependencies": {
    "@minecraft/server": "2.10.0-beta.1.26.40-preview.30"
  }
}
EOF
```

```typescript
// packages/my-module/sapi/src/index.ts
import { db } from "@sfmc/sdk/sapi/db";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

ModuleRegistry.register({
  id: "feature-my-module",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("my_module.use", Permission.Any);
    },
    async init() {
      await db.defineTable("my_table", {
        id: { type: "text", primary: true },
        created_at: { type: "integer", notNull: true },
      });
    },
    cleanup() {},
  },
});
```

## 开发工作流

```bash
# 同级放置主仓与本仓后：
cd ../ScriptsForMinecraftServer && npm install && npm run sdk:build
cd ../sfmc-modules && npm install && npm run typecheck

# 联调：把模块 dir 安装进主仓再打 BP
cd ../ScriptsForMinecraftServer
node tools/fetch-module.mjs install land --from dir:../sfmc-modules/packages/land
sfmc behavior-pack build && sfmc behavior-pack deploy
```

详见 [CONTRIBUTING.md](./CONTRIBUTING.md#本地依赖怎么装推荐)。

## 分发

发布时会生成每个模块的压缩包：

```
sfmc-module-<id>-<X.Y.Z>.zip
sfmc-module-<id>-<X.Y.Z>.zip.sha256
```

`tools/check-modules.js` 会校验所有 `packages/*/sapi/manifest.json` 是否符合 v2 规范，并且 `index.json` 目录镜像与磁盘上的实际模块保持一致。

## CI

GitHub Actions 运行：

1. `tools/check-modules.js` — 检查 manifest v2 的合理性
2. `tools/build.js` — 对每个模块的 `sapi/src/index.ts` 执行 esbuild，验证无编译错误
3. 在 tag 推送时发布压缩包制品

## 从主仓库迁移

[ScriptsForMinecraftServer](https://github.com/Shiroha7z/ScriptsForMinecraftServer) 中的 `modules/packages/<id>/` 目录通过 `git subtree push` 迁移到此仓库：

```bash
cd ../ScriptsForMinecraftServer
git subtree push --prefix=modules/packages \
  git@github.com:Shiroha7z/sfmc-modules.git main
```

推送后，模块在此仓库中位于 `packages/<id>/` 下。主仓库的 `modules/catalog.json` 会更新为从此仓库获取 `index.json`，例如：

```bash
sfmc module install <id> --from github:Shiroha7z/sfmc-modules@latest
```

## 许可证

ISC
