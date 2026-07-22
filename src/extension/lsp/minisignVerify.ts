import * as crypto from "crypto";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const SIG_ALGO = Buffer.from("Ed");
const KEY_ID_LEN = 8;
const SIG_LEN = 64;
const PK_LEN = 32;
const TRUSTED_COMMENT_PREFIX = "trusted comment: ";

function toEd25519KeyObject(rawPk: Buffer): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, rawPk]),
    format: "der",
    type: "spki",
  });
}

/**
 * Verify a minisign signature (.minisig content) over a message.
 *
 * Minisign uses Ed25519. The .minisig format:
 *   untrusted comment: ...
 *   <base64: 2B algo "Ed" + 8B keyId + 64B signature>
 *   trusted comment: ...
 *   <base64: 64B global signature over (signature || trustedComment)>
 *
 * Both the main signature (over the message) and the global signature
 * (over signature bytes + trusted comment) must verify.
 */
export function verify(
  publicKeyBase64: string,
  minisigContent: string,
  message: Uint8Array
): boolean {
  try {
    const lines = minisigContent
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l.length > 0);
    if (lines.length < 4) return false;

    const sigLine = lines[1];
    const commentLine = lines[2];
    const globalSigLine = lines[3];
    if (sigLine === undefined || commentLine === undefined || globalSigLine === undefined)
      return false;

    const pkRaw = Buffer.from(publicKeyBase64.trim(), "base64");
    if (pkRaw.length < 2 + KEY_ID_LEN + PK_LEN) return false;
    if (!pkRaw.subarray(0, 2).equals(SIG_ALGO)) return false;
    const keyId = pkRaw.subarray(2, 2 + KEY_ID_LEN);
    const publicKey = toEd25519KeyObject(
      pkRaw.subarray(2 + KEY_ID_LEN, 2 + KEY_ID_LEN + PK_LEN)
    );

    const sigRaw = Buffer.from(sigLine, "base64");
    if (sigRaw.length < 2 + KEY_ID_LEN + SIG_LEN) return false;
    if (!sigRaw.subarray(0, 2).equals(SIG_ALGO)) return false;
    if (!sigRaw.subarray(2, 2 + KEY_ID_LEN).equals(keyId)) return false;
    const signature = sigRaw.subarray(2 + KEY_ID_LEN, 2 + KEY_ID_LEN + SIG_LEN);

    if (!commentLine.startsWith(TRUSTED_COMMENT_PREFIX)) return false;
    const trustedComment = commentLine.slice(TRUSTED_COMMENT_PREFIX.length);
    const globalSig = Buffer.from(globalSigLine, "base64");
    if (globalSig.length !== SIG_LEN) return false;

    if (!crypto.verify(null, Buffer.from(message), publicKey, signature))
      return false;

    const globalMsg = Buffer.concat([
      signature,
      Buffer.from(trustedComment, "utf-8"),
    ]);
    return crypto.verify(null, globalMsg, publicKey, globalSig);
  } catch {
    return false;
  }
}
