export function resolvePublicOrigin(req: Request) {
  const fromEnv = (process.env.APP_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const url = new URL(req.url);
  if (url.hostname === "0.0.0.0") {
    url.hostname = "localhost";
  }
  return url.origin;
}

export function toPublicUrl(req: Request, pathname: string) {
  return new URL(pathname, resolvePublicOrigin(req));
}
