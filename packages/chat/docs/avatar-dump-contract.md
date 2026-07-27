# 头像 dump 文件契约

Relay / 手工投放 / 测试脚本 **只通过本目录与 bake、SAPI 协作**。更换伴生实现时不得改路径语义。

## 根目录

```text
<SFMC_ROOT>/data/chat-avatars/
```

`SFMC_ROOT` 与平台一致（环境变量或旁路探测 `configs/runtime.json`）。

## 文件命名

| 文件 | 说明 |
|------|------|
| `<safeName>.png` | 头像图（建议 ≥8×8；经典裁头 8×8 即可） |
| `<safeName>.meta.json` | 可选元数据 |

**safeName**：由玩家显示名生成：

1. Unicode NFKC
2. 去首尾空白
3. 将 `\ / : * ? " < > |` 与控制字符替换为 `_`
4. 空结果则用 `unknown`
5. 长度截断至 64

Relay 与 SAPI / bake **必须使用同一 sanitize**（实现见 `tools/skin-names.mjs`）。

> 不以 Script `player.id` 作文件名：Relay 侧通常只有 gamertag/XUID，与 `player.id` 不一定可稳定对齐。槽位表用 `player_id`；文件用 `player_name` → safeName。

## meta.json 示例

```json
{
  "name": "PlayerName",
  "xuid": "2535…",
  "skinHash": "sha256-hex-of-png-bytes",
  "width": 8,
  "height": 8,
  "dumpedAt": "2026-07-24T08:00:00.000Z",
  "source": "skin-relay"
}
```

- `skinHash` 变化 → bake 应重烘对应槽位；SAPI 可将 `dirty` 置 1（若能感知；否则 bake 自行比对）。
- 缺 meta 时 bake 用 PNG 文件内容哈希。

## 读写方

| 角色 | 读 | 写 |
|------|----|----|
| skin-relay | — | PNG + meta（进服 / 换皮） |
| bake-avatars | PNG + meta + DB 槽位 | atlas / RP；可回写 DB dirty=0、skin_hash |
| SAPI | —（禁止 Node fs） | 仅 DB `chat_avatars` |
| 运维手塞 | — | 可只放 PNG，无 meta |

无对应 PNG 时：bake / 聊天均使用槽位 `0`（史蒂夫）。
