"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Time,
  Folder,
  Notebook,
  ChartBar,
  ChartColumnFloating,
  User,
} from "@carbon/icons-react";

export default function MainNavigation() {
  const pathname = usePathname();
  // Determine active route
  const isActiveRoute = (route) => {
    return pathname === route || pathname?.startsWith(`${route}/`);
  };

  const getLinkClasses = (route) => {
    const isActive = isActiveRoute(route);
    return `flex-1 inline-flex flex-col justify-center items-center`;
  };

  const getIconClasses = (route) => {
    const isActive = isActiveRoute(route);
    return isActive
      ? "text-Color-Solids-color-solid-primary"
      : "text-neutral-900";
  };

  const getTextClasses = (route) => {
    const isActive = isActiveRoute(route);
    return isActive
      ? "justify-end text-Color-Solids-color-solid-primary text-[10px] font-medium leading-6"
      : "justify-end text-black text-[10px] font-medium leading-6";
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        data-type="SnelTracker"
        className="w-full bg-neutral-100 border-t border-[#E2E2E2] inline-flex flex-col justify-start items-start overflow-hidden"
      >
        <div className="w-full p-2 bg-white inline-flex justify-center items-end">
          <Link href="/my" prefetch={false} className={getLinkClasses("/my")}>
            <Time size={24} className={getIconClasses("/my")} />
            <div className={getTextClasses("/my")}>Timers</div>
          </Link>
          <Link
            href="/my/projecten"
            prefetch={false}
            className={getLinkClasses("/my/projecten")}
          >
            <Folder size={24} className={getIconClasses("/my/projecten")} />
            <div className={getTextClasses("/my/projecten")}>Projecten</div>
          </Link>
          <Link
            href="/my/notes"
            prefetch={false}
            className={getLinkClasses("/my/notes")}
          >
            <Notebook size={24} className={getIconClasses("/my/notes")} />
            <div className={getTextClasses("/my/notes")}>Notites</div>
          </Link>
          <Link
            href="/my/reports"
            prefetch={false}
            className={getLinkClasses("/my/reports")}
          >
            <ChartColumnFloating
              size={24}
              className={getIconClasses("/my/reports")}
            />
            <div className={getTextClasses("/my/reports")}>Reports</div>
          </Link>
          <Link
            href="/my/profile"
            prefetch={false}
            className={getLinkClasses("/my/profile")}
          >
            <User size={24} className={getIconClasses("/my/profile")} />
            <div className={getTextClasses("/my/profile")}>Profiel</div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
