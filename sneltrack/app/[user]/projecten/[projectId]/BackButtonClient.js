"use client";
import { useRouter } from "next/navigation";

export default function BackButtonClient() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-base sm:text-sm py-2 px-3 sm:py-0 sm:px-0 text-gray-600 hover:text-gray-900"
    >
      ← Terug
    </button>
  );
}
