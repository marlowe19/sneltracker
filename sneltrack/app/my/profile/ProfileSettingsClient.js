"use client";

import { useState } from "react";
import { Activity, Receipt, ChevronRight } from "@carbon/icons-react";
import FullScreenModal from "@/app/components/FullScreenModal";

const ITEMS = [
  {
    id: "activiteiten",
    title: "Activiteiten",
    subtitle: "Beheer je activiteiten",
    icon: Activity,
    modalTitle: "Activiteiten",
  },
  {
    id: "onkosten",
    title: "Onkosten",
    subtitle: "Beheer je onkosten",
    icon: Receipt,
    modalTitle: "Onkosten",
  },
];

function SettingsListItem({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 py-4 px-0 border-b border-gray-200 last:border-b-0 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#008eff] focus:ring-inset rounded"
    >
      <div className="w-10 h-10 shrink-0 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-500">{subtitle}</div>
      </div>
      <ChevronRight size={20} className="shrink-0 text-gray-400" />
    </button>
  );
}

export default function ProfileSettingsClient() {
  const [openModal, setOpenModal] = useState(null);

  return (
    <>
      <section className="flex flex-col  bg-white rounded-lg overflow-hidden">
        {ITEMS.map((item) => (
          <SettingsListItem
            key={item.id}
            icon={item.icon}
            className="pl-4"
            title={item.title}
            subtitle={item.subtitle}
            onClick={() => setOpenModal(item.id)}
          />
        ))}
      </section>

      {ITEMS.map((item) => (
        <FullScreenModal
          key={item.id}
          isOpen={openModal === item.id}
          onClose={() => setOpenModal(null)}
          title={item.modalTitle}
        >
          <div className="p-4">
            <p className="text-gray-600">
              {item.id === "activiteiten"
                ? "Activiteiten-instellingen – binnenkort beschikbaar."
                : "Onkosten-instellingen – binnenkort beschikbaar."}
            </p>
          </div>
        </FullScreenModal>
      ))}
    </>
  );
}
