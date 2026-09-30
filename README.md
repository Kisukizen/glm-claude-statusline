# glm-statusline

给 [Claude Code](https://code.claude.com/) 用的状态栏,面向 **GLM Coding Plan**(智谱 BigModel / Z.ai)用户:

```
GLM-5.3 │ myproject │ ctx [██░░░░░░░░░] 8.0% (15.5k/200.0k) │ in 15.5k out 1.2k │ 5h 12%↓48m · 周 27%↓31h
```

一段一段分别是:

| 段 | 含义 |
|---|---|
| `GLM-5.3` | 当前模型 |
| `myproject` | 当前目录名 |
| `ctx [██░░░░░░░░░] 8.0% (15.5k/200.0k)` | 上下文窗口占用进度条、百分比、已用/总量 token |
| `in 15.5k out 1.2k` | 本次会话累计输入/输出 token |
| `5h 12%↓48m` | GLM 套餐 5 小时窗口已用百分比、距重置时间 |
| `周 27%↓31h` | GLM 套餐每周额度已用百分比、距重置时间 |

百分比进度条按占用变色:<50% 绿色,<80% 黄色,≥80% 红色。上下文超过 200k 时追加 `⚠ >200k` 警告。

额度数据来自智谱官方只读监控接口 `/api/monitor/usage/quota/limit`(接口路径参考 [zai-org/zai-coding-plugins](https://github.com/zai-org/zai-coding-plugins) 的 glm-plan-usage 插件),**只读查询、不消耗套餐额度**,默认缓存 2 分钟。

## 前置要求

- Node.js ≥ 16(脚本纯 Node,无任何依赖)
- Claude Code 通过 GLM 的 Anthropic 兼容接口使用,即已配置:
  - `ANTHROPIC_AUTH_TOKEN` — GLM Coding Plan 的 API Key
  - `ANTHROPIC_BASE_URL` — `https://open.bigmodel.cn/api/anthropic`(国内)或 `https://api.z.ai/api/anthropic`(国际)

  这两个变量放在 `~/.claude/settings.json` 的 `env` 里即可,状态栏会自动读取(也支持系统环境变量)。

## 安装

### 方式一:插件(推荐,跨机器)

```text
> /plugin marketplace add Kisukizen/glm-claude-statusline
> /plugin install glm-statusline@glm-statusline
```

安装后重启会话,插件的 SessionStart hook 会自动把 statusLine 注册进 `~/.claude/settings.json`(已存在其他状态栏时不会覆盖,可在会话里输入 `/glm-statusline` 强制接管)。

> 把 `OWNER` 换成你的 GitHub 用户名。本仓库默认按 `Kisukizen/glm-claude-statusline` 配置,如果你的用户名不同,见下方"推送到 GitHub"。

### 方式二:一键脚本(不走插件系统)

macOS / Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/Kisukizen/glm-claude-statusline/main/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/Kisukizen/glm-claude-statusline/main/install.ps1 | iex
```

脚本会把状态栏脚本复制到 `~/.claude/glm-statusline.mjs` 并写入 settings.json(改动前自动备份为 `settings.json.bak-glm-statusline`)。

### 方式三:手动

1. 复制 `plugins/glm-statusline/scripts/statusline.mjs` 到 `~/.claude/glm-statusline.mjs`
2. 在 `~/.claude/settings.json` 加:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"C:/Users/你/.claude/glm-statusline.mjs\""
  }
}
```

(macOS/Linux 路径换成 `/home/你/.claude/glm-statusline.mjs`)

## 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `GLM_STATUSLINE_TTL_MS` | `120000` | 额度查询缓存时长(毫秒) |
| `GLM_STATUSLINE_NO_QUOTA` | — | 置 `1` 隐藏额度部分(离线/隐私场景) |

额度缓存在 `~/.claude/cache/glm-statusline.json`,删掉即可强制刷新。

## 卸载

- 插件方式:`/plugin uninstall glm-statusline@glm-statusline`,然后运行 `node <插件目录>/scripts/setup-statusline.mjs --remove` 清掉 statusLine 配置
- 手动方式:删除 `~/.claude/settings.json` 里的 `statusLine` 字段和 `~/.claude/glm-statusline.mjs`

## 多系统说明

状态栏脚本为单个无依赖 Node 文件,Windows / macOS / Linux 通用;路径处理不依赖 bash,Windows 原生与 Git Bash 环境均可。额度接口在国内站(open.bigmodel.cn)和国际站(api.z.ai)之间按 `ANTHROPIC_BASE_URL` 自动切换。

## 推送到 GitHub(仓库作者)

1. 仓库已按 `Kisukizen/glm-claude-statusline` 配置;如果你的 GitHub 用户名不是 `Kisukizen`,先全局替换 `Kisukizen` 为你的用户名(涉及 `.claude-plugin/marketplace.json`、`plugins/glm-statusline/.claude-plugin/plugin.json`、`install.sh`、`install.ps1`、本文件)
2. GitHub 上新建仓库 `glm-claude-statusline`,推送 main 分支:
   ```sh
   git remote add origin git@github.com:你的用户名/glm-claude-statusline.git
   git push -u origin main
   ```
3. 其他机器上按"方式一"两行命令即可安装

## 说明

- 插件系统目前不支持在 `plugin.json` 里直接声明 statusLine([anthropics/claude-code#11498](https://github.com/anthropics/claude-code/issues/11498)),所以用 SessionStart hook 首次启动时自动写配置,幂等、可 `--remove` 清理。
- token 只会发往 `ANTHROPIC_BASE_URL` 所在域名,不会发给任何第三方。

## License

MIT
