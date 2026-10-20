const returnKey = "actbyme-auth-return-to";

export function safeAuthReturnTo(path?: string | null) {
  if (!path?.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path)) return "/profile";
  return path;
}

// OAuth keeps its existing, allow-listed /profile callback. Only a short-lived,
// same-tab destination is remembered; no token or personal data is stored here.
export function rememberAuthReturnTo(path: string) {
  try {
    sessionStorage.setItem(
      returnKey,
      JSON.stringify({ path: safeAuthReturnTo(path), expiresAt: Date.now() + 5 * 60000 }),
    );
    return true;
  } catch {
    return false;
  }
}

export function consumeAuthReturnTo() {
  try {
    const stored = sessionStorage.getItem(returnKey);
    sessionStorage.removeItem(returnKey);
    const value = JSON.parse(stored ?? "null");
    return value?.expiresAt > Date.now() && typeof value.path === "string"
      ? safeAuthReturnTo(value.path)
      : "/profile";
  } catch {
    return "/profile";
  }
}
