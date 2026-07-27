# skin-relay

原版 BDS 前的 Bedrock 协议 MITM：旁路 Login 皮肤 → `data/chat-avatars/`。

完整技术路线：[avatar-skin-relay.md](../../docs/avatar-skin-relay.md)  
文件契约：[avatar-dump-contract.md](../../docs/avatar-dump-contract.md)

## 快速开始

1. 将 BDS `server-port` 改为内网口（如 `19131`），勿对公网开放。
2. 设置环境变量并对齐协议版本：

```powershell
$env:SFMC_ROOT = "D:\path\to\ScriptsForMinecraftServer"
$env:SKIN_RELAY_PORT = "19132"
$env:SKIN_RELAY_DEST_PORT = "19131"
$env:SKIN_RELAY_VERSION = "1.21.90"   # 与 BDS 一致
npm run skin-relay
```

3. 玩家连 **Relay 端口**；进服后应出现 `data/chat-avatars/<safeName>.png`。
4. `npm run bake-avatars` → 重启 BDS。

联调可设 `SKIN_RELAY_OFFLINE=1`（仅离线服）。
