jest.mock("crypto", () => {
  const nativeCrypto = jest.requireActual<typeof import("crypto")>("crypto");
  return { ...nativeCrypto, createHash: jest.fn(nativeCrypto.createHash) };
});

import * as crypto from "crypto";
import { verify } from "../minisignVerify";

const nativeCrypto = jest.requireActual<typeof import("crypto")>("crypto");
const SIG_ALGO = Buffer.from("Ed");
const PREHASHED_SIG_ALGO = Buffer.from("ED");
const KEY_ID = Buffer.from("0102030405060708", "hex");

function rawPublicKeyFromKeyObject(key: crypto.KeyObject): Buffer {
  const spki = key.export({ format: "der", type: "spki" });
  // SPKI DER for Ed25519: 12-byte prefix + 32-byte raw key
  return spki.subarray(spki.length - 32);
}

function toMinisignPublicKey(rawPk: Buffer): string {
  return Buffer.concat([SIG_ALGO, KEY_ID, rawPk]).toString("base64");
}

function buildMinisig(
  privateKey: crypto.KeyObject,
  message: Buffer,
  trustedComment: string
): string {
  const signature = crypto.sign(null, message, privateKey);
  const globalMsg = Buffer.concat([
    signature,
    Buffer.from(trustedComment, "utf-8"),
  ]);
  const globalSig = crypto.sign(null, globalMsg, privateKey);

  const sigLine = Buffer.concat([SIG_ALGO, KEY_ID, signature]).toString(
    "base64"
  );
  const globalSigLine = globalSig.toString("base64");

  return [
    "untrusted comment: test signature",
    sigLine,
    `trusted comment: ${trustedComment}`,
    globalSigLine,
  ].join("\n");
}

function buildPrehashedMinisig(
  privateKey: crypto.KeyObject,
  message: Buffer,
  trustedComment: string
): string {
  const prehashedMessage = crypto.createHash("blake2b512").update(message).digest();
  const signature = crypto.sign(null, prehashedMessage, privateKey);
  const globalMsg = Buffer.concat([
    signature,
    Buffer.from(trustedComment, "utf-8"),
  ]);
  const globalSig = crypto.sign(null, globalMsg, privateKey);

  const sigLine = Buffer.concat([PREHASHED_SIG_ALGO, KEY_ID, signature]).toString(
    "base64"
  );
  const globalSigLine = globalSig.toString("base64");

  return [
    "untrusted comment: test signature",
    sigLine,
    `trusted comment: ${trustedComment}`,
    globalSigLine,
  ].join("\n");
}

describe("minisignVerify", () => {
  let publicKey: crypto.KeyObject;
  let privateKey: crypto.KeyObject;
  let minisignPk: string;

  beforeEach(() => {
    const pair = crypto.generateKeyPairSync("ed25519");
    publicKey = pair.publicKey;
    privateKey = pair.privateKey;
    minisignPk = toMinisignPublicKey(rawPublicKeyFromKeyObject(publicKey));
  });

  it("accepts a valid signature", () => {
    const message = Buffer.from("hello world");
    const minisig = buildMinisig(privateKey, message, "timestamp:1234\tfile:test");

    expect(verify(minisignPk, minisig, message)).toBe(true);
  });

  it("accepts a valid prehashed ED signature", () => {
    const message = Buffer.from("hello world");
    const minisig = buildPrehashedMinisig(
      privateKey,
      message,
      "timestamp:1234\tfile:test"
    );

    expect(verify(minisignPk, minisig, message)).toBe(true);
  });

  it("accepts valid ED when native blake2b512 is unavailable", () => {
    const message = Buffer.from("hello world");
    const minisig = buildPrehashedMinisig(
      privateKey,
      message,
      "timestamp:1234\tfile:test"
    );
    const createHashMock = jest.mocked(crypto.createHash).mockImplementation(() => {
      throw new Error("blake2b512 is unavailable");
    });

    try {
      expect(verify(minisignPk, minisig, message)).toBe(true);
    } finally {
      createHashMock.mockImplementation(nativeCrypto.createHash);
    }
  });

  it("rejects a signature over a different message", () => {
    const message = Buffer.from("hello world");
    const minisig = buildMinisig(privateKey, message, "timestamp:1234\tfile:test");

    expect(verify(minisignPk, minisig, Buffer.from("tampered"))).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const message = Buffer.from("hello world");
    const otherPair = crypto.generateKeyPairSync("ed25519");
    const minisig = buildMinisig(otherPair.privateKey, message, "timestamp:1234");

    expect(verify(minisignPk, minisig, message)).toBe(false);
  });

  it("rejects when key ID does not match", () => {
    const message = Buffer.from("hello world");
    const signature = crypto.sign(null, message, privateKey);
    const wrongKeyId = Buffer.from("ffffffffffffffff", "hex");
    const sigLine = Buffer.concat([SIG_ALGO, wrongKeyId, signature]).toString(
      "base64"
    );
    const globalMsg = Buffer.concat([
      signature,
      Buffer.from("timestamp:1234", "utf-8"),
    ]);
    const globalSig = crypto.sign(null, globalMsg, privateKey);
    const minisig = [
      "untrusted comment: test",
      sigLine,
      "trusted comment: timestamp:1234",
      globalSig.toString("base64"),
    ].join("\n");

    expect(verify(minisignPk, minisig, message)).toBe(false);
  });

  it("rejects when global signature is invalid", () => {
    const message = Buffer.from("hello world");
    const signature = crypto.sign(null, message, privateKey);
    const sigLine = Buffer.concat([SIG_ALGO, KEY_ID, signature]).toString(
      "base64"
    );
    const minisig = [
      "untrusted comment: test",
      sigLine,
      "trusted comment: timestamp:1234",
      Buffer.alloc(64).toString("base64"),
    ].join("\n");

    expect(verify(minisignPk, minisig, message)).toBe(false);
  });

  it("rejects truncated minisig content", () => {
    expect(verify(minisignPk, "only one line", Buffer.from("x"))).toBe(false);
    expect(verify(minisignPk, "", Buffer.from("x"))).toBe(false);
  });

  it("rejects invalid public key base64", () => {
    const message = Buffer.from("hello world");
    const minisig = buildMinisig(privateKey, message, "timestamp:1234");

    expect(verify("not-valid-base64!!!", minisig, message)).toBe(false);
  });

  it("rejects when trusted comment prefix is missing", () => {
    const message = Buffer.from("hello world");
    const signature = crypto.sign(null, message, privateKey);
    const sigLine = Buffer.concat([SIG_ALGO, KEY_ID, signature]).toString(
      "base64"
    );
    const globalMsg = Buffer.concat([
      signature,
      Buffer.from("timestamp:1234", "utf-8"),
    ]);
    const globalSig = crypto.sign(null, globalMsg, privateKey);
    const minisig = [
      "untrusted comment: test",
      sigLine,
      "wrong prefix: timestamp:1234",
      globalSig.toString("base64"),
    ].join("\n");

    expect(verify(minisignPk, minisig, message)).toBe(false);
  });

  it("handles CRLF line endings", () => {
    const message = Buffer.from("hello world");
    const minisig = buildMinisig(privateKey, message, "timestamp:1234");
    const crlfMinisig = minisig.replace(/\n/g, "\r\n");

    expect(verify(minisignPk, crlfMinisig, message)).toBe(true);
  });
});
