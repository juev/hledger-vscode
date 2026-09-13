import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { load } from "js-yaml";

const workflow = load(readFileSync(new URL("../workflows/release.yml", import.meta.url), "utf8"));
const channels = ["marketplace", "open-vsx", "github-release"];
const steps = Object.values(workflow.jobs).flatMap(job => job.steps);

test("each publication depends only on the shared build", () => {
  for (const channel of channels) {
    const job = workflow.jobs[channel];
    assert.ok(job, `Missing independent ${channel} job`);
    assert.deepEqual([job.needs].flat(), ["build"]);
    assert.equal(job.if, undefined);
    assert.equal(job["continue-on-error"], undefined);
  }
  assert.equal(workflow.jobs.build.environment, undefined);
  assert.equal(workflow.jobs.build.permissions["id-token"], undefined);
  assert.equal(workflow.jobs.marketplace.environment, "marketplace");
  assert.equal(workflow.jobs["open-vsx"].environment, undefined);
  assert.equal(workflow.jobs["github-release"].environment, undefined);
});

test("all channels download the build artifact by its output ID, including on partial reruns", () => {
  const build = workflow.jobs.build;
  assert.ok(build, "Missing shared build");
  const upload = build.steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
  assert.ok(upload);
  assert.equal(build.outputs["artifact-id"], `\${{ steps.${upload.id}.outputs.artifact-id }}`);
  assert.ok(upload.with.name.includes("${{ github.run_attempt }}"));
  assert.equal(upload.with["if-no-files-found"], "error");
  assert.ok(upload.with["retention-days"] >= 30);
  for (const channel of channels) {
    const download = workflow.jobs[channel].steps.find(step => step.uses?.startsWith("actions/download-artifact@"));
    assert.ok(download);
    assert.equal(download.with["artifact-ids"], "${{ needs.build.outputs.artifact-id }}");
    assert.equal(download.with.name, undefined);
    assert.equal(download.with.path, "release");
  }
});

test("Open VSX remains optional when its token is absent", () => {
  const step = steps.find(step => step.name === "Publish to Open VSX");
  assert.equal(step.if, "${{ env.OVSX_PAT != '' }}");
});

test("GitHub release reruns preserve existing assets", () => {
  const step = steps.find(step => step.uses?.startsWith("softprops/action-gh-release@"));
  assert.equal(step.with.overwrite_files, false);
  assert.equal(step.with.fail_on_unmatched_files, true);
  assert.equal(step.with.body_path, "release/release-notes.md");
});

// Execute the actual workflow shell with fake CLI processes at the network boundary.
// The fake models the CLIs' --skip-duplicate contract and records every invocation.
function runPublish(stepName, outcomes) {
  const directory = mkdtempSync(join(tmpdir(), "hledger-publish-"));
  mkdirSync(join(directory, "release"));
  writeFileSync(join(directory, "release", "hledger-1.2.3.vsix"), "test package");
  writeFileSync(join(directory, "calls.json"), "[]");
  writeFileSync(join(directory, "npx"), `#!/usr/bin/env node
const fs = require('node:fs');
const calls = JSON.parse(fs.readFileSync(process.env.TEST_CALLS, 'utf8'));
const args = process.argv.slice(2);
const outcome = JSON.parse(process.env.TEST_OUTCOMES)[calls.length];
calls.push(args);
fs.writeFileSync(process.env.TEST_CALLS, JSON.stringify(calls));
if (outcome === 'success') process.exit(0);
if (outcome === 'duplicate') {
  console.log('Extension version is already published.');
  process.exit(args.includes('--skip-duplicate') ? 0 : 1);
}
console.error(outcome === 'unrelated' ? 'An unrelated resource already exists' : 'Request timeout');
process.exit(1);
`, { mode: 0o755 });
  writeFileSync(join(directory, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  try {
    const step = steps.find(candidate => candidate.name === stepName);
    assert.ok(step?.run, `Missing publish command: ${stepName}`);
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", step.run], {
      cwd: directory,
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        TEST_CALLS: join(directory, "calls.json"),
        TEST_OUTCOMES: JSON.stringify(outcomes),
      },
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.error, undefined);
    return { ...result, calls: JSON.parse(readFileSync(join(directory, "calls.json"), "utf8")) };
  } finally {
    unlinkSync(join(directory, "release", "hledger-1.2.3.vsix"));
    rmdirSync(join(directory, "release"));
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
}

for (const [name, cli] of [["Visual Studio Marketplace", "vsce"], ["Open VSX", "ovsx"]]) {
  const step = `Publish to ${name}`;
  test(`${name}: publishes the downloaded VSIX on the first attempt`, () => {
    const result = runPublish(step, ["success"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.calls.length, 1);
    assert.equal(result.calls[0][0], cli);
    assert.ok(result.calls[0].includes("./release/hledger-1.2.3.vsix"));
    assert.ok(result.calls[0].includes("--skip-duplicate"));
    if (cli === "vsce") assert.ok(result.calls[0].includes("--azure-credential"));
  });
  test(`${name}: skips an already published version on a full rerun`, () => {
    const result = runPublish(step, ["duplicate"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.calls.length, 1);
  });
  test(`${name}: retries a transient failure`, () => {
    const result = runPublish(step, ["timeout", "success"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.calls.length, 2);
  });
  test(`${name}: succeeds if a timed-out attempt actually published the version`, () => {
    const result = runPublish(step, ["timeout", "duplicate"]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.calls.length, 2);
  });
  test(`${name}: fails after three unsuccessful attempts`, () => {
    const result = runPublish(step, ["timeout", "timeout", "timeout"]);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 3);
  });
  test(`${name}: does not hide unrelated errors containing 'already exists'`, () => {
    const result = runPublish(step, ["unrelated", "unrelated", "unrelated"]);
    assert.equal(result.status, 1);
    assert.equal(result.calls.length, 3);
  });
}
