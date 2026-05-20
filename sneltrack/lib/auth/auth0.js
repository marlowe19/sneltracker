import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Resolve the app base URL for Auth0 callbacks.
 * In development, use the incoming request host so LAN IP and localhost both work.
 * In production, use APP_BASE_URL from the environment.
 */
export function getAppBaseUrlFromRequest(request) {
  if (process.env.NODE_ENV === "development" && request) {
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host");
    if (host) {
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        "http";
      return `${proto}://${host}`;
    }
  }
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

/** Auth0 client scoped to the current request (required for correct login redirects). */
export function getAuth0Client(request) {
  return new Auth0Client({
    appBaseUrl: getAppBaseUrlFromRequest(request),
  });
}

/** Default client for call sites without a request (uses APP_BASE_URL or localhost). */
export const auth0 = new Auth0Client({
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
});
