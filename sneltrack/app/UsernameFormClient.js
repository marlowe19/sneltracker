"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UsernameFormClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (trimmedUsername) {
      router.push(`/my`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 items-center w-full max-w-md mx-auto px-4"
    >
      <img src="/wachtwoord-herstel.png" alt="" className="mb-4" />
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Gebruikersnaam invoeren"
        className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-gray-400 text-base"
        required
      />
      <button
        type="submit"
        className="btn w-full text-base sm:text-lg py-4 rounded-xl bg-[#008eff] disabled:opacity-60"
      >
        Verzenden
      </button>
    </form>
  );
}
