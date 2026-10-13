// Encryption for credentials stored with an AUTHENTICATION action.
//
// AES-256-GCM with a key from VC_SECRET_KEY (32 random bytes, base64).
// Stored as "enc:v1:" + base64url(iv | auth tag | ciphertext). A value
// without that prefix is treated as legacy plaintext, so old rows keep
// working until tools/encrypt-secrets.mjs has run.
//
// Plain JavaScript on purpose: the server code and the one-off migration
// script both import it.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** @returns {Buffer} */
function loadKey() {
  const raw = process.env.VC_SECRET_KEY;

  if (!raw) {
    throw new Error(
      "VC_SECRET_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("VC_SECRET_KEY must be 32 bytes, base64 encoded.");
  }

  return key;
}

/** @param {unknown} value */
export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypts a secret. Empty values become null and already-encrypted values
 * are returned unchanged, so saving a loaded record never double-encrypts.
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function encryptSecret(value) {
  if (value === null || value === undefined || value === "") return null;
  if (isEncrypted(value)) return value;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", loadKey(), iv);
  const body = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return PREFIX + Buffer.concat([iv, tag, body]).toString("base64url");
}

/**
 * Decrypts a stored secret. Legacy plaintext passes through untouched.
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function decryptSecret(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!isEncrypted(value)) return String(value);

  const packed = Buffer.from(value.slice(PREFIX.length), "base64url");

  if (packed.length < IV_BYTES + TAG_BYTES) {
    throw new Error("Stored secret is corrupted.");
  }

  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = packed.subarray(IV_BYTES + TAG_BYTES);

  try {
    const decipher = createDecipheriv("aes-256-gcm", loadKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(
      "A stored secret could not be decrypted. VC_SECRET_KEY may have changed."
    );
  }
}

/**
 * Returns a copy of a saved flow with every action password passed through
 * `transform`. Nodes are plain JSON: { actionData: { password }, paths: [] }.
 * @param {unknown} flow
 * @param {(value: string | null) => string | null} transform
 * @returns {any}
 */
export function mapFlowSecrets(flow, transform) {
  if (!Array.isArray(flow)) return flow;

  return flow.map((node) => {
    if (!node || typeof node !== "object") return node;

    const next = { ...node };

    if (next.actionData && typeof next.actionData === "object") {
      next.actionData = { ...next.actionData };

      if (next.actionData.password !== undefined) {
        next.actionData.password = transform(next.actionData.password);
      }
    }

    next.paths = mapFlowSecrets(next.paths, transform);

    return next;
  });
}

/** @param {unknown} flow */
export const encryptFlowSecrets = (flow) => mapFlowSecrets(flow, encryptSecret);

/** @param {unknown} flow */
export const decryptFlowSecrets = (flow) => mapFlowSecrets(flow, decryptSecret);
