/**
 * 聊天头像槽位：DB 分配 + 内存缓存 → Unicode PUA glyph（glyph_E9）
 */
import type { Player } from "@minecraft/server";
import { db } from "@sfmc-bds/sdk/sapi/db";
import { debug } from "@sfmc-bds/sdk/sapi/runtime";

const TABLE = "chat_avatars";

/** 槽位 0 = 默认史蒂夫，对应 U+E900 */
export const DEFAULT_AVATAR_SLOT = 0;
export const DEFAULT_AVATAR_GLYPH = String.fromCodePoint(0xe900);

const MAX_SLOT = 255;

interface AvatarRow extends Record<string, unknown> {
  player_id?: string;
  player_name?: string;
  slot?: number;
  skin_hash?: string;
  dirty?: number;
  updated_at?: number;
}

/** playerId → glyph 字符 */
const glyphCache = new Map<string, string>();

function slotToGlyph(slot: number): string {
  const s = Math.max(0, Math.min(MAX_SLOT, Math.floor(slot)));
  return String.fromCodePoint(0xe900 + s);
}

/** 定义表（init 调用一次） */
export async function initAvatarTable(): Promise<void> {
  await db.defineTable(TABLE, {
    player_id: { type: "TEXT", primary: true },
    player_name: { type: "TEXT", default: "" },
    slot: { type: "INTEGER", default: 0 },
    skin_hash: { type: "TEXT", default: "" },
    dirty: { type: "INTEGER", default: 1 },
    updated_at: { type: "INTEGER", default: 0 },
  });
  debug.i("CHAT", "chat_avatars table ready");
}

/** 同步取缓存 glyph；未分配则默认头 */
export function getAvatarGlyph(playerId: string): string {
  return glyphCache.get(playerId) ?? DEFAULT_AVATAR_GLYPH;
}

/** 按发送者 id 取 glyph（历史消息用 fromid） */
export function getAvatarGlyphById(playerId: string | undefined): string {
  if (!playerId) return DEFAULT_AVATAR_GLYPH;
  return getAvatarGlyph(playerId);
}

/**
 * 进服确保有槽位：已有则刷新 name；新建则分配下一空闲 slot（1..255）
 */
export async function ensureAvatarSlot(player: Player): Promise<string> {
  const id = player.id;
  const name = player.name;
  const now = Date.now();

  try {
    const existing = await db.get<AvatarRow>(TABLE, id);
    if (existing && typeof existing.slot === "number") {
      const slot = existing.slot;
      const glyph = slotToGlyph(slot);
      glyphCache.set(id, glyph);
      if (existing.player_name !== name) {
        await db.update(TABLE, id, {
          player_name: name,
          dirty: 1,
          updated_at: now,
        });
      }
      return glyph;
    }

    const next = await allocateSlot();
    await db.insert(TABLE, {
      player_id: id,
      player_name: name,
      slot: next,
      skin_hash: "",
      dirty: 1,
      updated_at: now,
    });
    const glyph = slotToGlyph(next);
    glyphCache.set(id, glyph);
    debug.i("CHAT", `avatar slot ${next} → ${name}`);
    return glyph;
  } catch (err) {
    debug.e("CHAT", "ensureAvatarSlot failed", err instanceof Error ? err : new Error(String(err)));
    glyphCache.set(id, DEFAULT_AVATAR_GLYPH);
    return DEFAULT_AVATAR_GLYPH;
  }
}

/** 预热在线玩家缓存 */
export async function warmAvatarCache(player: Player): Promise<void> {
  await ensureAvatarSlot(player);
}

async function allocateSlot(): Promise<number> {
  const rows = await db.query<AvatarRow>(TABLE, { limit: 512 });
  const used = new Set<number>();
  for (const r of rows ?? []) {
    if (typeof r.slot === "number") used.add(r.slot);
  }
  for (let s = 1; s <= MAX_SLOT; s++) {
    if (!used.has(s)) return s;
  }
  // 满员：复用 1（极少见；运维应扩 glyph_EA）
  debug.w("CHAT", "avatar slots exhausted, reusing slot 1");
  return 1;
}
