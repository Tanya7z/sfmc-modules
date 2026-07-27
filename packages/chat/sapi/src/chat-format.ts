/**
 * 频道聊天行格式化（单一权威，DRY）
 * 头像 glyph + 频道前缀 + 名 + 内容
 */

export type ChatLineStyle = "channel" | "broadcast" | "private";

export interface FormatChatLineOpts {
  /** 自定义字形字符；空则不加头像 */
  glyph?: string;
  channelPrefix: string;
  name: string;
  content: string;
  style?: ChatLineStyle;
}

/** 组装一条可 sendMessage 的聊天行（含 § 色码） */
export function formatChatLine(opts: FormatChatLineOpts): string {
  const style = opts.style ?? "channel";
  const glyph = opts.glyph ?? "";
  const head = glyph ? `${glyph}` : "";

  if (style === "private") {
    return `${head}§d[私信] §f${opts.name}: ${opts.content}`;
  }
  if (style === "broadcast") {
    return `${head}§a[${opts.channelPrefix}] ${opts.name}: ${opts.content}`;
  }
  return `${head}§b[${opts.channelPrefix}] §f${opts.name}: ${opts.content}`;
}

/** 给内容加上定位/传送/红包等类型标签（与历史逻辑一致） */
export function decorateMessageContent(type: string, content: string): string {
  switch (type) {
    case "location":
      return `§a[定位] ${content}`;
    case "teleport_invite":
      return `§e[传送邀请] ${content}`;
    case "redpacket":
      return `§6[红包] ${content}`;
    default:
      return content;
  }
}
