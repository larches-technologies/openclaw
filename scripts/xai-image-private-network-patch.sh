#!/usr/bin/env bash
# Temporary, fail-closed hotfix for released bundles that hard-code xAI image
# private-network access to false. It intentionally does not edit config or
# start/restart OpenClaw.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: xai-image-private-network-patch.sh [--check | --restore]

Patches the installed OpenClaw xAI image-provider bundle so it consumes
models.providers.xai.request (including allowPrivateNetwork).

Set OPENCLAW_PACKAGE_DIR to the installed OpenClaw package directory. If it is
unset, the script attempts to resolve the executable package entry and walks up
to a directory containing package.json and dist/.

  --check    Inspect only. Exit 0 only when already patched.
  --restore  Restore the newest timestamped backup beside the discovered bundle.

This script does not enable the setting, edit OpenClaw config, or restart a
service. Configure the provider separately, for example:
  models.providers.xai.baseUrl = "http://localhost:8317/v1"
  models.providers.xai.request.allowPrivateNetwork = true
EOF
}

mode=apply
case "$#" in
  0) ;;
  1)
    case "$1" in
      --check) mode=check ;;
      --restore) mode=restore ;;
      -h|--help) usage; exit 0 ;;
      *) usage >&2; exit 64 ;;
    esac
    ;;
  *) usage >&2; exit 64 ;;
esac

package_dir="${OPENCLAW_PACKAGE_DIR:-}"
if [[ -z "$package_dir" ]]; then
  package_dir="$(node - <<'NODE'
const { existsSync } = require("node:fs");
const { dirname, join } = require("node:path");
let current;
try {
  current = dirname(require.resolve("openclaw"));
} catch {
  process.exit(1);
}
while (dirname(current) !== current) {
  if (existsSync(join(current, "package.json")) && existsSync(join(current, "dist"))) {
    process.stdout.write(current);
    process.exit(0);
  }
  current = dirname(current);
}
process.exit(1);
NODE
)" || {
    echo "error: could not discover an OpenClaw package; set OPENCLAW_PACKAGE_DIR explicitly" >&2
    exit 1
  }
fi

if [[ ! -f "$package_dir/package.json" || ! -d "$package_dir/dist" ]]; then
  echo "error: OPENCLAW_PACKAGE_DIR is not an OpenClaw package with dist/: $package_dir" >&2
  exit 1
fi

node --input-type=module - "$mode" "$package_dir" <<'NODE'
import { copyFileSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const [mode, packageDir] = process.argv.slice(2);
const distDir = join(packageDir, "dist");
const original = /resolveBaseUrl:\s*\(\{\s*req\s*\}\)\s*=>\s*resolveXaiImageBaseUrl\(req\),\s*resolveAllowPrivateNetwork:\s*\(\)\s*=>\s*false,\s*(?=defaultTimeoutMs:)/;
const patched = /resolveBaseUrl:\s*\(\{\s*req\s*\}\)\s*=>\s*resolveXaiImageBaseUrl\(req\),\s*useConfiguredRequest:\s*true,\s*(?=defaultTimeoutMs:)/;
const backupSuffix = /\.xai-image-private-network\.bak\.\d{8}T\d{6}Z$/;

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const candidates = files(distDir).filter((path) => {
  const name = basename(path);
  if (!/^image-generation-provider(?:-[A-Za-z0-9_-]+)?\.js$/.test(name)) return false;
  const source = readFileSync(path, "utf8");
  return source.includes("resolveXaiImageBaseUrl") && source.includes("XAI_BASE_URL");
});
if (candidates.length !== 1) {
  console.error(`error: expected exactly one xAI image-provider bundle, found ${candidates.length}`);
  for (const path of candidates) console.error(`  ${path}`);
  process.exit(1);
}

const target = candidates[0];
const targetDir = dirname(target);
const source = readFileSync(target, "utf8");
const originalCount = (source.match(new RegExp(original.source, "g")) ?? []).length;
const patchedCount = (source.match(new RegExp(patched.source, "g")) ?? []).length;
if (originalCount + patchedCount !== 1) {
  console.error(`error: unknown xAI bundle shape; refusing to modify ${target}`);
  process.exit(1);
}

if (mode === "check") {
  console.log(`${patchedCount === 1 ? "patched" : "patchable"}: ${target}`);
  process.exit(patchedCount === 1 ? 0 : 1);
}

if (mode === "restore") {
  const backups = readdirSync(targetDir)
    .filter((name) => name.startsWith(`${basename(target)}.xai-image-private-network.bak.`) && backupSuffix.test(name))
    .sort();
  if (backups.length === 0) {
    console.error(`error: no timestamped backup found for ${target}`);
    process.exit(1);
  }
  const backup = join(targetDir, backups.at(-1));
  const backupSource = readFileSync(backup, "utf8");
  if ((backupSource.match(new RegExp(original.source, "g")) ?? []).length !== 1 || patched.test(backupSource)) {
    console.error(`error: newest backup does not contain the exact expected pre-patch code: ${backup}`);
    process.exit(1);
  }
  const restoreTemp = `${target}.xai-image-private-network.restore.${process.pid}`;
  try {
    copyFileSync(backup, restoreTemp);
    renameSync(restoreTemp, target);
  } finally {
    try {
      unlinkSync(restoreTemp);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  console.log(`restored: ${target} <- ${backup}`);
  process.exit(0);
}

if (patchedCount === 1) {
  console.log(`already patched: ${target}`);
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const backup = `${target}.xai-image-private-network.bak.${timestamp}`;
const replacement = "resolveBaseUrl: ({ req }) => resolveXaiImageBaseUrl(req),\n\t\tuseConfiguredRequest: true,\n\t\t";
const next = source.replace(original, replacement);
if (next === source || (next.match(new RegExp(patched.source, "g")) ?? []).length !== 1) {
  console.error(`error: replacement validation failed; original left at ${target}`);
  process.exit(1);
}
copyFileSync(target, backup);
const patchTemp = `${target}.xai-image-private-network.patch.${process.pid}`;
try {
  writeFileSync(patchTemp, next);
  renameSync(patchTemp, target);
} finally {
  try {
    unlinkSync(patchTemp);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
console.log(`patched: ${target}`);
console.log(`backup: ${backup}`);
NODE
