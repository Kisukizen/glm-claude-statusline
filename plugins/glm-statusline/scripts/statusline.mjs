#!/usr/bin/env node
/**
 * GLM Coding Plan statusline for Claude Code
 *
 * Claude Code 把会话状态 JSON 通过 stdin 传入,stdout 首行渲染为底部状态栏。
 * 文档: https://code.claude.com/docs/en/statusline
 *
 * 显示内容:
 *   模型 │ 当前目录 │ 上下文窗口进度条(百分比/已用/总量) │ 会话输入输出 token │ GLM 5小时/每周额度
 *
 * GLM 额度来自智谱官方只读接口 /api/monitor/usage/quota/limit
 * (接口路径参考 zai-org/zai-coding-plugins 的 glm-plan-usage 插件),
 * 结果缓存到 ~/.claude/cache/,默认 2 分钟,避免状态栏频繁刷新打接口。
 *
 * 环境变量:
 *   ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL  未设时回退读取 ~/.claude/settings(.local).json 的 env
 *   GLM_STATUSLINE_TTL_MS   额度缓存时长,默认 120000
 *   GLM_STATUSLINE_NO_QUOTA 置 1 隐藏额度部分
 */

import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

// ---------- 基础工具 ----------

const C = {
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

const fmtK = (n) =>
  n == null || Number.isNaN(n) ? '?' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);

const heatColor = (pct) => (pct < 50 ? C.green : pct < 80 ? C.yellow : C.red);

function readClaudeEnv() {
  const merged = {};
  for (const f of ['settings.json', 'settings.local.json']) {
    try {
      const env = JSON.parse(
        fs.readFileSync(path.join(os.homedir(), '.claude', f), 'utf8'),
      ).env;
      Object.assign(merged, env || {});
    } catch {}
  }
  return merged;
}

// ---------- GLM 额度(带缓存) ----------

const CACHE_FILE = path.join(os.homedir(), '.claude', 'cache', 'glm-statusline.json');

function readCache(ttlMs) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Date.now() - c.fetchedAt < ttlMs) return c.data;
    return { stale: c.data };
  } catch {}
  return null;
}

function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt: Date.now(), data }));
  } catch {}
}

function fetchQuota() {
  const env = process.env;
  const claudeEnv = readClaudeEnv();
  const token = env.ANTHROPIC_AUTH_TOKEN || claudeEnv.ANTHROPIC_AUTH_TOKEN;
  const baseUrl = env.ANTHROPIC_BASE_URL || claudeEnv.ANTHROPIC_BASE_URL || '';
  if (!token || !baseUrl) return Promise.resolve(null);

  let origin;
  try {
    const u = new URL(baseUrl);
    if (!/bigmodel\.cn$|api\.z\.ai$|z\.ai$/.test(u.host)) return Promise.resolve(null);
    origin = u.origin;
  } catch {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const req = https.request(
      `${origin}/api/monitor/usage/quota/limit`,
      { method: 'GET', headers: { Authorization: token, 'Content-Type': 'application/json' } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve(json && json.success ? json.data : null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.setTimeout(3000, () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
}

// 观测到的额度维度:CREDIT_LIMIT unit:3 number:5 = 5 小时窗口,unit:6 number:1 = 每周
function limitLabel(l) {
  if (l.type === 'TOKENS_LIMIT') return '5h';
  if (l.type === 'TIME_LIMIT') return 'MCP月';
  const known = { '3:5': '5h', '6:1': '周' };
  return known[`${l.unit}:${l.number}`] || `${l.number}${{ 3: 'h', 6: 'w' }[l.unit] || ''}`;
}

function fmtCountdown(ms) {
  if (!ms || ms <= 0) return '';
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h`;
}

async function renderQuota() {
  if (process.env.GLM_STATUSLINE_NO_QUOTA === '1') return null;
  const ttl = Number(process.env.GLM_STATUSLINE_TTL_MS) || 120000;

  let data = readCache(ttl);
  if (data && !data.stale) return data;

  const fresh = await fetchQuota();
  if (fresh) {
    writeCache(fresh);
    return fresh;
  }
  return data ? data.stale : null; // 拉取失败时用旧数据兜底
}

// ---------- 渲染 ----------

// 异步读 stdin,带超时兜底:resume 旧会话时 Claude Code 可能不关闭输入管道,
// 同步阻塞读会永远等不到 EOF 导致状态栏空白
const readStdin = (timeoutMs = 800) =>
  new Promise((resolve) => {
    let s = '';
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => {
      try {
        process.stdin.destroy();
      } catch {}
      done(s);
    }, timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (s += c));
    process.stdin.on('end', () => done(s));
    process.stdin.on('error', () => done(s));
  });

async function main() {
  const t0 = Date.now();
  const raw = await readStdin();
  let d = {};
  try {
    d = JSON.parse(raw);
  } catch {}

  const model = d.model?.display_name || d.model?.id || 'unknown';
  const cwd = d.workspace?.current_dir || d.cwd || '';
  const dir = cwd.split(/[\\/]/).filter(Boolean).pop() || '~';

  const cw = d.context_window || {};
  const size = cw.context_window_size || 200000;
  const u = cw.current_usage || {};
  const contextTokens =
    (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const pct = Math.min(
    100,
    cw.used_percentage != null ? cw.used_percentage : (contextTokens / size) * 100,
  );

  const filled = Math.round(Math.min(100, Math.max(0, pct)) / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  const sep = ` ${C.dim}│${C.reset} `;
  const parts = [
    `${C.cyan}${model}${C.reset}`,
    `${C.dim}${dir}${C.reset}`,
    `ctx ${heatColor(pct)}[${bar}] ${pct.toFixed(1)}%${C.reset} (${fmtK(contextTokens)}/${fmtK(size)})`,
    `in ${fmtK(cw.total_input_tokens)} out ${fmtK(cw.total_output_tokens)}`,
  ];

  if (d.exceeds_200k_tokens) parts.push(`${C.red}⚠ >200k${C.reset}`);

  const quota = await renderQuota();
  if (quota?.limits?.length) {
    const segs = quota.limits.map((l) => {
      const p = Math.min(100, Math.max(0, Number(l.percentage) || 0));
      const cd = fmtCountdown(l.nextResetTime - Date.now());
      return `${heatColor(p)}${limitLabel(l)} ${p.toFixed(0)}%${cd ? `${C.dim}↓${cd}${C.reset}` : ''}${C.reset}`;
    });
    parts.push(segs.join(`${C.dim} · ${C.reset}`));
  }

  process.stdout.write(parts.join(sep) + '\n');

  // GLM_STATUSLINE_DEBUG=1 时记录每次调用,排查 resume 等场景的取证开关
  if (process.env.GLM_STATUSLINE_DEBUG === '1') {
    try {
      const dir = path.join(os.homedir(), '.claude', 'cache');
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(
        path.join(dir, 'glm-statusline-run.log'),
        `${new Date().toISOString()} bytes=${raw.length} ms=${Date.now() - t0}\n`,
      );
    } catch {}
  }
}

main().catch(() => process.exit(0));
