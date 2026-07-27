/**
 * glyph_E9 atlas：16×16 格，每格默认 16px（整图 256×256）
 * 依赖 pngjs（chat package 声明）
 */
import fs from "node:fs";
import { PNG } from "pngjs";

export const GLYPH_PAGE = 0xe9;
export const GRID = 16;
export const DEFAULT_CELL = 16;

/**
 * @param {string} filePath
 * @returns {{ png: import('pngjs').PNG, cell: number }}
 */
export function loadAtlas(filePath) {
  const buf = fs.readFileSync(filePath);
  const png = PNG.sync.read(buf);
  const cell = Math.floor(png.width / GRID);
  if (cell < 8 || png.width !== png.height || png.width % GRID !== 0) {
    throw new Error(`invalid glyph atlas size ${png.width}x${png.height}`);
  }
  return { png, cell };
}

/**
 * 将头像 PNG（任意尺寸）写入槽位 slot（0..255）
 * @param {import('pngjs').PNG} atlas
 * @param {number} cell
 * @param {number} slot
 * @param {Buffer} headPngBuf
 */
export function blitHeadToSlot(atlas, cell, slot, headPngBuf) {
  if (slot < 0 || slot > 255) throw new Error(`slot out of range: ${slot}`);
  const head = PNG.sync.read(headPngBuf);
  const col = slot % GRID;
  const row = Math.floor(slot / GRID);
  const ox = col * cell;
  const oy = row * cell;

  for (let y = 0; y < cell; y++) {
    for (let x = 0; x < cell; x++) {
      const sx = Math.min(head.width - 1, Math.floor((x / cell) * head.width));
      const sy = Math.min(head.height - 1, Math.floor((y / cell) * head.height));
      const si = (sy * head.width + sx) << 2;
      const di = ((oy + y) * atlas.width + (ox + x)) << 2;
      atlas.data[di] = head.data[si];
      atlas.data[di + 1] = head.data[si + 1];
      atlas.data[di + 2] = head.data[si + 2];
      atlas.data[di + 3] = head.data[si + 3];
    }
  }
}

/**
 * @param {import('pngjs').PNG} atlas
 * @param {string} filePath
 */
export function saveAtlas(atlas, filePath) {
  fs.writeFileSync(filePath, PNG.sync.write(atlas));
}

/** 从完整皮肤 PNG 裁经典头（脸+帽）；非 64 宽则整图缩小返回 */
export function cropClassicHead(skinPngBuf) {
  const skin = PNG.sync.read(skinPngBuf);
  if (skin.width < 64 || skin.height < 32) {
    return skinPngBuf;
  }
  const out = new PNG({ width: 8, height: 8 });
  const copyPx = (sx, sy, dx, dy, overlay) => {
    const si = (sy * skin.width + sx) << 2;
    const di = (dy * 8 + dx) << 2;
    const a = skin.data[si + 3];
    if (overlay && a < 10) return;
    out.data[di] = skin.data[si];
    out.data[di + 1] = skin.data[si + 1];
    out.data[di + 2] = skin.data[si + 2];
    out.data[di + 3] = 255;
  };
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      copyPx(8 + x, 8 + y, x, y, false);
      copyPx(40 + x, 8 + y, x, y, true);
    }
  }
  return PNG.sync.write(out);
}
