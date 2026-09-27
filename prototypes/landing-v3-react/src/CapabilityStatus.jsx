import React from "react";
import { motion } from "motion/react";
import { LockKeyhole } from "lucide-react";
import manifest from "./generated/capability-scope-manifest.json";

export const STATUS_LABELS = {
  released: "Released",
  early_access: "Early access",
  validation: "Validation",
  research_only: "Research only",
  planned: "Planned",
  locked: "Locked",
};

const STATUS_DESCRIPTIONS = {
  released: "Available in the stated scope.",
  early_access: "Available to a limited invited group.",
  validation: "Being tested; not released.",
  research_only: "Evidence and research work; not available for trading use.",
  planned: "Part of the product direction; not yet available.",
  locked: "Deliberately unavailable until separate gates clear.",
};

export const READINESS_META = {
  lifecycleState: manifest.lifecycle_state,
  lastVerifiedDate: manifest.last_verified_date,
};

const byId = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));

export function getCapability(capabilityId) {
  const capability = byId.get(capabilityId);
  if (!capability) {
    throw new Error("Unknown capability id: " + capabilityId);
  }
  return capability;
}

export function StoryCapabilityStatus({ capabilityId, className = "", hideName = false }) {
  const capability = getCapability(capabilityId);
  const statusLabel = STATUS_LABELS[capability.status];

  return (
    <span
      className={["story-capability", className].filter(Boolean).join(" ")}
      data-capability-id={capability.id}
      data-capability-status={capability.status}
    >
      {!hideName && <b>{capability.public_name}</b>}
      <em>{capability.status === "locked" && <LockKeyhole size={11} aria-hidden="true" />}{statusLabel}</em>
    </span>
  );
}

export function ReadinessCapability({ capabilityId, className = "" }) {
  const capability = getCapability(capabilityId);
  const statusLabel = STATUS_LABELS[capability.status];

  return (
    <div
      className={["readiness-capability", className].filter(Boolean).join(" ")}
      data-capability-id={capability.id}
      data-capability-status={capability.status}
    >
      <b>{capability.public_name}</b>
      <em>{capability.status === "locked" && <LockKeyhole size={11} aria-hidden="true" />}{statusLabel}</em>
    </div>
  );
}

export function ReadinessMeta() {
  const date = new Date(READINESS_META.lastVerifiedDate + "T00:00:00");
  const checked = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  return (
    <div className="readiness-meta" aria-label="Zugrio readiness lifecycle">
      <span>PRIVATE VALIDATION</span>
      <i aria-hidden="true" />
      <b>LAST CHECKED {checked.toUpperCase()}</b>
    </div>
  );
}

export function ReadinessLegend() {
  const statusesShownHere = ["validation", "planned", "locked"];

  return (
    <div className="readiness-legend" aria-label="Readiness status meanings">
      {statusesShownHere.map((status, index) => (
        <div className="readiness-legend-row" data-readiness-status={status} key={status}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <b>{STATUS_LABELS[status]}</b>
          <p>{STATUS_DESCRIPTIONS[status]}</p>
          {status === "locked" && <LockKeyhole size={11} aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}

export default function CapabilityStatus({ capabilityId, index = 0 }) {
  const capability = getCapability(capabilityId);
  const statusLabel = STATUS_LABELS[capability.status];

  return (
    <motion.div
      data-capability-id={capability.id}
      data-capability-status={capability.status}
      initial={{ opacity: 0, x: 22 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: .56, delay: index * .065, ease: [0.16, 1, 0.3, 1] }}
    >
      <b>{capability.public_name}</b>
      <span>{capability.scope}</span>
      <em>{capability.status === "locked" && <LockKeyhole size={11} aria-hidden="true" />}{statusLabel}</em>
    </motion.div>
  );
}
