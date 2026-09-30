#!/bin/sh
# GLM Coding Plan statusline 手动安装脚本(不走插件系统时用)
# 前置:已安装 Node.js(>= 16)。在仓库根目录运行,或设置 GLM_STATUSLINE_REPO 后任意位置运行。
set -e

REPO="${GLM_STATUSLINE_REPO:-Kisukizen/glm-claude-statusline}"
BRANCH="${GLM_STATUSLINE_BRANCH:-main}"
DEST="$HOME/.claude/glm-statusline.mjs"

command -v node >/dev/null 2>&1 || {
  echo "错误: 未找到 node,请先安装 Node.js (https://nodejs.org)" >&2
  exit 1
}

mkdir -p "$HOME/.claude"

if [ -f "plugins/glm-statusline/scripts/statusline.mjs" ]; then
  # 从本地仓库安装
  cp plugins/glm-statusline/scripts/statusline.mjs "$DEST"
  node plugins/glm-statusline/scripts/setup-statusline.mjs --force --script "$DEST"
else
  # 从 GitHub 下载安装
  echo "从 github.com/$REPO 下载..."
  curl -fsSL "https://raw.githubusercontent.com/$REPO/$BRANCH/plugins/glm-statusline/scripts/statusline.mjs" -o "$DEST"
  SETUP="$(mktemp glm-setup.XXXXXX.mjs)"
  trap 'rm -f "$SETUP"' EXIT
  curl -fsSL "https://raw.githubusercontent.com/$REPO/$BRANCH/plugins/glm-statusline/scripts/setup-statusline.mjs" -o "$SETUP"
  node "$SETUP" --force --script "$DEST"
fi

echo "完成。重启 Claude Code 会话后状态栏生效。"
