import type { Page } from "@playwright/test";
export async function login(page: Page, id: string, initialSession = true) {
  const user = {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "director-test@studio.test",
    app_metadata: { role: "CLIENT" },
    user_metadata: {},
  };
  if (initialSession)
    await page.addInitScript(
      ({ user }) =>
        localStorage.setItem(
          "sb-studio-test-auth-token",
          JSON.stringify({
            access_token: "studio-token",
            refresh_token: "studio-refresh",
            token_type: "bearer",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user,
          }),
        ),
      { user },
    );
  await page.route("https://studio-test.supabase.co/**", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).pathname.endsWith("/token")
        ? {
            access_token: "studio-token",
            refresh_token: "studio-refresh",
            token_type: "bearer",
            expires_in: 3600,
            user,
          }
        : user,
    }),
  );
  await page.route("http://127.0.0.1:4401/**", async (route) => {
    if (route.request().url().includes("/users/me"))
      return route.fulfill({ json: { ...user, role: "CLIENT" } });
    if (route.request().url().includes("/notifications")) return route.fulfill({ json: [] });
    await route.continue({
      headers: { ...route.request().headers(), "x-user-id": id, "x-user-role": "CLIENT" },
    });
  });
}
