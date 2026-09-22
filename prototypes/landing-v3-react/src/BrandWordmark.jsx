import React from "react";

const SOURCES = {
  silver: "/brand/zugrio-wordmark-flat-silver.svg",
  white: "/brand/zugrio-wordmark-flat-white.svg",
  metallic: "/brand/zugrio-wordmark-metallic.svg",
  black: "/brand/zugrio-wordmark-black.svg",
};

export default function BrandWordmark({
  variant = "silver",
  className = "",
  decorative = false,
  eager = false,
}) {
  const src = SOURCES[variant] || SOURCES.silver;

  return (
    <span className={["brand-wordmark", "brand-wordmark-" + variant, className].filter(Boolean).join(" ")}>
      <img
        src={src}
        alt={decorative ? "" : "ZUGRIO"}
        aria-hidden={decorative || undefined}
        draggable="false"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </span>
  );
}
