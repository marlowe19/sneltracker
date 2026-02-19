"use client";

import dynamic from "next/dynamic";

const WrappedClient = dynamic(() => import("./WrappedClient"), {
  ssr: false,
});

export default function WrappedPage() {
  return <WrappedClient />;
}



