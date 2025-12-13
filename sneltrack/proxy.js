import { NextRequest } from "next/server";
import { auth0 } from "./lib/auth/auth0";

export async function proxy(request) {
  const session = await auth0.getSession(request);
  console.log("session", session);

  //console.log("proxying request", request);
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - appimages/ (app images folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon-SO.svg|manifest.json|sitemap.xml|robots.txt|appimages/).*)",
  ],
};
