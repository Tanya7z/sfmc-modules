/**
 * types.ts — 玩家 / 世界快照数据模型（data-backup 模块权威）
 */

export interface PlayerData {
  id: string;
  name: string;
  permission?: number;

  clientSystemInfoLocal?: string;
  clientSystemInfoMaxRenderDistance?: number;
  clientSystemInfoMemoryTierLevel?: string;
  clientSystemInfoPlatformType?: string;
  graphicsMode?: string;
  dynamicPropertyTotalByteCount?: number;
  ping?: number;

  level?: number;
  spawnPoint?: string;
  tags?: string;
  totalXp?: number;

  afkStep?: number;
  afkLastLocation?: { x: number; y: number; z: number };

  onlineSession?: number;
  onlineToday?: number;
  onlineMonth?: number;
  onlineTotal?: number;
  onlineLastDate?: number;
  onlineLastMonth?: number;

  activeChannel?: string;

  updatedAt: string;
}

export interface WorldData {
  allowCheats: boolean;
  gameRules: string;
  seed: string;
  defaultSpawnLocation: string;
  difficulty: string;

  day: number;
  tickingAreasCount: number;
  absoluteTime: number;
  structuresFromAddon: string;
  structuresFromWorld: string;
  dynamicPropertyTotalByteCount: number;
  moonPhase: number;

  updatedAt: string;
}
