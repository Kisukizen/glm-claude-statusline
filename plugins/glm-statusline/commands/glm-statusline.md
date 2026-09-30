---
description: 安装或修复 GLM 状态栏(写入 statusLine 配置)
---

请执行命令 `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup-statusline.mjs" --force`(用 Bash 工具),它会把本插件的 statusLine 注册进用户级 `~/.claude/settings.json` 并输出结果。

执行后:
- 如果输出"已注册 statusLine",告诉用户重启 Claude Code 会话(或新开会话)后底部状态栏生效。
- 如果报错,把 stderr 里的错误信息原样转告用户,不要自行修改 settings.json。
