"use client";

export default function NotificationBadge({
  count,
  icon,
  user,
  className = "",
  style = {},
  iconSize = 16,
}) {
  // If icon is provided, use it; otherwise show count or J-icon/pencil based on user
  let content = null;

  if (icon) {
    // Custom icon provided
    content = icon;
  } else if (count !== undefined && count !== null) {
    // Show count as white text
    content = (
      <span className="text-white text-xs font-semibold leading-none">
        {count > 99 ? "99+" : count}
      </span>
    );
  } else if (user === "julian") {
    // Show J-icon for julian
    content = (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 120 100"
        fill="white"
        aria-hidden="true"
      >
        <text
          x="30"
          y="70"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="60"
          fill="white"
        >
          J
        </text>
        <circle cx="75" cy="50" r="6" fill="white" />
      </svg>
    );
  } else if (user === "dire") {
    // Show D-icon for dire
    content = (
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 120 100"
        fill="white"
        aria-hidden="true"
      >
        <text
          x="30"
          y="70"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          fontSize="60"
          fill="white"
        >
          D
        </text>
        <circle cx="85" cy="50" r="6" fill="white" />
      </svg>
    );
  } else {
    // Show pencil icon for other users (smaller than J-icon)
    const pencilSize = Math.round(iconSize * 0.5);
    content = (
      <svg
        width={pencilSize}
        height={pencilSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    );
  }

  return (
    <div
      className={`absolute -top-1 -right-1 z-10 flex items-center justify-center rounded-full bg-red-500 ${
        count !== undefined && count !== null
          ? "min-w-[20px] h-[20px] px-1"
          : "w-[20px] h-[20px]"
      } ${className}`}
      style={style}
      aria-label={count !== undefined ? `${count} notificaties` : "Notificatie"}
    >
      {content}
    </div>
  );
}
