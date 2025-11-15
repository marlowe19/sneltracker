"use client";

function formatHours(totalHours) {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes > 0 ? `${hours}u ${minutes}m` : `${hours}u`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function MemberHoursChart({ memberStats }) {
  if (!memberStats || memberStats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Nog geen tijdentries</p>
      </div>
    );
  }

  const maxHours = Math.max(...memberStats.map((m) => m.totalHours));
  const totalHours = memberStats.reduce((sum, m) => sum + m.totalHours, 0);
  const totalMoney = memberStats.reduce((sum, m) => sum + m.totalMoney, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Totaal uren</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatHours(totalHours)}
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Totaal waarde</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatMoney(totalMoney)}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Uren per lid (staafdiagram)
        </h3>
        <div className="space-y-3">
          {memberStats.map((member) => {
            const percentage =
              maxHours > 0 ? (member.totalHours / maxHours) * 100 : 0;
            return (
              <div key={member.user_name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    {member.user_name}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600">
                      {formatHours(member.totalHours)}
                    </span>
                    <span className="text-gray-600">
                      {formatMoney(member.totalMoney)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {member.entryCount}{" "}
                      {member.entryCount === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-[#008eff] h-4 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pie Chart (simplified as horizontal bars) */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Verdeling per lid (percentage)
        </h3>
        <div className="space-y-2">
          {memberStats.map((member) => {
            const percentage =
              totalHours > 0 ? (member.totalHours / totalHours) * 100 : 0;
            return (
              <div key={member.user_name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    {member.user_name}
                  </span>
                  <span className="text-gray-600 font-semibold">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-purple-500 h-3 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

