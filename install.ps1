# GLM Coding Plan statusline 手动安装脚本(Windows PowerShell,不走插件系统时用)
# 前置:已安装 Node.js(>= 16)。在仓库根目录运行,或设置 $env:GLM_STATUSLINE_REPO 后任意位置运行。
$ErrorActionPreference = 'Stop'

$Repo = if ($env:GLM_STATUSLINE_REPO) { $env:GLM_STATUSLINE_REPO } else { 'Kisukizen/glm-claude-statusline' }
$Branch = if ($env:GLM_STATUSLINE_BRANCH) { $env:GLM_STATUSLINE_BRANCH } else { 'main' }
$Dest = Join-Path $env:USERPROFILE '.claude\glm-statusline.mjs'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw '未找到 node,请先安装 Node.js (https://nodejs.org)'
}

New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null

if (Test-Path 'plugins/glm-statusline/scripts/statusline.mjs') {
  # 从本地仓库安装
  Copy-Item 'plugins/glm-statusline/scripts/statusline.mjs' $Dest -Force
  node 'plugins/glm-statusline/scripts/setup-statusline.mjs' --force --script $Dest
} else {
  # 从 GitHub 下载安装
  Write-Host "从 github.com/$Repo 下载..."
  Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/$Repo/$Branch/plugins/glm-statusline/scripts/statusline.mjs" -OutFile $Dest
  $setup = Join-Path $env:TEMP 'glm-setup-statusline.mjs'
  Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/$Repo/$Branch/plugins/glm-statusline/scripts/setup-statusline.mjs" -OutFile $setup
  node $setup --force --script $Dest
}

Write-Host '完成。重启 Claude Code 会话后状态栏生效。'
