import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

// Simple PBKDF2 password hashing (portable, no native deps)
const ITER = 210_000;
const KEYLEN = 32;
const DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const dk = pbkdf2Sync(Buffer.from(password, "utf8"), salt, ITER, KEYLEN, DIGEST);
  // format: pbkdf2$sha256$iter$saltB64$hashB64
  return `pbkdf2$${DIGEST}$${ITER}$${salt.toString("base64")}$${dk.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
  try {
    const [kind, digest, iterStr, saltB64, hashB64] = stored.split("$");
    if (kind !== "pbkdf2" || digest !== DIGEST) return false;
    const iter = parseInt(iterStr, 10);
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const dk = pbkdf2Sync(Buffer.from(password, "utf8"), salt, iter, expected.length, DIGEST);
    return timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

