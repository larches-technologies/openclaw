import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(repoRoot, "scripts/xai-image-private-network-patch.sh");
const installedPackage = "/home/charles/.nvm/versions/node/v24.15.0/lib/node_modules/openclaw";
const fixtureRoots: string[] = [];

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "openclaw-xai-patch-test-"));
  fixtureRoots.push(root);
  const targetDir = join(root, "dist/extensions/xai");
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(installedPackage, "package.json"), join(root, "package.json"));
  const target = join(targetDir, "image-generation-provider-fixture.js");
  cpSync(join(installedPackage, "dist/image-generation-provider-B5ZbLVCx.js"), target);
  return { root, target };
}

function run(root: string, ...args: string[]) {
  return spawnSync(script, args, {
    encoding: "utf8",
    env: { ...process.env, OPENCLAW_PACKAGE_DIR: root },
  });
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("xAI image private-network bundle patch", () => {
  it("patches and restores a nested xAI bundle idempotently", () => {
    const { root, target } = makeFixture();
    const original = readFileSync(target, "utf8");

    const before = run(root, "--check");
    expect(before.status).toBe(1);
    expect(before.stdout).toContain("patchable:");

    const apply = run(root);
    expect(apply.status).toBe(0);
    expect(apply.stdout).toContain("patched:");
    expect(readFileSync(target, "utf8")).toContain("useConfiguredRequest: true");
    const backups = [
      ...new Set(
        apply.stdout
          .split("\n")
          .filter((line) => line.startsWith("backup: "))
          .map((line) => line.slice("backup: ".length)),
      ),
    ];
    expect(backups).toHaveLength(1);
    expect(existsSync(backups[0] ?? "")).toBe(true);

    const secondApply = run(root);
    expect(secondApply.status).toBe(0);
    expect(secondApply.stdout).toContain("already patched:");

    const afterPatch = run(root, "--check");
    expect(afterPatch.status).toBe(0);
    expect(afterPatch.stdout).toContain("patched:");

    const restore = run(root, "--restore");
    expect(restore.status).toBe(0);
    expect(restore.stdout).toContain("restored:");
    expect(readFileSync(target, "utf8")).toBe(original);

    const afterRestore = run(root, "--check");
    expect(afterRestore.status).toBe(1);
    expect(afterRestore.stdout).toContain("patchable:");
  });

  it("refuses an unknown bundle shape without creating a backup", () => {
    const { root, target } = makeFixture();
    writeFileSync(
      target,
      "export const XAI_BASE_URL = 'x';\nfunction resolveXaiImageBaseUrl() {}\n",
    );

    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unknown xAI bundle shape");
    expect(existsSync(`${target}.xai-image-private-network.bak`)).toBe(false);
  });
});
