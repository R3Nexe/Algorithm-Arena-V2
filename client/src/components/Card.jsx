import React, { useRef } from "react";
import { clsx } from "clsx";

const ChallengeCard = ({
  children,
  className,
  innerClassName,
  hoverEffect = true,
  // Pass an RGB string like "34, 197, 94" for difficulty cards.
  // Leave undefined for generic cards — they'll use the accent color.
  difficultyColor,
}) => {
  const cardRef = useRef(null);

  // If no difficulty color is provided, use the CSS accent variable at runtime.
  // We read it imperatively so it respects the current light/dark theme.
  const getColor = () => {
    if (difficultyColor) return difficultyColor;
    if (!cardRef.current) return "0, 122, 255";
    return (
      getComputedStyle(cardRef.current)
        .getPropertyValue("--accent-rgb")
        .trim() || "0, 122, 255"
    );
  };

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty("--mouse-x", `${x}px`);
    cardRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    const color = getColor();
    cardRef.current.style.border = `1px solid rgba(${color}, 0.45)`;
    cardRef.current.style.boxShadow = `
      0 0 0 0.5px rgba(${color}, 0.2),
      0 4px 20px rgba(${color}, 0.18),
      0 2px 8px rgba(0, 0, 0, 0.15),
      0 12px 40px rgba(0, 0, 0, 0.1)
    `;
    cardRef.current.style.background = `linear-gradient(
      135deg,
      rgba(${color}, 0.06) 0%,
      rgba(${color}, 0.02) 100%
    )`;
    // Store resolved color so spotlight + shimmer can use it too
    cardRef.current.style.setProperty("--hover-rgb", color);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.border = "";
    cardRef.current.style.boxShadow = "";
    cardRef.current.style.background = "";
  };

  // For spotlight + shimmer we need a CSS variable. Default to accent-rgb,
  // override with difficultyColor if provided.
  const spotlightColor = difficultyColor
    ? difficultyColor
    : "var(--accent-rgb)";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        "relative group overflow-hidden transition-all duration-300",
        "bg-white/5 dark:bg-black/5",
        "border border-black/10 dark:border-white/10",
        "rounded-[2rem] p-8 backdrop-blur-md hover:backdrop-blur-xl",
        hoverEffect && "hover:-translate-y-1",
        className,
      )}
    >
      {/* SPOTLIGHT */}
      <div
        className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(${spotlightColor}, 0.15), transparent 40%)`,
        }}
      />

      {/* Top-edge shimmer */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, rgba(${spotlightColor}, 0.5), transparent)`,
        }}
      />

      <div className={clsx("relative z-10", innerClassName)}>{children}</div>

      {/* Blueprint corners */}
      <div
        className="absolute top-4 left-4 w-2 h-2 border-t border-l opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ borderColor: `rgba(${spotlightColor}, 0.6)` }}
      />
      <div
        className="absolute bottom-4 right-4 w-2 h-2 border-b border-r opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ borderColor: `rgba(${spotlightColor}, 0.6)` }}
      />
    </div>
  );
};

export default ChallengeCard;
