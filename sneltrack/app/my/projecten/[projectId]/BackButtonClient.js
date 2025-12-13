"use client";
import { useRouter } from "next/navigation";

import { ChevronLeft } from "@carbon/icons-react";
export default function BackButtonClient() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-base flex items-center gap-2 sm:text-sm py-2 px-3 sm:py-0 sm:px-0 text-gray-600 hover:text-gray-900"
    >
      <ChevronLeft size={24} /> <span className="text-sm">Terug</span>
    </button>
  );
}
