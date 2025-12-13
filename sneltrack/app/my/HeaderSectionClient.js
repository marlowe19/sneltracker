"use client";

export default function HeaderSectionClient({ user, onAddTimer }) {
  return (
    <section className="p-4 flex items-center justify-between">
      <h2 className="text-left text-lg font-semibold">
        Hi{" "}
        <span className="text-gray-700 inline-block capitalize">{user},</span>
      </h2>
    </section>
  );
}
