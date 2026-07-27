/**
 * bake-avatars.mjs — 读 data/chat-avatars + chat_avatars 表，拼 glyph_E9，packs bump
 *
 * 用法（在 packages/chat 或仓库根）:
 *   node tools/bake-avatars.mjs
 *   node tools/bake-avatars.mjs --dry-run
 *   SFMC_ROOT=... node tools/bake-avatars.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { fetchHeadPng } from "./skin-provider.mjs";
import { blitHeadToSlot, cropClassicHead, loadAtlas, saveAtlas } from "./glyph-atlas.mjs";
import { avatarDumpDir } from "./skin-names.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const AVATAR_RP = path.join(PKG_ROOT, "avatar-rp");
const MODULE_ID = "feature-chat";
const RP_UUID = "a7c3e91f-4b2d-4e8a-9f01-8c2d4e6f0a1b";
const DRY = process.argv.includes("--dry-run");

function resolveSfmcRoot() {
  if (process.env.SFMC_ROOT) return path.resolve(process.env.SFMC_ROOT);
  // 旁路：sfmc-modules/packages/chat → 上三级到 MCBEProjects，再找 ScriptsForMinecraftServer
  const candidates = [
    path.resolve(PKG_ROOT, "../../../ScriptsForMinecraftServer"),
    path.resolve(PKG_ROOT, "../../.."),
    process.cwd(),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "configs")) || fs.existsSync(path.join(c, "data"))) {
      const runtime = path.join(c, "configs", "runtime.json");
      if (fs.existsSync(runtime)) {
        try {
          const j = JSON.parse(fs.readFileSync(runtime, "utf8"));
          if (j.sfmc_root) return path.resolve(j.sfmc_root);
        } catch {
          /* ignore */
        }
      }
      return c;
    }
  }
  return process.cwd();
}

function loadDbPort(sfmcRoot) {
  const cfg = path.join(sfmcRoot, "configs", "db_config.json");
  if (!fs.existsSync(cfg)) return 3001;
  try {
    const j = JSON.parse(fs.readFileSync(cfg, "utf8"));
    return Number(j.db_port) || 3001;
  } catch {
    return 3001;
  }
}

function loadModuleToken(sfmcRoot) {
  const f = path.join(sfmcRoot, "data", "module-tokens.json");
  if (!fs.existsSync(f)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    return j.tokens?.[MODULE_ID] ?? null;
  } catch {
    return null;
  }
}

async function dbPost(port, token, apiPath, body) {
  const url = `http://127.0.0.1:${port}${apiPath}${apiPath.includes("?") ? "&" : "?"}moduleId=${encodeURIComponent(MODULE_ID)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`db ${apiPath} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`db ${apiPath} HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const sfmcRoot = resolveSfmcRoot();
  const dumpDir = avatarDumpDir(sfmcRoot);
  const port = loadDbPort(sfmcRoot);
  const token = loadModuleToken(sfmcRoot);

  console.log(`[bake-avatars] SFMC_ROOT=${sfmcRoot}`);
  console.log(`[bake-avatars] dump=${dumpDir}`);
  console.log(`[bake-avatars] db=:${port} token=${token ? "yes" : "no"} dry=${DRY}`);

  const atlasSrc = path.join(AVATAR_RP, "font", "glyph_E9.png");
  if (!fs.existsSync(atlasSrc)) {
    console.error(`[bake-avatars] missing ${atlasSrc}`);
    process.exit(1);
  }

  /** @type {Array<{ player_id: string, player_name: string, slot: number, skin_hash?: string, dirty?: number }>} */
  let rows = [];
  if (token) {
    try {
      const q = await dbPost(port, token, "/api/sfmc/db/query", {
        table: "chat_avatars",
        opts: { limit: 512 },
      });
      rows = q.rows ?? [];
    } catch (err) {
      console.warn(`[bake-avatars] DB query failed (will scan dump dir only): ${err.message}`);
    }
  } else {
    console.warn("[bake-avatars] no module token — skip DB; scan dump PNGs only (no slot map)");
  }

  const { png: atlas, cell } = loadAtlas(atlasSrc);
  let changed = 0;

  // 无 DB 行时：扫描 dump 目录 + 本地 slots.json（便于手塞/冒烟）
  if (rows.length === 0 && fs.existsSync(dumpDir)) {
    rows = loadRowsFromDumpDir(sfmcRoot, dumpDir);
    if (rows.length) console.log(`[bake-avatars] dump-scan: ${rows.length} png(s)`);
  }

  for (const row of rows) {
    const name = String(row.player_name ?? "");
    const slot = Number(row.slot);
    if (!name || !Number.isFinite(slot) || slot < 1) continue;

    const head = await fetchHeadPng(sfmcRoot, { name });
    if (!head) {
      if (row.dirty) console.log(`[bake-avatars] skip ${name}: no dump PNG`);
      continue;
    }
    if (row.skin_hash && row.skin_hash === head.hash && !row.dirty) continue;

    let headBuf = head.png;
    try {
      // 若是完整皮肤则裁头
      headBuf = cropClassicHead(head.png);
    } catch {
      headBuf = head.png;
    }

    blitHeadToSlot(atlas, cell, slot, headBuf);
    changed++;
    console.log(`[bake-avatars] slot ${slot} ← ${name}`);

    if (!DRY && token) {
      try {
        await dbPost(port, token, "/api/sfmc/db/update", {
          table: "chat_avatars",
          id: row.player_id,
          patch: { skin_hash: head.hash, dirty: 0, updated_at: Date.now() },
        });
      } catch (err) {
        console.warn(`[bake-avatars] update row failed: ${err.message}`);
      }
    }
  }

  if (changed === 0) {
    console.log("[bake-avatars] no changes");
    return;
  }

  if (DRY) {
    console.log(`[bake-avatars] dry-run: would write ${changed} slot(s)`);
    return;
  }

  saveAtlas(atlas, atlasSrc);
  console.log(`[bake-avatars] wrote ${atlasSrc}`);

  // 尝试就地更新已装 RP + bump；否则拷到 packs inbox
  await deployAndBump(sfmcRoot, atlasSrc);
}

function loadRowsFromDumpDir(sfmcRoot, dumpDir) {
  const slotsFile = path.join(dumpDir, "slots.json");
  /** @type {Record<string, number>} */
  let nameToSlot = {};
  if (fs.existsSync(slotsFile)) {
    try {
      nameToSlot = JSON.parse(fs.readFileSync(slotsFile, "utf8")).slots ?? {};
    } catch {
      nameToSlot = {};
    }
  }
  const pngs = fs.readdirSync(dumpDir).filter((f) => f.endsWith(".png"));
  let next = 1;
  const used = new Set(Object.values(nameToSlot).map(Number));
  const alloc = () => {
    while (used.has(next) && next <= 255) next++;
    const s = next <= 255 ? next : 1;
    used.add(s);
    next = s + 1;
    return s;
  };
  /** @type {Array<{ player_id: string, player_name: string, slot: number, dirty: number }>} */
  const out = [];
  let dirtySlots = false;
  for (const f of pngs) {
    const name = f.replace(/\.png$/i, "");
    let slot = nameToSlot[name];
    if (!slot || slot < 1) {
      slot = alloc();
      nameToSlot[name] = slot;
      dirtySlots = true;
    }
    out.push({
      player_id: `dump:${name}`,
      player_name: name,
      slot,
      dirty: 1,
    });
  }
  if (dirtySlots && !DRY) {
    fs.mkdirSync(dumpDir, { recursive: true });
    fs.writeFileSync(slotsFile, JSON.stringify({ slots: nameToSlot }, null, 2), "utf8");
  }
  return out;
}

async function deployAndBump(sfmcRoot, atlasSrc) {
  const require = createRequire(import.meta.url);
  let worldPacks;
  try {
    // 从旁路平台解析 bds-tools
    const platformRoot = resolveSfmcRoot();
    const wp = path.join(platformRoot, "bds-tools", "dist", "world-packs.js");
    if (fs.existsSync(wp)) {
      worldPacks = await import(pathToFileUrl(wp));
    } else {
      worldPacks = require("@sfmc-bds/bds-tools/world-packs");
    }
  } catch (err) {
    console.warn(`[bake-avatars] bds-tools unavailable: ${err.message}`);
    copyToInbox(sfmcRoot);
    return;
  }

  const bdsRoot = resolveBdsRoot(sfmcRoot);
  const levelName = resolveLevelName(sfmcRoot);
  if (!bdsRoot || !levelName) {
    console.warn("[bake-avatars] cannot resolve bdsRoot/level — copy to packs inbox");
    copyToInbox(sfmcRoot);
    return;
  }

  const packs = worldPacks.listInstalledWorldPacks(bdsRoot, levelName);
  const installed = packs.find((p) => p.uuid === RP_UUID && p.kind === "resource");
  if (installed) {
    const destFont = path.join(installed.dir, "font");
    fs.mkdirSync(destFont, { recursive: true });
    fs.copyFileSync(atlasSrc, path.join(destFont, "glyph_E9.png"));
    const next = worldPacks.bumpPackPatchVersion(installed.dir);
    if (installed.enabled) {
      await worldPacks.enableInstalledPack({
        bdsRoot,
        levelName,
        info: {
          name: installed.name,
          uuid: installed.uuid,
          version: next,
          kind: "resource",
        },
      });
    }
    console.log(`[bake-avatars] bumped ${installed.folderName} → ${next.join(".")} (restart BDS + rejoin)`);
    return;
  }

  copyToInbox(sfmcRoot);
  console.log("[bake-avatars] RP not installed — copied avatar-rp to packs/; run: sfmc packs scan");
}

function pathToFileUrl(p) {
  const u = path.resolve(p).replace(/\\/g, "/");
  return u.startsWith("/") ? `file://${u}` : `file:///${u}`;
}

function copyToInbox(sfmcRoot) {
  const inbox = path.join(sfmcRoot, "packs");
  const dest = path.join(inbox, "sfmc-chat-avatars");
  fs.mkdirSync(inbox, { recursive: true });
  fs.cpSync(AVATAR_RP, dest, { recursive: true });
}

function resolveBdsRoot(sfmcRoot) {
  const runtime = path.join(sfmcRoot, "configs", "runtime.json");
  if (fs.existsSync(runtime)) {
    try {
      const j = JSON.parse(fs.readFileSync(runtime, "utf8"));
      if (j.bds_root) return j.bds_root;
      if (j.bdsRoot) return j.bdsRoot;
    } catch {
      /* ignore */
    }
  }
  const props = path.join(sfmcRoot, "server.properties");
  // 常见：SFMC_ROOT 即含 bedrock 的目录
  if (fs.existsSync(path.join(sfmcRoot, "bedrock_server.exe"))) return sfmcRoot;
  return null;
}

function resolveLevelName(sfmcRoot) {
  const runtime = path.join(sfmcRoot, "configs", "runtime.json");
  if (fs.existsSync(runtime)) {
    try {
      const j = JSON.parse(fs.readFileSync(runtime, "utf8"));
      if (j.level_name) return j.level_name;
      if (j.levelName) return j.levelName;
    } catch {
      /* ignore */
    }
  }
  const props = path.join(sfmcRoot, "server.properties");
  if (fs.existsSync(props)) {
    const m = fs.readFileSync(props, "utf8").match(/level-name\s*=\s*(.+)/);
    if (m) return m[1].trim();
  }
  return "Bedrock level";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
