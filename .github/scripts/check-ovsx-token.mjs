import { pathToFileURL } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICE_DAYS = 14;

export async function checkOpenVsxToken({
  token,
  expiresAt,
  now = Date.now(),
  fetchImpl = globalThis.fetch,
}) {
  if (!token) {
    return "OVSX_PAT is not configured; Open VSX publishing is disabled.";
  }

  let expiration;
  if (expiresAt !== "never") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt ?? "")) {
      throw new Error("Set OVSX_PAT_EXPIRES_AT to YYYY-MM-DD (UTC), or never if Open VSX shows no expiration.");
    }
    expiration = Date.parse(`${expiresAt}T00:00:00Z`);
    if (!Number.isFinite(expiration) || new Date(expiration).toISOString().slice(0, 10) !== expiresAt) {
      throw new Error("OVSX_PAT_EXPIRES_AT is not a valid calendar date.");
    }
    if (expiration <= now) {
      throw new Error(`OVSX_PAT reaches its recorded expiration date on ${expiresAt}. Rotate it and update OVSX_PAT_EXPIRES_AT.`);
    }
  }

  const url = new URL("https://open-vsx.org/api/evsyukov/verify-pat");
  url.searchParams.set("token", token);
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Request errors can include the URL, which contains the token.
    throw new Error("Open VSX token validation request failed. Check registry availability.");
  }
  if (!response.ok) {
    throw new Error(`Open VSX rejected token validation (HTTP ${response.status}). Check OVSX_PAT and namespace access.`);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Open VSX token validation returned invalid JSON.");
  }
  if (!result || typeof result !== "object" || !result.success || result.error) {
    throw new Error("Open VSX token validation did not succeed. Check OVSX_PAT and namespace access.");
  }

  if (expiration === undefined) {
    return "OVSX_PAT is valid for namespace evsyukov; recorded expiration is never.";
  }
  const days = Math.ceil((expiration - now) / DAY_MS);
  if (expiration - now <= NOTICE_DAYS * DAY_MS) {
    throw new Error(`OVSX_PAT expires on ${expiresAt} (within ${days} days). Rotate it and update OVSX_PAT_EXPIRES_AT before the next release.`);
  }
  return `OVSX_PAT is valid for namespace evsyukov; recorded expiration is ${expiresAt} (${days} days remaining).`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(await checkOpenVsxToken({
      token: process.env.OVSX_PAT,
      expiresAt: process.env.OVSX_PAT_EXPIRES_AT,
    }));
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
