"use client";

import { useEffect, useState, useRef } from "react";
import confetti from "canvas-confetti";
import { formatLocalDate } from "@/lib/dateRangeUtils";

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatHours(totalHours) {
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  if (hours === 0) {
    return `${minutes} minuten`;
  }
  if (minutes === 0) {
    return `${hours} ${hours === 1 ? "uur" : "uur"}`;
  }
  return `${hours} ${hours === 1 ? "uur" : "uur"} ${minutes} ${minutes === 1 ? "minuut" : "minuten"}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00"); // Add time to avoid timezone issues
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Animated number counter component
function AnimatedNumber({ value, duration = 2000, formatter = (v) => v }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const startValue = 0;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, value, duration]);

  return (
    <span ref={ref} className="inline-block">
      {formatter(displayValue)}
    </span>
  );
}

// Stat card component
function StatCard({ children, gradient, delay = 0, onVisible }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isVisible) {
          setIsVisible(true);
          if (onVisible) {
            setTimeout(() => onVisible(), delay);
          }
        }
      },
      { threshold: 0.2 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [isVisible, delay, onVisible]);

  return (
    <div
      ref={ref}
      className={`min-h-screen flex items-center justify-center px-4 py-20 transition-all duration-1000 ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-10"
      }`}
      style={{
        background: gradient
          ? `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`
          : "transparent",
      }}
    >
      <div className="max-w-2xl w-full text-center">{children}</div>
    </div>
  );
}

export default function WrappedClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Trigger confetti
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/my/api/wrapped");
        if (!response.ok) {
          throw new Error("Failed to fetch wrapped data");
        }
        const result = await response.json();
        setData(result);
        setLoading(false);

        // Trigger initial confetti after a short delay
        setTimeout(() => {
          triggerConfetti();
        }, 500);
      } catch (err) {
        console.error("Error fetching wrapped data:", err);
        setError(err.message);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-red-500">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-white"></div>
          <p className="mt-4 text-white text-lg">Je jaaroverzicht wordt geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 text-lg">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!data || (data.totalHours === 0 && data.totalMoney === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="text-center text-white px-4">
          <h1 className="text-5xl font-bold mb-4">Je 2025 Wrapped</h1>
          <p className="text-xl">Je hebt nog geen tijd geregistreerd in 2025.</p>
          <p className="text-lg mt-2">Begin met werken om je jaaroverzicht te zien!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Title Card */}
      <StatCard
        gradient={["#667eea", "#764ba2"]}
        onVisible={() => {
          // Confetti already triggered on mount
        }}
      >
        <h1 className="text-6xl md:text-8xl font-black mb-6">
          Je 2025 Wrapped
        </h1>
        <p className="text-2xl md:text-3xl text-gray-300">
          Een overzicht van je jaar
        </p>
      </StatCard>

      {/* Total Money Card */}
      <StatCard
        gradient={["#f093fb", "#f5576c"]}
        delay={200}
        onVisible={triggerConfetti}
      >
        <div className="space-y-4">
          <p className="text-3xl md:text-4xl font-semibold text-gray-300 mb-8">
            In 2025 heb je
          </p>
          <div className="text-7xl md:text-9xl font-black mb-4">
            <AnimatedNumber
              value={data.totalMoney}
              formatter={(v) => formatMoney(v)}
            />
          </div>
          <p className="text-2xl md:text-3xl font-semibold">verdiend 💰</p>
        </div>
      </StatCard>

      {/* Total Hours Card */}
      <StatCard
        gradient={["#4facfe", "#00f2fe"]}
        delay={200}
        onVisible={triggerConfetti}
      >
        <div className="space-y-4">
          <p className="text-3xl md:text-4xl font-semibold text-gray-300 mb-8">
            Je hebt gewerkt
          </p>
          <div className="text-7xl md:text-9xl font-black mb-4">
            <AnimatedNumber
              value={data.totalHours}
              formatter={(v) => Math.round(v)}
            />
          </div>
          <p className="text-2xl md:text-3xl font-semibold">
            {formatHours(data.totalHours)} ⏰
          </p>
        </div>
      </StatCard>

      {/* Most Worked Project Card */}
      {data.mostWorkedProject && (
        <StatCard
          gradient={["#fa709a", "#fee140"]}
          delay={200}
          onVisible={triggerConfetti}
        >
          <div className="space-y-4">
            <p className="text-3xl md:text-4xl font-semibold text-gray-300 mb-8">
              Je werkte het meest aan
            </p>
            <div className="text-5xl md:text-7xl font-black mb-4">
              {data.mostWorkedProject.name}
            </div>
            <p className="text-2xl md:text-3xl font-semibold">
              {formatHours(data.mostWorkedProject.hours)} 🎯
            </p>
          </div>
        </StatCard>
      )}

      {/* Longest Working Day Card */}
      {data.longestDay && (
        <StatCard
          gradient={["#30cfd0", "#330867"]}
          delay={200}
          onVisible={triggerConfetti}
        >
          <div className="space-y-4">
            <p className="text-3xl md:text-4xl font-semibold text-gray-300 mb-8">
              Je langste werkdag was
            </p>
            <div className="text-5xl md:text-7xl font-black mb-4">
              {formatDate(data.longestDay.date)}
            </div>
            <p className="text-2xl md:text-3xl font-semibold">
              {formatHours(data.longestDay.hours)} 🔥
            </p>
          </div>
        </StatCard>
      )}

      {/* Final Card */}
      <StatCard gradient={["#a8edea", "#fed6e3"]} delay={200}>
        <div className="space-y-6">
          <h2 className="text-5xl md:text-6xl font-black mb-4">
            Bedankt voor een geweldig jaar! 🎉
          </h2>
          <p className="text-2xl md:text-3xl text-gray-800">
            Blijf doorgaan in 2026!
          </p>
        </div>
      </StatCard>
    </div>
  );
}

