/**
 * LocalDumpSkinProvider — 从 data/chat-avatars 读头像 PNG
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { avatarMetaPath, avatarPngPath } from "./skin-names.mjs";

/**
 * @param {string} sfmcRoot
 * @param {{ name: string }} player
 * @returns {Promise<{ png: Buffer, hash: string } | null>}
 */
export async function fetchHeadPng(sfmcRoot, player) {
  const pngPath = avatarPngPath(sfmcRoot, player.name);
  if (!fs.existsSync(pngPath)) return null;
  const png = fs.readFileSync(pngPath);
  let hash = crypto.createHash("sha256").update(png).digest("hex");
  const metaPath = avatarMetaPath(sfmcRoot, player.name);
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (typeof meta.skinHash === "string" && meta.skinHash) hash = meta.skinHash;
    } catch {
      /* ignore */
    }
  }
  return { png, hash };
}
