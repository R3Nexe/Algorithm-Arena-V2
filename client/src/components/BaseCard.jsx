import React, { useRef } from "react";
import { clsx } from "clsx";

/**
 * BaseCard — a general-purpose surface component.
 *
 * Props
 * ─────────────────────────────────────────────
 * children        ReactNode   Card content.
 *
 * className       string      Extra classes merged on top of defaults.
 *
 * accentColor     string      An RGB triplet like "34, 197, 94" used for the
 *                             spotlight, shimmer and hover border.
 *                             Defaults to the CSS `--accent-rgb` variable.
 *
 * hover           boolean     When true (default), enables the mouse-tracking
 *                             spotlight + shimmer and a subtle lift on hover.
 *                             Set to false for static / non-interactive cards.
 *
 * variant         string      Controls the base background style:
 *                               "glass"   – translucent (default)
 *                               "solid"   – solid surface (glass-surface color)
 *                               "ghost"   – completely transparent, border only
 *
 * noPadding       boolean     When true, removes the default p-6 padding so the
 *                             consumer controls spacing entirely.
 *
 * as              string      The HTML element to render ("div" by default).
 *                             Pass "section", "article", "li", etc. as needed.
 *
 * All other props (onClick, aria-*, data-*, style …) are forwarded to the
 * root element.
 */
const BaseCard = ({
  children,
  className,
  accentColor,
  hover = true,
  variant = "glass",
  noPadding = false,
  as: Tag = "div",
  style,
  ...rest
}) => {
  const cardRef = useRef(null);

  /* ── resolve the accent RGB at runtime so it responds to theme changes ── */
  const resolveColor = () => {
    if (accentColor) return accentColor;
    if (!cardRef.current) return "0, 122, 255";
    return (
      getComputedStyle(cardRef.current)
        .getPropertyValue("--accent-rgb")
        .trim() || "0, 122, 255"
    );
  };

  /* ── variant → base bg class ── */
  const variantClass = {
    glass: "bg-white/5 dark:bg-black/5",
    solid: "bg-[var(--glass-surface)]",
    ghost: "bg-transparent",
  }[variant] ?? "bg-white/5 dark:bg-black/5";

  /* ── mouse-tracking handlers (only wired when hover=true) ── */
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const { left, top } = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty("--mouse-x", `${e.clientX - left}px`);
    cardRef.current.style.setProperty("--mouse-y", `${e.clientY - top}px`);
  };

  const handleMouseEnter = () => {
    if (!cardRef.current) return;
    const color = resolveColor();
    cardRef.current.style.border = `1px solid rgba(${color}, 0.4)`;
    cardRef.current.style.boxShadow = `
      0 0 0 0.5px rgba(${color}, 0.15),
      0 4px 20px rgba(${color}, 0.14),
      0 2px 8px rgba(0, 0, 0, 0.12)
    `;
    cardRef.current.style.background = `linear-gradient(
      135deg,
      rgba(${color}, 0.05) 0%,
      rgba(${color}, 0.015) 100%
    )`;
    cardRef.current.style.setProperty("--hover-rgb", color);
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.border = "";
    cardRef.current.style.boxShadow = "";
    cardRef.current.style.background = "";
  };

  /* ── spotlight color for pseudo-layers ── */
  const spotRgb = accentColor ?? "var(--accent-rgb)";

  return (
    <Tag
      ref={cardRef}
      className={clsx(
        "relative group overflow-hidden transition-all duration-300",
        variantClass,
        "border border-black/[0.07] dark:border-white/[0.07]",
        "rounded-2xl",
        !noPadding && "p-6",
        hover && "hover:-translate-y-0.5",
        className,
      )}
      style={{
        "--accent-rgb": spotRgb,
        ...style,
      }}
      onMouseMove={hover ? handleMouseMove : undefined}
      onMouseEnter={hover ? handleMouseEnter : undefined}
      onMouseLeave={hover ? handleMouseLeave : undefined}
      {...rest}
    >
      {/* ── Mouse-tracking spotlight (only rendered when hover=true) ── */}
      {hover && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(500px circle at var(--mouse-x) var(--mouse-y), rgba(${spotRgb}, 0.12), transparent 40%)`,
          }}
        />
      )}

      {/* ── Top-edge shimmer (only rendered when hover=true) ── */}
      {hover && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(${spotRgb}, 0.45), transparent)`,
          }}
        />
      )}

      {/* ── Content layer ── */}
      <div className="relative z-10">{children}</div>

      {/* ── Blueprint corner accents (only when hover=true) ── */}
      {hover && (
        <>
          <div
            aria-hidden
            className="absolute top-3 left-3 w-2 h-2 border-t border-l opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ borderColor: `rgba(${spotRgb}, 0.55)` }}
          />
          <div
            aria-hidden
            className="absolute bottom-3 right-3 w-2 h-2 border-b border-r opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ borderColor: `rgba(${spotRgb}, 0.55)` }}
          />
        </>
      )}
    </Tag>
  );
};

export default BaseCard;
