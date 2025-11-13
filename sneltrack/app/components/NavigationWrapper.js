"use client";

import { usePathname } from "next/navigation";
import MainNavigation from "./mainNavigation";

export default function NavigationWrapper() {
  const pathname = usePathname();

  // Check if we're on a user route (pattern: /[user] or /[user]/*)
  const isUserRoute =
    pathname &&
    pathname.split("/").length >= 2 &&
    pathname.split("/")[1] !== "" &&
    pathname !== "/";

  if (!isUserRoute) {
    return null;
  }

  return <MainNavigation />;
}
