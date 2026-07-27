/**
 * skin-relay — 原版 BDS 前的 Bedrock 协议 MITM，旁路写出玩家头像 PNG
 *
 * 详细路线见 ../docs/avatar-skin-relay.md
 *
 * 用法:
 *   SFMC_ROOT=... node tools/skin-relay/index.mjs
 *   或 npm run skin-relay -w @sfmc-bds/module-chat
 *
 * 环境变量:
 *   SFMC_ROOT          工作根（写 data/chat-avatars）
 *   SKIN_RELAY_HOST    默认 0.0.0.0
 *   SKIN_RELAY_PORT    对外端口，默认 19132
 *   SKIN_RELAY_DEST_HOST  BDS 地址，默认 127.0.0.1
 *   SKIN_RELAY_DEST_PORT  BDS 端口，默认 19131
 *   SKIN_RELAY_VERSION    协议版本字符串，须与 BDS 对齐，默认 1.21.90
 *   SKIN_RELAY_OFFLINE    设为 1 时离线模式（仅联调）
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

import { avatarDumpDir, avatarMetaPath, avatarPngPath, sanitizePlayerName } from "../skin-names.mjs";
import { cropClassicHead } from "../glyph-atlas.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveSfmcRoot() {
  if (process.env.SFMC_ROOT) return path.resolve(process.env.SFMC_ROOT);
  const guess = path.resolve(__dirname, "../../../../../ScriptsForMinecraftServer");
  if (fs.existsSync(guess)) return guess;
  return process.cwd();
}

function rgbaToPng(width, height, rgba /* Buffer|Uint8Array */) {
  const png = new PNG({ width, height });
  Buffer.from(rgba).copy(png.data, 0, 0, Math.min(png.data.length, rgba.length));
  return PNG.sync.write(png);
}

/**
 * 从 login 包 params 尽力提取皮肤（字段随 bedrock-protocol 版本变化）
 * @returns {{ name: string, xuid?: string, png: Buffer } | null}
 */
function extractFromLoginParams(params) {
  if (!params || typeof params !== "object") return null;

  // 常见：client 身份
  const name =
    params.username ||
    params.displayName ||
    params.thirdparty_name ||
    params.ThirdPartyName ||
    params.player_name ||
    null;

  let xuid = params.xuid || params.XUID || undefined;

  // skin 可能在 params.skin / params.SkinData / identityData
  const skin = params.skin || params.SkinData || params.client_data || params;
  let width = Number(skin.SkinImageWidth ?? skin.skinImageWidth ?? skin.width ?? 0);
  let height = Number(skin.SkinImageHeight ?? skin.skinImageHeight ?? skin.height ?? 0);
  let raw = skin.SkinData ?? skin.skin_data ?? skin.skinData ?? skin.imageData ?? null;

  if (typeof raw === "string") {
    try {
      raw = Buffer.from(raw, "base64");
    } catch {
      raw = null;
    }
  }
  if (!Buffer.isBuffer(raw) && raw && raw.type === "Buffer" && Array.isArray(raw.data)) {
    raw = Buffer.from(raw.data);
  }

  if (!name || !raw || !width || !height) {
    return null;
  }

  // 期望 RGBA
  const expected = width * height * 4;
  if (raw.length < expected) {
    // 有的实现是 RGB
    if (raw.length >= width * height * 3) {
      const rgba = Buffer.alloc(expected);
      for (let i = 0, j = 0; i < width * height; i++, j += 3) {
        rgba[i * 4] = raw[j];
        rgba[i * 4 + 1] = raw[j + 1];
        rgba[i * 4 + 2] = raw[j + 2];
        rgba[i * 4 + 3] = 255;
      }
      raw = rgba;
    } else {
      return null;
    }
  }

  let fullPng = rgbaToPng(width, height, raw.subarray(0, expected));
  try {
    fullPng = cropClassicHead(fullPng);
  } catch {
    /* keep full */
  }

  return { name: String(name), xuid: xuid ? String(xuid) : undefined, png: fullPng };
}

function writeDump(sfmcRoot, extracted) {
  const dir = avatarDumpDir(sfmcRoot);
  fs.mkdirSync(dir, { recursive: true });
  const pngPath = avatarPngPath(sfmcRoot, extracted.name);
  const metaPath = avatarMetaPath(sfmcRoot, extracted.name);
  const hash = crypto.createHash("sha256").update(extracted.png).digest("hex");
  fs.writeFileSync(pngPath, extracted.png);
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        name: extracted.name,
        safeName: sanitizePlayerName(extracted.name),
        ...(extracted.xuid ? { xuid: extracted.xuid } : {}),
        skinHash: hash,
        dumpedAt: new Date().toISOString(),
        source: "skin-relay",
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`[skin-relay] dump ${sanitizePlayerName(extracted.name)} hash=${hash.slice(0, 8)}…`);
}

async function main() {
  const sfmcRoot = resolveSfmcRoot();
  const host = process.env.SKIN_RELAY_HOST || "0.0.0.0";
  const port = Number(process.env.SKIN_RELAY_PORT || 19132);
  const destHost = process.env.SKIN_RELAY_DEST_HOST || "127.0.0.1";
  const destPort = Number(process.env.SKIN_RELAY_DEST_PORT || 19131);
  const version = process.env.SKIN_RELAY_VERSION || "1.21.90";
  const offline = process.env.SKIN_RELAY_OFFLINE === "1";

  console.log(`[skin-relay] SFMC_ROOT=${sfmcRoot}`);
  console.log(`[skin-relay] listen ${host}:${port} → ${destHost}:${destPort} version=${version} offline=${offline}`);
  console.log(`[skin-relay] dump → ${avatarDumpDir(sfmcRoot)}`);
  console.log("[skin-relay] 详见 packages/chat/docs/avatar-skin-relay.md");

  let Relay;
  try {
    ({ Relay } = await import("bedrock-protocol"));
  } catch (err) {
    console.error(
      "[skin-relay] 需要依赖 bedrock-protocol。请在 packages/chat 执行: npm install bedrock-protocol pngjs"
    );
    console.error(err.message);
    process.exit(1);
  }

  const relay = new Relay({
    version,
    host,
    port,
    ...(offline ? { offline: true } : {}),
    destination: {
      host: destHost,
      port: destPort,
    },
  });

  relay.on("connect", (player) => {
    const addr = player?.connection?.address ?? "?";
    console.log(`[skin-relay] connect ${addr}`);

    player.on("serverbound", ({ name, params }) => {
      // 包名随版本可能是 login / player_skin 等
      if (name !== "login" && name !== "player_skin" && name !== "client_to_server_handshake") {
        // 仍尝试从任意带 SkinData 的包提取
        if (!params || (!params.skin && !params.SkinData && !params.SkinImageWidth)) return;
      }
      if (name !== "login" && name !== "player_skin") return;

      try {
        const extracted = extractFromLoginParams(params);
        if (!extracted) {
          console.warn(`[skin-relay] ${name}: could not parse skin (schema may differ — check protocol version)`);
          return;
        }
        writeDump(sfmcRoot, extracted);
      } catch (err) {
        console.warn(`[skin-relay] extract failed: ${err.message}`);
      }
    });
  });

  relay.listen();
  console.log("[skin-relay] listening");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
