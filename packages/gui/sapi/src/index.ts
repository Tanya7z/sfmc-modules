/**
 * @sfmc-bds/module-gui — v2 入口
 *
 * 主菜单 / 管理面板 / 货币 GUI。ChatGUI 来自 @sfmc-bds/module-chat；LandGUI 来自 @sfmc-bds/module-land;
 * 合作社图形 UI 已并入 feature-coop（包目录 coop）命令面(/coop)。
 */

import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Permission, debug } from "@sfmc-bds/sdk/sapi/runtime";

import { MainMenu } from "./MainMenu.js";
import { MoneyGUI } from "./MoneyGUI.js";

const MODULE_ID = "core-gui";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("menu.use", Permission.Any);
      Permission.register("money.admin", Permission.Admin);
    },
    registerCommands() {
      MainMenu.registerMenuCommand();
      MoneyGUI.registerCommand();
    },
    async init() {
      debug.i("GUI", "core-gui init");
    },
    cleanup() {
      debug.i("GUI", "core-gui cleanup");
    },
  },
});

export { AdminGUI } from "./AdminGUI.js";
export { MainMenu } from "./MainMenu.js";
export { MoneyGUI } from "./MoneyGUI.js";
