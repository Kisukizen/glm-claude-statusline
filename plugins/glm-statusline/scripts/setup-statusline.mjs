#!/usr/bin/env node
/**
 * 在用户级 settings.json 里注册/移除 statusLine 配置。
 *
 * 用法:
 *   node setup-statusline.mjs                 # statusLine 缺失或已指向本插件时写入(插件 SessionStart hook 用)
 *   node setup-statusline.mjs --force         # 覆盖任何已存在的 statusLine(/glm-statusline 命令、手动安装用)
 *   node setup-statusline.mjs --remove        # 移除本插件写入的 statusLine(卸载用)
 *   node setup-statusline.mjs --script <路径>  # 指定 statusline 脚本位置(install.sh/install.ps1 用)
 *
 * 说明:Claude Code 插件系统目前不能在 plugin.json 里声明 statusLine
 * (https://github.com/anthropics/claude-code/issues/11498),
 * 所以用 SessionStart hook 首次启动时把配置写进 ~/.claude/settings.json,幂等。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const force = args.includes('--force');
const remove = args.includes('--remove');
const scriptIdx = args.indexOf('--script');
const scriptArg = scriptIdx !== -1 ? args[scriptIdx + 1] : null;

// hook 模式(无参数运行)下任何失败都静默退出,避免干扰会话启动
const hookMode = args.length === 0 && process.env.CLAUDE_PLUGIN_ROOT;
const log = (msg) => process.stderr.write(`[glm-statusline] ${msg}\n`);

const settingsFile = path.join(os.homedir(), '.claude', 'settings.json');
const scriptPath =
  scriptArg || path.join(path.dirname(fileURLToPath(import.meta.url)), 'statusline.mjs');

// 状态栏命令里带这个标记,用于识别"是我们写的",避免覆盖用户自己的状态栏
const MARKER = 'glm-statusline';

const run = () => {
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch {}

  const current = settings.statusLine?.command || '';
  const expected = `node "${scriptPath}"`;

  if (remove) {
    if (current.includes(MARKER) || !current) {
      delete settings.statusLine;
      save(settings, fs.existsSync(settingsFile));
      log('已移除 statusLine 配置');
    } else {
      log('当前 statusLine 不是本插件写入的,未改动');
    }
    return;
  }

  if (current === expected) return; // 已注册且路径一致,幂等退出

  if (current && !current.includes(MARKER) && !force) {
    log('已存在其他 statusLine 配置,跳过(用 --force 覆盖)');
    return;
  }

  settings.statusLine = {
    type: 'command',
    // 引号包裹路径,兼容路径带空格;Windows 下 Git Bash 也不会吃掉反斜杠
    command: expected,
  };
  save(settings, fs.existsSync(settingsFile));
  log(`已注册 statusLine → node "${scriptPath}"`);
};

function save(settings, fileExisted) {
  try {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    if (fileExisted && fs.existsSync(settingsFile)) {
      fs.copyFileSync(settingsFile, `${settingsFile}.bak-glm-statusline`);
    }
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  } catch (e) {
    throw new Error(`写入 settings.json 失败: ${e.message}`);
  }
}

try {
  run();
} catch (e) {
  log(e.message);
  if (!hookMode) process.exit(1);
}
