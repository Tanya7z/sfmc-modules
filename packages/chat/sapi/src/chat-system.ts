import { ChatSendBeforeEvent, Player, PlayerJoinAfterEvent, system, world } from "@minecraft/server";
import { Command, debug, registerSystemMsgHandler } from "@sfmc-bds/sdk/sapi/runtime";
import { ConfigManager } from "@sfmc-bds/sdk/module-loader";
import { db } from "@sfmc-bds/sdk/sapi/db";

import { ChatGUI } from "./chat-gui.js";
import { DogeChat } from "./doge-chat.js";

export class ChatSystem {
  // SAPI 的 event.subscribe 返回回调本身，退订需 event.unsubscribe(cb)
  private static chatSendCb: ((event: ChatSendBeforeEvent) => void) | undefined = undefined;
  private static playerJoinCb: ((event: PlayerJoinAfterEvent) => void) | undefined = undefined;

  static init() {
    debug.i("CHAT", "init");
    void DogeChat.ensureDefaultChannels();

    // 用一次轻量 query 探测 db 可达,替代 HttpDB.checkHealth
    void db
      .query("sfmc_chat_channels", { limit: 1 })
      .then(() => console.info("[DogeChat] 外部数据库已连接，消息将持久化存储。"))
      .catch(() => console.warn("[DogeChat] 外部数据库未连接。"));

    registerSystemMsgHandler((player: Player, text: string) => {
      DogeChat.sendSystemMessage(player, text);
    });

    // bridge_channel_id 属于跨切面 settings(qq_config 回落),走既有 ConfigManager.getSetting
    const bridgeChannelId = ConfigManager.getSetting("bridge_channel_id", "");
    if (bridgeChannelId) {
      DogeChat.startBridgePolling(bridgeChannelId);
    }

    debug.i("CHAT", "ChatSystem initialized");
  }

  static registerEvents() {
    ChatSystem.chatSendCb = world.beforeEvents.chatSend.subscribe(async (event) => {
      const player = event.sender;
      const message = event.message;
      if (message.startsWith("!") || message.startsWith("！")) return;

      event.cancel = true;
      const channel = await DogeChat.getActiveChannel(player);
      if (channel) await DogeChat.sendChannelMessage(player, channel.id, message);
    });

    ChatSystem.playerJoinCb = world.afterEvents.playerJoin.subscribe((event) => {
      const player = world.getEntity(event.playerId) as Player;
      system.run(async () => {
        await DogeChat.loadSubscriptions(player);
        const channel = await DogeChat.getActiveChannel(player);
        if (channel) await DogeChat.loadChannelHistory(player, channel.id);
      });
    });
  }

  static cleanup() {
    debug.i("CHAT", "cleanup");
    try {
      if (ChatSystem.chatSendCb) {
        world.beforeEvents.chatSend.unsubscribe(ChatSystem.chatSendCb);
      }
    } catch {
      /* ignore */
    }
    try {
      if (ChatSystem.playerJoinCb) {
        world.afterEvents.playerJoin.unsubscribe(ChatSystem.playerJoinCb);
      }
    } catch {
      /* ignore */
    }
    ChatSystem.chatSendCb = undefined;
    ChatSystem.playerJoinCb = undefined;
    try {
      DogeChat.stopBridgePolling?.();
    } catch {
      /* ignore */
    }
  }

  static registerCommands() {
    Command.register(
      "channel",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.openChannelPanel(player);
      },
      "频道管理 - 订阅/切换频道",
      "chat"
    );

    Command.register(
      "ch",
      "chat.use",
      async (player: Player | undefined) => {
        if (!player) return;
        const next = await DogeChat.cycleChannel(player);
        if (next) await DogeChat.loadChannelHistory(player, next.id);
      },
      "快速切换频道",
      "chat"
    );

    Command.register(
      "msg",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.openPrivateChatPanel(player);
      },
      "快捷私聊",
      "chat"
    );

    Command.register(
      "lo",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.sendLocation(player);
      },
      "发送当前位置到当前频道",
      "chat"
    );

    Command.register(
      "tp",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.sendTeleportInvite(player);
      },
      "发送传送邀请",
      "chat"
    );

    Command.register(
      "hongbao",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.openRedPacketPanel(player);
      },
      "红包 - 查看/领取红包",
      "chat"
    );

    Command.register(
      "hb",
      "chat.use",
      (player: Player | undefined) => {
        if (player) void ChatGUI.sendRedPacketQuick(player);
      },
      "发送红包",
      "chat"
    );
  }
}
