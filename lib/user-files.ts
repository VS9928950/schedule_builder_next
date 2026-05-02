import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function getUserRootDir(userId: number) {
  return ensureDir(path.join(DATA_DIR, "users", String(userId)));
}

export function getProjectRootDir(userId: number, projectId: number) {
  return ensureDir(path.join(getUserRootDir(userId), "projects", String(projectId)));
}

export function getProjectUploadsDir(userId: number, projectId: number) {
  return ensureDir(path.join(getProjectRootDir(userId, projectId), "uploads"));
}

export function sanitizeFilename(name: string) {
  const base = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim();
  return (base || "file").slice(0, 120);
}

