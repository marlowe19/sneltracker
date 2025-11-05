"use client";

export default function HeaderSectionClient({ user, onAddTimer }) {
  return (
    <section className="p-4 flex items-center justify-between">
      <h2 className="text-left text-lg font-semibold">
        Hi{" "}
        <span className="text-gray-700 inline-block capitalize">{user},</span>
      </h2>
      <button
        type="button"
        onClick={onAddTimer}
        className="btn px-4 py-3 text-base rounded-lg flex items-center gap-2 min-h-[48px] bg-[#0F766E]!"
        aria-label="Timer toevoegen"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Timer toevoegen</span>
      </button>
    </section>
  );
}
