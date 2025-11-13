"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Time,
  Folder,
  Notebook,
  ChartBar,
  ChartColumnFloating,
} from "@carbon/icons-react";

export default function MainNavigation() {
  const pathname = usePathname();
  // Extract user from pathname (first segment after root)
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const user = pathSegments[0] || "";

  if (!user) {
    return null;
  }

  const encodedUser = encodeURIComponent(user);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center">
      <div
        data-type="SnelTracker"
        className="w-full bg-neutral-100 border-t border-[#E2E2E2] inline-flex flex-col justify-start items-start overflow-hidden"
      >
        <div className="w-full p-2 bg-white inline-flex justify-center items-end">
          <Link
            href={`/${encodedUser}`}
            prefetch={false}
            className="flex-1 inline-flex flex-col justify-center items-center"
          >
            <Time size={24} className="text-Color-Solids-color-solid-primary" />
            <div className="justify-end text-Color-Solids-color-solid-primary text-[10px] font-medium leading-6">
              Timers
            </div>
          </Link>
          <Link
            href={`/${encodedUser}/projecten`}
            prefetch={false}
            className="flex-1 inline-flex flex-col justify-center items-center"
          >
            <Folder size={24} className="text-neutral-900" />
            <div className="justify-end text-black text-[10px] font-medium leading-6">
              Projecten
            </div>
          </Link>
          <Link
            href={`/${encodedUser}/notes`}
            prefetch={false}
            className="flex-1 inline-flex flex-col justify-center items-center"
          >
            <Notebook size={24} className="text-neutral-900" />
            <div className="justify-end text-black text-[10px] font-medium leading-6">
              Notites
            </div>
          </Link>
          <Link
            href={`/${encodedUser}/reports`}
            prefetch={false}
            className="flex-1 inline-flex flex-col justify-center items-center"
          >
            <ChartColumnFloating size={24} className="text-neutral-900" />
            <div className="justify-end text-black text-[10px] font-medium leading-6">
              Reports
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
