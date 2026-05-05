import fs from "fs";
import path from "path";
import { hashPassword, verifyPassword } from "@/lib/password";

export type User = { id: number; email: string; password_hash: string; created_at: string };
export type StoredUser = User & { email_verified?: boolean };

export type ProjectUpload = {
  id: number;
  original_name: string;
  stored_name: string; // file name on disk (within user project uploads dir)
  parsed_json: unknown | null; // cached parse result for now
  created_at: string;
};

export type ProjectBuild = {
  id: number;
  version: string; // human label (optional)
  seq: number; // monotonically increasing build number within a project
  created_at: string;
  created_by_email?: string;
  source_upload_id: number | null;
  events_json: unknown; // snapshot of resulting events for this version
  timeline_marks?: Record<string, string[]>; // YYYY-MM-DD -> ["HH:MM", ...]
  timeline_layout?: {
    // Manual row height overrides for timeline anchors (presentation layer).
    // dayKey (YYYY-MM-DD) -> anchorLabel (HH:MM) -> heightPx
    row_heights?: Record<string, Record<string, number>>;
    // Manual equal column width override (kanban layer).
    // dayKey (YYYY-MM-DD) -> col width in px
    col_width_px?: Record<string, number>;
    // Manual number of columns for the grid (kanban layer).
    // dayKey (YYYY-MM-DD) -> column count
    col_count?: Record<string, number>;
    // Per-event layout overrides (kanban layer).
    // dayKey (YYYY-MM-DD) -> eventId -> overrides
    event_overrides?: Record<
      string,
      Record<
        string,
        {
          anchor?: string; // HH:MM (row)
          col?: number; // column index (0-based)
          colSpan?: number; // number of columns (>=1)
          rowSpan?: number; // number of rows (>=1)
          heightPx?: number; // explicit height override
          hidden?: boolean; // hide tile in timeline only
        }
      >
    >;
    /** Days per pack in Архитектура (1–10, default 5). */
    days_per_pack?: number;
    /** Local calendar days YYYY-MM-DD hidden in grid (events unchanged). */
    hidden_day_keys?: string[];
  };
  timeline_style?: {
    // Section titles
    eveningProgramTitle?: string;

    // Typography (px)
    titleFontPx?: number;
    timeFontPx?: number;
    formatFontPx?: number;
    placeFontPx?: number;

    // Typography (per-entity)
    titleWeight?: number;
    titleItalic?: boolean;
    timeWeight?: number;
    timeItalic?: boolean;
    formatWeight?: number;
    formatItalic?: boolean;
    placeWeight?: number;
    placeItalic?: boolean;

    // Colors via picker+alpha (preferred)
    eventBgColor?: string; // #rrggbb
    eventBgAlpha?: number; // 0..1
    eventBorderColor?: string; // #rrggbb
    eventBorderAlpha?: number; // 0..1

    // Back-compat: old free-form CSS strings
    eventBg?: string;
    eventBorder?: string;

    /** How event title links open when `url` is set. */
    eventLinkTarget?: "_blank" | "_self";
  };
};

export type Project = {
  id: number;
  user_id: number;
  name: string;
  excel_json: unknown | null; // legacy single-file cache
  uploads?: ProjectUpload[];
  active_upload_id?: number | null;
  builds?: ProjectBuild[];
  active_build_id?: number | null;
  builder_json: unknown | null; // curated result (events edits/deletes), WIP
  created_at: string;
  updated_at: string;
};

type StoreData = {
  nextUserId: number;
  nextProjectId: number;
  nextUploadId?: number;
  nextBuildId?: number;
  users: StoredUser[];
  projects: Project[];
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function now() {
  return new Date().toISOString();
}

function ensureStore(): StoreData {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const init: StoreData = { nextUserId: 1, nextProjectId: 1, nextUploadId: 1, users: [], projects: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(init, null, 2), "utf8");
    return init;
  }
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  const st = JSON.parse(raw) as StoreData;
  st.users = (st.users ?? []).map((u: any) => ({
    ...u,
    // Backward compatibility: legacy users become verified to avoid forced lockout.
    email_verified: typeof u?.email_verified === "boolean" ? u.email_verified : true
  }));
  if (!st.nextUploadId) st.nextUploadId = 1;
  if (!st.nextBuildId) st.nextBuildId = 1;
  return st;
}

function saveStore(data: StoreData) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function findUserByEmail(email: string): StoredUser | null {
  const st = ensureStore();
  return st.users.find((u) => u.email === email) ?? null;
}

export function findUserById(userId: number): StoredUser | null {
  const st = ensureStore();
  return st.users.find((u) => u.id === userId) ?? null;
}

export function createUser(email: string, password: string): StoredUser {
  const st = ensureStore();
  const exists = st.users.some((u) => u.email === email);
  if (exists) throw new Error("Email already exists");
  const u: StoredUser = {
    id: st.nextUserId++,
    email,
    password_hash: hashPassword(password),
    email_verified: false,
    created_at: now()
  };
  st.users.push(u);
  saveStore(st);
  return u;
}

export function authenticate(email: string, password: string): StoredUser | null {
  const u = findUserByEmail(email);
  if (!u) return null;
  if (!verifyPassword(password, u.password_hash)) return null;
  return u;
}

export function setUserPassword(userId: number, password: string) {
  const st = ensureStore();
  const u = st.users.find((x) => x.id === userId);
  if (!u) throw new Error("User not found");
  u.password_hash = hashPassword(password);
  u.created_at = u.created_at || now();
  saveStore(st);
}

export function markUserEmailVerified(userId: number) {
  const st = ensureStore();
  const u = st.users.find((x) => x.id === userId);
  if (!u) throw new Error("User not found");
  u.email_verified = true;
  saveStore(st);
}

export function listProjects(userId: number): Project[] {
  const st = ensureStore();
  return st.projects
    .filter((p) => p.user_id === userId)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export function createProject(userId: number, name: string): Project {
  const st = ensureStore();
  const p: Project = {
    id: st.nextProjectId++,
    user_id: userId,
    name,
    excel_json: null,
    uploads: [],
    active_upload_id: null,
    builds: [],
    active_build_id: null,
    builder_json: null,
    created_at: now(),
    updated_at: now()
  };
  st.projects.push(p);
  saveStore(st);
  return p;
}

export function getProject(projectId: number, userId: number): Project | null {
  const st = ensureStore();
  return st.projects.find((p) => p.id === projectId && p.user_id === userId) ?? null;
}

export function renameProject(projectId: number, userId: number, name: string) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  p.name = name.trim().slice(0, 80) || "Без названия";
  p.updated_at = now();
  saveStore(st);
  return p;
}

export function deleteProject(projectId: number, userId: number) {
  const st = ensureStore();
  const before = st.projects.length;
  st.projects = st.projects.filter((p) => !(p.id === projectId && p.user_id === userId));
  if (st.projects.length === before) throw new Error("Not found");
  saveStore(st);
}

export function updateProjectExcel(projectId: number, userId: number, excel: unknown) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  p.excel_json = excel;
  p.updated_at = now();
  saveStore(st);
}

export function addProjectUpload(projectId: number, userId: number, originalName: string, storedName: string, parsed: unknown) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  if (!p.uploads) p.uploads = [];
  const id = st.nextUploadId ?? 1;
  st.nextUploadId = id + 1;

  const up: ProjectUpload = {
    id,
    original_name: originalName,
    stored_name: storedName,
    parsed_json: parsed ?? null,
    created_at: now()
  };
  p.uploads.unshift(up);
  p.active_upload_id = up.id;
  p.excel_json = parsed ?? null; // keep legacy field in sync for existing pages
  p.updated_at = now();
  saveStore(st);
  return up;
}

export function deleteProjectUpload(projectId: number, userId: number, uploadId: number) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  if (!p.uploads?.length) return;
  p.uploads = p.uploads.filter((u) => u.id !== uploadId);
  if (p.active_upload_id === uploadId) {
    p.active_upload_id = p.uploads[0]?.id ?? null;
    p.excel_json = p.uploads[0]?.parsed_json ?? null;
  }
  p.updated_at = now();
  saveStore(st);
}

export function setActiveProjectUpload(projectId: number, userId: number, uploadId: number) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  const up = p.uploads?.find((u) => u.id === uploadId);
  if (!up) throw new Error("Not found");
  p.active_upload_id = uploadId;
  p.excel_json = up.parsed_json ?? null;
  p.updated_at = now();
  saveStore(st);
}

export function createProjectBuild(
  projectId: number,
  userId: number,
  version: string,
  createdByEmail: string | null,
  sourceUploadId: number | null,
  events: unknown
) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  if (!p.builds) p.builds = [];
  const id = st.nextBuildId ?? 1;
  st.nextBuildId = id + 1;

  const nextSeq = (p.builds.reduce((m, b) => Math.max(m, (b as any).seq ?? 0), 0) || 0) + 1;
  const build: ProjectBuild = {
    id,
    version: version.trim().slice(0, 60),
    seq: nextSeq,
    created_at: now(),
    created_by_email: createdByEmail ?? undefined,
    source_upload_id: sourceUploadId,
    events_json: events ?? []
  };
  p.builds.unshift(build);
  p.active_build_id = build.id;
  p.builder_json = build.events_json; // keep "current result" in sync
  p.updated_at = now();
  saveStore(st);
  return build;
}

export function deleteProjectBuild(projectId: number, userId: number, buildId: number) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  if (!p.builds?.length) return;
  p.builds = p.builds.filter((b) => b.id !== buildId);
  if (p.active_build_id === buildId) {
    p.active_build_id = p.builds[0]?.id ?? null;
    p.builder_json = p.builds[0]?.events_json ?? null;
  }
  p.updated_at = now();
  saveStore(st);
}

export function setActiveProjectBuild(projectId: number, userId: number, buildId: number) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  const b = p.builds?.find((x) => x.id === buildId);
  if (!b) throw new Error("Not found");
  p.active_build_id = buildId;
  p.builder_json = b.events_json ?? null;
  p.updated_at = now();
  saveStore(st);
}

export function updateProjectBuildEvents(projectId: number, userId: number, buildId: number, events: unknown) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  const b = p.builds?.find((x) => x.id === buildId);
  if (!b) throw new Error("Build not found");
  b.events_json = events ?? [];
  p.active_build_id = buildId;
  p.builder_json = b.events_json ?? null;
  p.updated_at = now();
  saveStore(st);
}

export function updateProjectBuildTimelineMarks(
  projectId: number,
  userId: number,
  buildId: number,
  marks: Record<string, string[]>
) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  const b = p.builds?.find((x) => x.id === buildId);
  if (!b) throw new Error("Build not found");
  b.timeline_marks = marks ?? {};
  p.updated_at = now();
  saveStore(st);
}

export function updateProjectBuildTimelineStyle(
  projectId: number,
  userId: number,
  buildId: number,
  style: ProjectBuild["timeline_style"]
) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  const b = p.builds?.find((x) => x.id === buildId);
  if (!b) throw new Error("Build not found");
  (b as any).timeline_style = style ?? {};
  p.updated_at = now();
  saveStore(st);
}

export function updateProjectBuildTimelineLayout(
  projectId: number,
  userId: number,
  buildId: number,
  layout: ProjectBuild["timeline_layout"]
) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  const b = p.builds?.find((x) => x.id === buildId);
  if (!b) throw new Error("Build not found");
  (b as any).timeline_layout = layout ?? {};
  p.updated_at = now();
  saveStore(st);
}

export function updateProjectBuilder(projectId: number, userId: number, builder: unknown) {
  const st = ensureStore();
  const p = st.projects.find((x) => x.id === projectId && x.user_id === userId);
  if (!p) throw new Error("Not found");
  p.builder_json = builder;
  p.updated_at = now();
  saveStore(st);
}

