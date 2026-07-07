// Acid-test regressions for bin/eap-install.mjs + bin/lib/settings.mjs.
//
// Each test is written to FAIL against the pre-fix installer and PASS after the
// robustness fixes ported from the TLDR installer. Run: node --test tests/acid.test.mjs
//
// Covered (finding -> test):
//   1 BLOCKER  — a settings.json / .mcp.json whose JSON root is a non-object
//                (bare string / array) is left byte-for-byte untouched and
//                skipped with "is not a JSON object" — never a crash, never a
//                false "registered"/"wired". A non-array `hooks` field is
//                handled without a TypeError.
//   2 BLOCKER  — an orphan eap-signal BEGIN marker no longer swallows the user
//                text below it on the 2nd install (nearest-preceding pairing).
//   3 MAJOR    — an end-before-begin marker sequence makes install idempotent
//                (no unbounded growth) rather than appending a block every run.
//   4 MAJOR    — two complete blocks collapse to one on install, and BOTH are
//                removed on uninstall (not just the first).
//   5 MAJOR    — a read-only rules dir fails that ONE agent gracefully; the
//                remaining agents in the run are still processed.
//   6 MINOR    — a BOM-prefixed valid settings.json parses and gets hooks wired.
//   7 MINOR    — an opencode.jsonc keeps all data through the merge; the comment
//                loss is surfaced honestly (comments/formatting normalized).
//   8 NIT      — uninstall removes the empty {} settings.json / .mcp.json stub
//                the installer itself created.
//   9 NIT      — Claude's global .mcp.json registers eap-context WITHOUT a
//                pinned project-root arg (defaults to runtime cwd).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BIN = join(here, '..', 'bin', 'eap-install.mjs');

const SIGNAL_BEGIN = '<!-- eap-signal:begin -->';
const SIGNAL_END = '<!-- eap-signal:end -->';

function mkTmp(tag) { return mkdtempSync(join(tmpdir(), `eap-acid-${tag}-`)); }
// env is REQUIRED to be a sandbox; if a caller ever omits it, fall back to a
// module-level sandbox HOME rather than inheriting the real machine's env — a
// missing sandbox must never let --uninstall touch real ~/.codex etc.
function run(args, env) { return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', env: env || DEFAULT_SANDBOX_ENV }); }
const both = (r) => (r.stdout || '') + (r.stderr || '');
const countOf = (text, needle) => text.split(needle).length - 1;
// A raw Node stack trace leaking to the console = an uncaught throw aborted the run.
const STACK = /\n\s+at .+:\d+:\d+/;

// Full sandbox: every config root the installer/uninstaller touches is redirected
// into a throwaway HOME, and PATH is neutralized to a minimal system path so the
// real agent CLIs (codex/grok/hermes/claude) are never invoked.
function sandboxEnv(home, extra = {}) {
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, 'xdg'),
    HERMES_HOME: join(home, 'hermes'),
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    PATH: '/usr/bin:/bin',
    NO_COLOR: '1',
    ...extra,
  };
}

// Default sandbox env used when a run() call omits its own (belt-and-suspenders).
const DEFAULT_SANDBOX_ENV = sandboxEnv(mkdtempSync(join(tmpdir(), 'eap-acid-default-')));

// A Claude install pinned to a config-dir, fully sandboxed. Returns { dir, env }.
function claudeSandbox(tag) {
  const home = mkTmp(tag);
  const dir = join(home, 'cfg');
  mkdirSync(dir, { recursive: true });
  return { home, dir, env: sandboxEnv(home) };
}

// ── FINDING 1: non-object JSON roots ─────────────────────────────────────────
for (const [label, contents] of [
  ['a JSON array', '[1, 2, 3]\n'],
  ['a bare JSON string', '"just a string"\n'],
]) {
  test(`FIX1: settings.json that is ${label} is left untouched and skipped, no crash / no false wire`, () => {
    const { home, dir, env } = claudeSandbox('nonobj-set');
    try {
      const settings = join(dir, 'settings.json');
      writeFileSync(settings, contents);
      const r = run(['--only', 'claude', '--config-dir', dir, '--no-runtime', '--no-context', '--non-interactive', '--no-color'], env);
      const out = both(r);
      assert.doesNotMatch(out, STACK, 'a raw stack trace leaked (uncaught throw)');
      assert.notEqual(r.status, 2);
      assert.match(out, /is not a JSON object/, 'missing the graceful skip message');
      assert.doesNotMatch(out, /Hooks wired/, 'falsely reported hooks wired');
      assert.equal(readFileSync(settings, 'utf8'), contents, 'non-object settings.json was mutated');
    } finally { rmSync(home, { recursive: true, force: true }); }
  });
}

test('FIX1: .mcp.json that is a JSON array is left untouched and skipped, no crash / no false register', () => {
  const { home, dir, env } = claudeSandbox('nonobj-mcp');
  try {
    const mcp = join(dir, '.mcp.json');
    const contents = '[1, 2, 3]\n';
    writeFileSync(mcp, contents);
    // config-dir pinned -> file mechanism (never `claude mcp add`); runtime+context on.
    const r = run(['--only', 'claude', '--config-dir', dir, '--non-interactive', '--no-color'], env);
    const out = both(r);
    assert.doesNotMatch(out, STACK, 'a raw stack trace leaked');
    assert.notEqual(r.status, 2);
    assert.match(out, /is not a JSON object/, 'missing the graceful skip message');
    assert.doesNotMatch(out, /MCP registered in/, 'falsely reported MCP registered');
    assert.equal(readFileSync(mcp, 'utf8'), contents, 'non-object .mcp.json was mutated');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('FIX1: settings.json whose `hooks` field is a non-array is wired without a TypeError crash', () => {
  const { home, dir, env } = claudeSandbox('nonarr-hooks');
  try {
    const settings = join(dir, 'settings.json');
    writeFileSync(settings, JSON.stringify({ hooks: 'surprise', theme: 'dark' }, null, 2) + '\n');
    const r = run(['--only', 'claude', '--config-dir', dir, '--no-runtime', '--no-context', '--non-interactive', '--no-color'], env);
    const out = both(r);
    assert.doesNotMatch(out, STACK, 'a raw stack trace leaked (TypeError on the string hooks field)');
    assert.equal(r.status, 0, out);
    assert.match(out, /Hooks wired/, 'hooks were not wired');
    const parsed = JSON.parse(readFileSync(settings, 'utf8'));
    assert.equal(parsed.theme, 'dark', 'sibling key lost');
    assert.ok(parsed.hooks && parsed.hooks.SessionStart, 'hooks map not created');
    assert.match(JSON.stringify(parsed.hooks), /eap-dispatch/, 'eap-dispatch hook missing');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── FINDING 2: orphan BEGIN must not eat the user text below it ───────────────
test('FIX2: an orphan eap-signal BEGIN keeps the user text below it across a 2nd install', () => {
  const { home, dir, env } = claudeSandbox('orphan-begin');
  try {
    const md = join(dir, 'CLAUDE.md');
    writeFileSync(md, `TOP LINE\n${SIGNAL_BEGIN}\nORPHAN USER BODY\n`);
    const flags = ['--only', 'claude', '--config-dir', dir, '--no-runtime', '--no-context', '--non-interactive', '--no-color'];

    assert.equal(run(flags, env).status, 0);
    // Install appended a real block -> two BEGIN markers now (orphan + real).
    assert.equal(countOf(readFileSync(md, 'utf8'), SIGNAL_BEGIN), 2, 'setup: expected two BEGIN markers after 1st install');

    assert.equal(run(flags, env).status, 0);            // 2nd install
    const after = readFileSync(md, 'utf8');
    assert.ok(after.includes('ORPHAN USER BODY'), 'user text below the orphan BEGIN was destroyed');
    assert.ok(after.includes('TOP LINE'), 'leading user text was destroyed');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── FINDING 3: end-before-begin must be idempotent (no unbounded growth) ──────
test('FIX3: an end-before-begin marker sequence makes install idempotent (no unbounded growth)', () => {
  const { home, dir, env } = claudeSandbox('ebb');
  try {
    const md = join(dir, 'CLAUDE.md');
    writeFileSync(md, `USER A\n${SIGNAL_END}\nUSER B\n${SIGNAL_BEGIN}\nUSER C\n`);
    const flags = ['--only', 'claude', '--config-dir', dir, '--no-runtime', '--no-context', '--non-interactive', '--no-color'];

    assert.equal(run(flags, env).status, 0);
    const b1 = countOf(readFileSync(md, 'utf8'), SIGNAL_BEGIN);
    assert.equal(run(flags, env).status, 0);
    const t2 = readFileSync(md, 'utf8');
    assert.equal(run(flags, env).status, 0);
    const t3 = readFileSync(md, 'utf8');

    assert.equal(t2, t3, 'reinstall keeps appending a fresh block (not idempotent)');
    assert.equal(countOf(t3, SIGNAL_BEGIN), b1, 'BEGIN markers grew across reinstalls');
    assert.ok(t3.includes('USER A') && t3.includes('USER B') && t3.includes('USER C'), 'user text lost');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── FINDING 4: two complete blocks -> collapse on install, both stripped on rm ─
test('FIX4: two complete blocks collapse to one on install and both are removed on uninstall', () => {
  const { home, dir, env } = claudeSandbox('twoblock');
  try {
    const md = join(dir, 'CLAUDE.md');
    const two = `HEAD USER\n${SIGNAL_BEGIN}\nOLD ONE\n${SIGNAL_END}\nMID USER\n${SIGNAL_BEGIN}\nOLD TWO\n${SIGNAL_END}\nTAIL USER\n`;
    const flags = ['--only', 'claude', '--config-dir', dir, '--no-runtime', '--no-context', '--non-interactive', '--no-color'];

    // Install collapses the two blocks into one refreshed block.
    writeFileSync(md, two);
    assert.equal(run(flags, env).status, 0);
    const after = readFileSync(md, 'utf8');
    assert.equal(countOf(after, SIGNAL_BEGIN), 1, 'blocks were not collapsed to one');
    assert.ok(!after.includes('OLD ONE') && !after.includes('OLD TWO'), 'a stale block survived install');
    assert.ok(after.includes('HEAD USER') && after.includes('MID USER') && after.includes('TAIL USER'), 'user text lost on install');

    // Uninstall from a fresh two-block file must strip BOTH blocks.
    writeFileSync(md, two);
    assert.equal(run(['--uninstall', '--config-dir', dir, '--non-interactive', '--no-color'], env).status, 0);
    const stripped = readFileSync(md, 'utf8');
    assert.equal(countOf(stripped, SIGNAL_BEGIN), 0, 'a BEGIN marker survived uninstall');
    assert.equal(countOf(stripped, SIGNAL_END), 0, 'an END marker survived uninstall');
    assert.ok(stripped.includes('HEAD USER') && stripped.includes('MID USER') && stripped.includes('TAIL USER'), 'user text lost on uninstall');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── FINDING 5: read-only rules dir fails one agent, not the whole run ─────────
test('FIX5: a read-only rules dir fails that agent gracefully; the next agent is still processed', () => {
  const home = mkTmp('readonly');
  const env = sandboxEnv(home);
  const codexDir = join(home, '.codex');
  try {
    // codex is processed before grok in the roster. Make codex's rules dir
    // read-only so atomicWrite's mkdtempSync throws EACCES for codex only.
    mkdirSync(codexDir, { recursive: true });
    chmodSync(codexDir, 0o500);

    const r = run(['--only', 'codex,grok', '--non-interactive', '--no-color'], env);
    const out = both(r);
    assert.doesNotMatch(out, STACK, 'a raw stack trace aborted the multi-agent run');
    assert.notEqual(r.status, 2);
    assert.match(out, /codex/, 'codex failure not reported');
    assert.match(out, /failed/i, 'no failure recorded for the unwritable agent');

    // grok comes AFTER codex — it must still have been processed and written.
    const grokRules = join(home, '.grok', 'AGENTS.md');
    assert.ok(existsSync(grokRules), 'the next agent (grok) was skipped after codex aborted');
    assert.match(readFileSync(grokRules, 'utf8'), /eap-signal:begin/, 'grok Signal block not written');
  } finally {
    try { chmodSync(codexDir, 0o700); } catch { /* best effort */ }
    rmSync(home, { recursive: true, force: true });
  }
});

// ── FINDING 6: BOM-prefixed valid settings.json wires ────────────────────────
test('FIX6: a BOM-prefixed settings.json parses and gets hooks wired', () => {
  const { home, dir, env } = claudeSandbox('bom');
  try {
    const settings = join(dir, 'settings.json');
    writeFileSync(settings, '﻿{"theme":"dark"}\n');
    const r = run(['--only', 'claude', '--config-dir', dir, '--no-runtime', '--no-context', '--non-interactive', '--no-color'], env);
    const out = both(r);
    assert.doesNotMatch(out, /unparseable/, 'BOM-prefixed valid JSON treated as unparseable');
    assert.match(out, /Hooks wired/, 'hooks were not wired');
    const parsed = JSON.parse(readFileSync(settings, 'utf8'));
    assert.equal(parsed.theme, 'dark', 'existing key lost');
    assert.ok(parsed.hooks && parsed.hooks.SessionStart, 'SessionStart hook not added');
    assert.match(JSON.stringify(parsed.hooks), /eap-dispatch/, 'eap-dispatch hook missing');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── FINDING 7: opencode.jsonc data survives; comment loss surfaced honestly ──
test('FIX7: opencode.jsonc keeps all data through the merge and the comment drop is surfaced', () => {
  const home = mkTmp('jsonc');
  const env = sandboxEnv(home);
  try {
    const file = join(env.XDG_CONFIG_HOME, 'opencode', 'opencode.jsonc');
    mkdirSync(dirname(file), { recursive: true });
    const seed = '// opencode config — this comment will be normalized away on rewrite\n' +
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        plugin: ['some-plugin'],
        mcp: { 'other-server': { type: 'local', command: ['echo', 'hi'], enabled: true } },
      }, null, 2) + '\n';
    writeFileSync(file, seed);

    const r = run(['--only', 'opencode', '--non-interactive', '--no-color'], env);
    assert.equal(r.status, 0, both(r));
    // Honest note that the JSONC rewrite normalizes (drops) comments.
    assert.match(both(r), /normalized/i, 'the comment-drop was not surfaced');

    const cfg = JSON.parse(readFileSync(file, 'utf8'));
    assert.ok(cfg.mcp['eap-runtime'] && cfg.mcp['eap-context'], 'eap servers not merged');
    assert.ok(cfg.mcp['other-server'], 'pre-existing server lost');
    assert.equal(cfg.$schema, 'https://opencode.ai/config.json', '$schema data lost');
    assert.deepEqual(cfg.plugin, ['some-plugin'], 'plugin array data lost');
    // The comment is gone (acknowledged) — data is what must survive, not the comment.
    assert.ok(!readFileSync(file, 'utf8').includes('normalized away on rewrite'), 'comment unexpectedly retained');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── FINDING 8: uninstall removes the empty {} stubs the installer created ─────
test('FIX8: uninstall removes the empty settings.json / .mcp.json stubs the installer created', () => {
  const { home, dir, env } = claudeSandbox('empty-stub');
  try {
    // Fresh config-dir: no pre-existing settings.json / .mcp.json (installer creates them).
    assert.equal(run(['--only', 'claude', '--config-dir', dir, '--non-interactive', '--no-color'], env).status, 0);
    assert.ok(existsSync(join(dir, 'settings.json')) && existsSync(join(dir, '.mcp.json')), 'setup: install did not create the stubs');

    assert.equal(run(['--uninstall', '--config-dir', dir, '--non-interactive', '--no-color'], env).status, 0);
    assert.ok(!existsSync(join(dir, '.mcp.json')), 'installer-created empty .mcp.json left behind');
    assert.ok(!existsSync(join(dir, 'settings.json')), 'installer-created empty settings.json left behind');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

// ── FINDING 9: Claude .mcp.json eap-context has no pinned project-root arg ────
test('FIX9: Claude .mcp.json registers eap-context with no pinned project-root arg', () => {
  const { home, dir, env } = claudeSandbox('no-pinned-root');
  try {
    assert.equal(run(['--only', 'claude', '--config-dir', dir, '--non-interactive', '--no-color'], env).status, 0);
    const servers = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8')).mcpServers;
    assert.match(servers['eap-context'].args[0], /eap_context\/mcp\.py$/, 'eap-context entrypoint wrong');
    assert.equal(servers['eap-context'].args.length, 1, 'eap-context should NOT carry a pinned project-root arg');
  } finally { rmSync(home, { recursive: true, force: true }); }
});
