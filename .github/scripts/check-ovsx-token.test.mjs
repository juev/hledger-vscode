import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOpenVsxToken } from "./check-ovsx-token.mjs";

const now = Date.parse("2026-09-01T00:00:00Z");
const token = "test-token-never-publish";
const success = async () => ({ ok: true, json: async () => ({ success: "Token is valid." }) });
const options = { token, expiresAt: "2026-10-01", now, fetchImpl: success };

test("skips an optional Open VSX integration without making a request", async () => {
  assert.match(await checkOpenVsxToken({ fetchImpl: () => assert.fail("unexpected request") }), /disabled/);
});

test("requires an explicit, real expiration date when publishing is enabled", async () => {
  for (const expiresAt of [undefined, "", "tomorrow", "2026-13-01", "2026-02-30"]) {
    await assert.rejects(checkOpenVsxToken({ ...options, expiresAt }), /OVSX_PAT_EXPIRES_AT/);
  }
});

test("validates a token explicitly marked as non-expiring", async () => {
  assert.match(await checkOpenVsxToken({ ...options, expiresAt: "never" }), /expiration is never/);
  await assert.rejects(checkOpenVsxToken({
    ...options,
    expiresAt: "never",
    fetchImpl: async () => ({ ok: false, status: 401 }),
  }), /HTTP 401/);
});

test("accepts a valid token whose recorded expiry is more than 14 days away", async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(url.origin, "https://open-vsx.org");
    assert.equal(url.pathname, "/api/evsyukov/verify-pat");
    assert.equal(url.searchParams.get("token"), token);
    assert.equal(init.redirect, "error");
    return success();
  };
  assert.match(await checkOpenVsxToken({ ...options, fetchImpl }), /30 days remaining/);
});

test("alerts exactly 14 days before expiry and throughout the notice window", async () => {
  for (const expiresAt of ["2026-09-15", "2026-09-02"]) {
    await assert.rejects(checkOpenVsxToken({ ...options, expiresAt }), /Rotate it/);
  }
  assert.match(await checkOpenVsxToken({ ...options, expiresAt: "2026-09-16" }), /15 days remaining/);
});

test("alerts at midnight UTC on the recorded expiry date and after it", async () => {
  for (const expiresAt of ["2026-09-01", "2026-08-31"]) {
    await assert.rejects(checkOpenVsxToken({ ...options, expiresAt }), /recorded expiration date/);
  }
});

test("detects revoked tokens, missing permissions and registry failures before a release", async () => {
  for (const status of [401, 403, 404, 503]) {
    await assert.rejects(checkOpenVsxToken({
      ...options,
      fetchImpl: async () => ({ ok: false, status }),
    }), new RegExp(`HTTP ${status}`));
  }
});

test("rejects malformed responses and API errors without echoing their contents", async () => {
  for (const body of [null, [], {}, { success: false }, { error: token }]) {
    await assert.rejects(checkOpenVsxToken({
      ...options,
      fetchImpl: async () => ({ ok: true, json: async () => body }),
    }), (error) => !error.message.includes(token));
  }
  await assert.rejects(checkOpenVsxToken({
    ...options,
    fetchImpl: async () => ({ ok: true, json: async () => { throw new Error(token); } }),
  }), /invalid JSON/);
});

test("does not expose the token when a request or redirect fails", async () => {
  await assert.rejects(checkOpenVsxToken({
    ...options,
    fetchImpl: async (url) => { throw new Error(`Request failed: ${url}`); },
  }), (error) => error.message.includes("request failed") && !error.message.includes(token));
});
