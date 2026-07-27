# 聊天头像前缀：协议 Relay 取皮技术路线

本文说明 **在不修改 / 不注入原版 BDS** 的前提下，如何取得玩家当前皮肤像素，烘焙成 Bedrock 自定义 glyph，并作为聊天前缀显示。

相关契约见同目录 [avatar-dump-contract.md](./avatar-dump-contract.md)。

---

## 1. 问题为什么难

| 路径 | 能否拿到「当前进服皮肤」像素 |
|------|------------------------------|
| Script API / `@minecraft/server` | 否（无贴图字节） |
| `getPlayerSkin`（gametest） | 否（仅臂型 / persona / 肤色元数据） |
| 纯原版 `bedrock_server` | 否（Login 皮自用，不对外） |
| mc-heads / vrc.lol / Geyser Global API | **不可靠**（Java 或「曾进过 Geyser 服」的缓存皮，不是本服 Login 真皮） |
| LeviLamina 等进程内模组 | 能（本方案**不采用**） |
| **进程外协议 Relay（MITM）** | **能**（旁路解析 Login，BDS 仍原版） |

登录包（Login）里带有 `SerializedSkin`（RGBA + 宽高）。数据在协议里，不在 Script API 里。

---

## 2. 总体架构

```text
  玩家客户端
       │  UDP / Bedrock 协议（对外端口，如 19132）
       ▼
  ┌─────────────────────────────┐
  │  skin-relay（Node）         │
  │  bedrock-protocol Relay     │
  │  · 完成握手 / 鉴权转发      │
  │  · 解析 serverbound login   │
  │  · 裁头 → 写 PNG            │
  └─────────────┬───────────────┘
                │  转发到本机
                ▼
         原版 BDS :19131
         （只绑 127.0.0.1）

  data/chat-avatars/<safeName>.png
                │
                ▼
  bake-avatars.mjs → glyph_E9.png → packs / bump
                │
                ▼
  下次 start bds → 客户端装载新 RP
                │
                ▼
  SAPI chat：消息前缀 U+E9xx 字符
```

**职责分离（DIP）**

| 组件 | 职责 | 不依赖 |
|------|------|--------|
| skin-relay | 协议旁路、写 PNG | 不 import chat SAPI / db-server |
| bake-avatars | 读 PNG + 槽位表、拼 atlas、bump RP | 不解析协议 |
| SAPI chat | 槽位分配、`formatChatLine` 带 glyph | 不读文件系统、不碰协议 |
| 原版 BDS | 游戏逻辑 | 不知道 Relay 存在 |

文件契约是唯一耦合点：`data/chat-avatars/`。

---

## 3. Relay 工作原理（MITM）

### 3.1 拓扑

1. 运维把 **对外** 游戏端口指到 Relay（例：`19132`）。
2. `server.properties` 里 BDS 改听 **内网口**（例：`server-port=19131`，防火墙不对外开放）。
3. Relay `destination = { host: '127.0.0.1', port: 19131 }`。
4. 玩家服务器列表仍填公网 IP + 19132；BDS 进程保持官方二进制。

### 3.2 库

推荐与 SFMC 同栈：**[PrismarineJS/bedrock-protocol](https://github.com/PrismarineJS/bedrock-protocol)** 的 `Relay`：

- 对外表现为 Bedrock 服务器（握手、压缩、加密）。
- 对内再作为客户端连真实 BDS。
- 在 `player.on('serverbound', …)` 里观察 `name === 'login'`（或当前版本等价包名），从 params / JWT skin 段取出像素。

伪代码：

```js
import { Relay } from "bedrock-protocol";
import { writeHeadPng } from "./extract-skin.js";

const relay = new Relay({
  version: "1.21.xxx", // 必须与 BDS / 客户端协议对齐
  host: "0.0.0.0",
  port: 19132,
  destination: { host: "127.0.0.1", port: 19131 },
});

relay.on("connect", (player) => {
  player.on("serverbound", ({ name, params }) => {
    if (name !== "login") return;
    // 从 params 解析 displayName / xuid / skin ImageData
    writeHeadPng({ name, xuid, rgba, width, height });
  });
});

relay.listen();
```

实现落点：`packages/chat/tools/skin-relay/`。

### 3.3 从 Login 到 PNG

典型字段（版本间命名可能变化，以实现时 protocol 定义为准）：

- 玩家显示名：JWT chain / `ThirdPartyName` / `displayName`
- XUID：Xbox 身份（可写入 meta）
- Skin：Base64 或原始 RGBA；宽高常见 64×64 / 128×128（经典）或 Persona 更大图

**经典皮肤裁头（UV）：**

- 底层脸：`(8,8)–(16,16)`（8×8）
- 帽层：`(40,8)–(48,16)`，非透明像素叠在脸上
- 输出：至少 8×8 PNG；bake 再放大塞进 glyph 格

**Persona：** 几何非经典 UV 时，首期策略为「整图缩放到格内」或回退史蒂夫，避免花屏。

### 3.4 鉴权与版本风险（必读）

- Relay 必须跟 **BDS 协议版本**；升级 MC 后先升 `bedrock-protocol` / 配置 `version`。
- Xbox 在线模式：中继要正确处理 chain / token。社区在 1.26+ 对 Relay 鉴权有过问题报告——上线前务必用真实 Xbox 号压测进服。
- Relay 进程挂掉 = 玩家进不了服；建议纳入 `sfmc` 服务监督（后续平台任务，本模块先独立 CLI）。
- 离线模式（`online-mode=false`）联调更容易，但生产服多为在线模式。

---

## 4. 与聊天前缀的衔接

### 4.1 Unicode glyph

- 资源包装 `font/glyph_E9.png`（16×16 格 → `U+E900`…`U+E9FF`）。
- 槽位 `0`：默认史蒂夫头。
- 玩家槽位 `1…255`：一人一格；满后再开 `glyph_EA`（同模块扩展）。

聊天行示例：

```text
<glyph>§b[PB] §f玩家名: 消息内容
```

SAPI 侧统一走 `formatChatLine`（DRY），订阅者与发送者同一模板。

### 4.2 槽位表 `chat_avatars`

SAPI `db.defineTable` 自有表（不污染 `sfmc_players`）：

| 列 | 含义 |
|----|------|
| player_id | Script `player.id` |
| player_name | 与 dump 文件名对齐（sanitize 规则见契约） |
| slot | 1–255 |
| skin_hash | 与 meta / 文件内容哈希对齐 |
| dirty | 待 bake |
| updated_at | |

`playerJoin` → `ensureAvatarSlot`；内存缓存 `playerId → glyphChar`。

### 4.3 bake（非热更）

1. 读 `data/chat-avatars/` 与 DB dirty 行。
2. 拼 `glyph_E9.png`。
3. 写入已装世界 RP 或丢进 `SFMC_ROOT/packs/`。
4. 调用与 `sfmc packs bump` 同契约的 `bumpPackPatchVersion`（`@sfmc-bds/bds-tools/world-packs`），触发客户端下次进服重下 RP。
5. **重启 BDS（并建议玩家重进）后** 新头像生效。

---

## 5. 运维清单

1. 安装并启用 `feature-chat`；部署 `avatar-rp`（inbox 或首次 bake 自动投放）。
2. BDS 改内网端口；对外只开 Relay。
3. 启动顺序建议：`db-server` → **skin-relay** → BDS（及 qq-bridge 等）。
4. 玩家进服 → 目录出现 PNG。
5. 定时或关服前：`npm run bake-avatars -w @sfmc-bds/module-chat`（或包内脚本）。
6. `sfmc start bds` / 重启使新 RP 版本生效。

---

## 6. 明确不做

- 不修改 `ScriptsForMinecraftServer` 的 `assembleResourcePack` 嵌套合并（glyph 必须在 RP **根** `font/`）。
- 不把动态头像放进聚合包 `sfmc-modules-rp`（无自动 patch bump）。
- 不以 Geyser/vrc.lol 为默认取皮。
- 不引入 LeviLamina。

---

## 7. 参考链接

- [bedrock-protocol Relay 文档](https://github.com/PrismarineJS/bedrock-protocol/blob/master/docs/API.md)
- [Bedrock Wiki · Custom Emojis / glyph](https://wiki.bedrock.dev/text/custom-emojis)
- [Geyser Global API 说明（为何不能当本服真皮）](https://geysermc.org/wiki/api/api.geysermc.org/global-api/)
