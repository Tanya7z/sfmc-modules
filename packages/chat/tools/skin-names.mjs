/**
 * 玩家名 → 安全文件名（与 docs/avatar-dump-contract.md 一致）
 */
import path from "node:path";

export function sanitizePlayerName(name) {
  let s = String(name ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
  if (!s) s = "unknown";
  if (s.length > 64) s = s.slice(0, 64);
  return s;
}

export function avatarDumpDir(sfmcRoot) {
  return path.join(String(sfmcRoot).replace(/[\\/]+$/, ""), "data", "chat-avatars");
}

export function avatarPngPath(sfmcRoot, playerName) {
  return path.join(avatarDumpDir(sfmcRoot), `${sanitizePlayerName(playerName)}.png`);
}

export function avatarMetaPath(sfmcRoot, playerName) {
  return path.join(avatarDumpDir(sfmcRoot), `${sanitizePlayerName(playerName)}.meta.json`);
}
