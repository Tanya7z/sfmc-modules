#!/usr/bin/env bash
# new.sh — 兼容入口；实际逻辑在 tools/new-module.mjs（跨平台）
#
# 用法: ./tools/new.sh my-mod [显示名]
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$DIR/tools/new-module.mjs" "$@"
