/**
 * types.ts — 计分板备份数据模型（scoreboard-sync 模块权威）
 *
 * ScoreboardIdentityType 是 @minecraft/server 枚举；此处用 number，
 * SAPI 使用处可收窄到枚举。
 */

/** 0 = invalid, 1 = player, 2 = entity, 3 = fake */
export type ScoreboardIdentityTypeNumber = 0 | 1 | 2 | 3 | number;

export interface Participant {
  id: number;
  type: ScoreboardIdentityTypeNumber;
  name: string;
  score: number;
}

export interface ScoreboardEntry {
  id: string;
  displayName: string;
  participants?: Participant[];
}
