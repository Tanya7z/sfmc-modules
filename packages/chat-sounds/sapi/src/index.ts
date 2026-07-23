/**
 * @sfmc-bds/module-chat-sounds — v2 入口
 *
 * 与 afk / spawn-protect 同型:ModuleRegistry.register + 零 SDK drawer。
 * 监听 world.beforeEvents.chatSend,关键词命中后给所有玩家放音效,带 200 tick 冷却。
 */

import { ChatSendBeforeEvent, GameMode, system, world } from "@minecraft/server";
import { debug } from "@sfmc-bds/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";

const MODULE_ID = "feature-chat-sounds";

const KEYWORDS: Record<string, string> = {
  ciallo: "cs.ciallo",
  咕咕嘎嘎: "cs.gugugaga",
  汩汩咕: "cs.gugugu",
  baka: "cs.baka",
  yee: "cs.yee",
  干嘛: "mob.chicken.hurt",
  huh: "cs.huh",
};

const COOLDOWN_TICKS = 200;

const cooldownMap: Record<string, boolean> = {};
// SAPI 的 event.subscribe 返回回调本身,退订需 event.unsubscribe(cb)
let chatCb: ((event: ChatSendBeforeEvent) => void) | undefined;

function playSoundForAll(soundId: string): void {
  system.run(() => {
    for (const p of world.getAllPlayers()) {
      try {
        p.playSound(soundId);
      } catch {
        /* ignore */
      }
    }
  });
}

function matchesKeyword(message: string): string | undefined {
  const lower = message.toLowerCase();
  for (const k in KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return KEYWORDS[k];
  }
  return undefined;
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      // 无对外命令 / 权限
    },
    async init() {
      chatCb = world.beforeEvents.chatSend.subscribe((event) => {
        const soundId = matchesKeyword(event.message);
        if (!soundId) return;

        const sender = event.sender;
        if (sender.getGameMode() !== GameMode.Creative) {
          const id = sender.id;
          if (cooldownMap[id]) return;
          cooldownMap[id] = true;
          system.runTimeout(() => {
            delete cooldownMap[id];
          }, COOLDOWN_TICKS);
        }

        playSoundForAll(soundId);
      });
      debug.i("ChatSounds", `init: subscribed (${Object.keys(KEYWORDS).length} keywords)`);
    },
    cleanup() {
      try {
        if (chatCb) world.beforeEvents.chatSend.unsubscribe(chatCb);
      } catch {
        /* ignore */
      }
      chatCb = undefined;
    },
  },
});
