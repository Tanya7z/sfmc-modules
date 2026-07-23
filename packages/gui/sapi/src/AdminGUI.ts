import { Player } from "@minecraft/server";
import { setCreativeChainEnabled } from "@sfmc-bds/module-area";
import { HttpDB } from "@sfmc-bds/sdk/sapi/runtime";
import { ConfigManager } from "@sfmc-bds/sdk/module-loader";
import { MenuNavigator, obsBool, type Page } from "@sfmc-bds/sdk/sapi/runtime";
import { ListFormInfo, Msg } from "@sfmc-bds/sdk/sapi/runtime";

const MODULES = [
  "fly",
  "creative",
  "survival",
  "peace",
  "inventory_switcher",
  "afk",
  "clean",
  "qa",
  "chat",
  "coop",
  "land",
  "money",
  "tps",
  "online_time",
  "activity_log",
  "scoreboard_sync",
  "spawn_protect",
  "chat_sounds",
];

export class AdminGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.nav.section("main", "管理面板", (p: Page) => this.buildMain(p));
  }

  static show(player: Player): void {
    new AdminGUI(player).nav.start("main");
  }

  private buildMain(page: Page): void {
    page.label(ListFormInfo(["模块开关"]));
    for (const name of MODULES) {
      const toggle = obsBool(ConfigManager.isEnabled(name));
      toggle.subscribe((val: boolean) => {
        if (val !== ConfigManager.isEnabled(name)) this.onToggle(name, val);
      });
      page.toggle(name, toggle);
    }
  }

  private async onToggle(name: string, val: boolean): Promise<void> {
    const ok = val
      ? await HttpDB.post(`/api/sfmc/modules/${name}/enable`, {})
      : await HttpDB.post(`/api/sfmc/modules/${name}/disable`, {});
    if (!ok) {
      Msg.error(`${name} 修改失败`, this.player);
      return;
    }
    await ConfigManager.refreshModules();
    AdminGUI.applyRuntimeState(name, val);
    Msg.success(`${name} 已${val ? "启用" : "禁用"}`, this.player);
  }

  private static applyRuntimeState(name: string, enabled: boolean): void {
    // peace 由 area features 配置控制,无本地 enable;creative/survival 共用连锁开关
    if (name === "creative" || name === "survival") {
      setCreativeChainEnabled(enabled);
    }
  }
}
