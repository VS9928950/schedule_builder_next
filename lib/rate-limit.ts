import fs from "fs";
import path from "path";
import { createHash } from "crypto";

type Entry = {
  count: number;
  reset_at_ms: number;
};

type Store = {
  entries: Record<string, Entry>;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const RATE_PATH = path.join(DATA_DIR, "rate_limits.json");

function ensureStore(): Store {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RATE_PATH)) {
    const init: Store = { entries: {} };
    fs.writeFileSync(RATE_PATH, JSON.stringify(init, null, 2), "utf8");
    return init;
  }
  const raw = fs.readFileSync(RATE_PATH, "utf8");
  const st = JSON.parse(raw) as Store;
  if (!st.entries || typeof st.entries !== "object") st.entries = {};
  return st;
}

function saveStore(st: Store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RATE_PATH, JSON.stringify(st, null, 2), "utf8");
}

function hashKey(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function extractClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff
    .split(",")
    .map((x) => x.trim())
    .find(Boolean);
  const xrip = req.headers.get("x-real-ip") || "";
  return (first || xrip || "unknown").slice(0, 120);
}

export function consumeRateLimit(args: { scope: string; key: string; limit: number; windowMs: number }) {
  const st = ensureStore();
  const now = Date.now();
  const fullKey = `${args.scope}:${hashKey(args.key)}`;

  for (const [k, v] of Object.entries(st.entries)) {
    if (!v || !Number.isFinite(v.reset_at_ms) || v.reset_at_ms <= now) {
      delete st.entries[k];
    }
  }

  const cur = st.entries[fullKey];
  if (!cur || cur.reset_at_ms <= now) {
    st.entries[fullKey] = { count: 1, reset_at_ms: now + args.windowMs };
    saveStore(st);
    return { ok: true as const, remaining: Math.max(0, args.limit - 1), retryAfterSec: Math.ceil(args.windowMs / 1000) };
  }

  if (cur.count >= args.limit) {
    saveStore(st);
    return {
      ok: false as const,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((cur.reset_at_ms - now) / 1000))
    };
  }

  cur.count += 1;
  saveStore(st);
  return {
    ok: true as const,
    remaining: Math.max(0, args.limit - cur.count),
    retryAfterSec: Math.max(1, Math.ceil((cur.reset_at_ms - now) / 1000))
  };
}

