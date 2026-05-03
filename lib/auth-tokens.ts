import fs from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";

export type AuthTokenPurpose = "verify_email" | "reset_password";

type AuthTokenRow = {
  id: number;
  user_id: number;
  purpose: AuthTokenPurpose;
  token_hash: string;
  created_at: string;
  expires_at: string;
  used_at?: string | null;
};

type AuthTokenStore = {
  nextId: number;
  tokens: AuthTokenRow[];
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const TOKENS_PATH = path.join(DATA_DIR, "auth_tokens.json");

function nowIso() {
  return new Date().toISOString();
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function ensureStore(): AuthTokenStore {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(TOKENS_PATH)) {
    const init: AuthTokenStore = { nextId: 1, tokens: [] };
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(init, null, 2), "utf8");
    return init;
  }
  const raw = fs.readFileSync(TOKENS_PATH, "utf8");
  const parsed = JSON.parse(raw) as AuthTokenStore;
  if (!parsed.nextId) parsed.nextId = 1;
  if (!Array.isArray(parsed.tokens)) parsed.tokens = [];
  return parsed;
}

function saveStore(store: AuthTokenStore) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(store, null, 2), "utf8");
}

function purgeExpired(store: AuthTokenStore) {
  const now = Date.now();
  store.tokens = store.tokens.filter((t) => {
    const exp = Date.parse(t.expires_at);
    if (!Number.isFinite(exp)) return false;
    return exp > now || !!t.used_at;
  });
}

export function issueAuthToken(userId: number, purpose: AuthTokenPurpose, ttlMinutes: number) {
  const store = ensureStore();
  purgeExpired(store);
  const rawToken = randomBytes(32).toString("hex");
  const row: AuthTokenRow = {
    id: store.nextId++,
    user_id: userId,
    purpose,
    token_hash: sha256Hex(rawToken),
    created_at: nowIso(),
    expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    used_at: null
  };
  store.tokens.push(row);
  saveStore(store);
  return rawToken;
}

export function consumeAuthToken(purpose: AuthTokenPurpose, rawToken: string): number | null {
  const store = ensureStore();
  purgeExpired(store);
  const hash = sha256Hex(rawToken);
  const now = Date.now();
  const row = store.tokens.find((t) => t.purpose === purpose && t.token_hash === hash && !t.used_at);
  if (!row) {
    saveStore(store);
    return null;
  }
  const exp = Date.parse(row.expires_at);
  if (!Number.isFinite(exp) || exp <= now) {
    saveStore(store);
    return null;
  }
  row.used_at = nowIso();
  saveStore(store);
  return row.user_id;
}

