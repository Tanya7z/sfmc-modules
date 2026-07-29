# sfmc-modules

SFMC 官方模块源

> 业务源码归档见：
>
> - 分支 `archive/monorepo-packages`
> - 标签 `archive/packages-2026-07-29`

## index.json（v2）

```json
{
  "version": 2,
  "modules": {
    "economy": {
      "npm": "@sfmc-bds/module-economy",
      "version": "1.0.0",
      "sdk": ">=0.2.0"
    },
    "afk": {
      "repo": "Tanya7z/sfmc-modules",
      "tag": "modules-v0.4.0"
    }
  }
}
```

| 字段              | 说明                                                    |
| ----------------- | ------------------------------------------------------- |
| `npm` + `version` | **推荐**。平台 `mod install <id>` 走 `npm:`             |
| `repo` + `tag`    | **deprecated**。旧 GitHub Release zip，迁移完成前可保留 |

## 如何登记

1. 模块仓执行 `sfmc mod publish`（或 CI release），用 `--gh-push` 自动开 PR；或
2. 手工改 `index.json` 开 PR：

```json
"my-mod": {
  "npm": "@alice/sfmc-module-my-mod",
  "version": "0.1.0",
  "sdk": ">=0.2.0"
}
```

## 相关

- 平台：[ScriptsForMinecraftServer](https://github.com/Shiroha7z/ScriptsForMinecraftServer)
- 作者指南：平台仓 `docs/dev/module-author.md`
- 模板：[sfmc-module-template](https://github.com/Tanya7z/sfmc-module-template)

## 许可证

ISC
