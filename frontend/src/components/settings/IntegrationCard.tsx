// @ts-nocheck
import React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import StatusBadge from "./StatusBadge";

type StatusVariant = "connected" | "not_connected" | "error" | "warning";

interface DetailRow {
  label: string;
  value: string;
}

interface ActionConfig {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

interface IntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: StatusVariant;
  statusLabel?: string;
  healthLabel?: string;
  healthTone?: "green" | "yellow" | "red" | "gray";
  details?: DetailRow[];
  primaryAction?: ActionConfig;
  secondaryAction?: ActionConfig;
  successPulse?: boolean;
  footerLink?: {
    href: string;
    label: string;
  };
}

const HEALTH_DOT_CLASS = {
  green: "bg-emerald-400",
  yellow: "bg-amber-400",
  red: "bg-red-400",
  gray: "bg-slate-500",
};

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  icon,
  title,
  description,
  status,
  statusLabel,
  healthLabel,
  healthTone = "gray",
  details = [],
  primaryAction,
  secondaryAction,
  successPulse = false,
  footerLink,
}) => {
  return (
    <article className="settings-card settings-fade-in">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-slate-700/60 bg-slate-800/60 p-2 text-slate-200">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
        </div>
        <StatusBadge status={status} label={statusLabel} />
      </div>

      {(healthLabel || details.length > 0) && (
        <div className="space-y-2 rounded-lg border border-slate-700/50 bg-slate-900/55 p-3">
          {healthLabel ? (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className={["settings-health-dot", HEALTH_DOT_CLASS[healthTone]].join(" ")} />
              <span>{healthLabel}</span>
            </div>
          ) : null}
          {details.map((detail) => (
            <div key={`${title}-${detail.label}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">{detail.label}</span>
              <span className="font-medium text-slate-200">{detail.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {primaryAction ? (
          <Button
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled || primaryAction.loading}
            variant="outline"
            className="border-slate-600 bg-slate-800/50 text-slate-100 hover:border-slate-500 hover:bg-slate-800"
          >
            {primaryAction.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {primaryAction.label}
            {successPulse ? <CheckCircle2 className="settings-checkmark h-4 w-4 text-emerald-300" /> : null}
          </Button>
        ) : null}

        {secondaryAction ? (
          <Button
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled || secondaryAction.loading}
            variant="ghost"
            className="text-slate-300 hover:bg-slate-800/70 hover:text-slate-100"
          >
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>

      {footerLink ? (
        <a
          className="mt-3 inline-flex text-xs text-slate-400 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-slate-200"
          href={footerLink.href}
          target="_blank"
          rel="noreferrer"
        >
          {footerLink.label}
        </a>
      ) : null}
    </article>
  );
};

export default IntegrationCard;
