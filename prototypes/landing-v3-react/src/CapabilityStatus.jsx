import React from "react";
import { motion } from "motion/react";
import manifest from "./generated/capability-scope-manifest.json";

export const STATUS_LABELS = {
  released: "Released",
  early_access: "Early access",
  validation: "Validation",
  research_only: "Research only",
  planned: "Planned",
  locked: "Locked",
};

const byId = new Map(manifest.capabilities.map((capability) => [capability.id, capability]));

export function getCapability(capabilityId) {
  const capability = byId.get(capabilityId);
  if (!capability) {
    throw new Error("Unknown capability id: " + capabilityId);
  }
  return capability;
}

export function StoryCapabilityStatus({ capabilityId }) {
  const capability = getCapability(capabilityId);
  const statusLabel = STATUS_LABELS[capability.status];

  return (
    <span
      className="story-capability"
      data-capability-id={capability.id}
      data-capability-status={capability.status}
    >
      <b>{capability.public_name}</b>
      <em>{statusLabel}</em>
    </span>
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
      <em>{statusLabel}</em>
    </motion.div>
  );
}
