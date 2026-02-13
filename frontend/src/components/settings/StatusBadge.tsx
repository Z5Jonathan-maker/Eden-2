// @ts-nocheck
import React from "react";

type StatusVariant = "connected" | "not_connected" | "error" | "warning";

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
}

const STATUS_STYLES: Record<StatusVariant, string> = {
  connected: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35",
  not_connected: "bg-slate-700/40 text-slate-300 border border-slate-600/70",
  warning: "bg-amber-500/15 text-amber-300 border border-amber-500/35",
  error: "bg-red-500/15 text-red-300 border border-red-500/35",
};

const STATUS_LABELS: Record<StatusVariant, string> = {
  connected: "Connected",
  not_connected: "Not Connected",
  warning: "Warning",
  error: "Error",
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {label || STATUS_LABELS[status]}
    </span>
  );
};

export default StatusBadge;
