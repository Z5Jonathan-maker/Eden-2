import React from "react";
import { Eye, MailOpen, Send, Star } from "lucide-react";
import { MetricsState } from "./types";

interface Props {
  metrics: MetricsState;
}

const EngagementPanel: React.FC<Props> = ({ metrics }) => {
  const feedbackScore = Number.isFinite(Number(metrics.feedbackScore)) ? Number(metrics.feedbackScore) : 0;
  const cards = [
    { label: "Views", value: metrics.views, icon: Eye, color: "text-blue-400" },
    { label: "Opens", value: metrics.opens, icon: MailOpen, color: "text-emerald-400" },
    { label: "Send Count", value: metrics.sends, icon: Send, color: "text-orange-400" },
    { label: "Feedback", value: feedbackScore.toFixed(1), icon: Star, color: "text-yellow-400" },
  ];

  return (
    <div className="card-tactical p-4">
      <h3 className="font-tactical font-bold text-white uppercase tracking-wide mb-3">Engagement HUD</h3>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((item) => (
          <div key={item.label} className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
            <item.icon className={`w-4 h-4 ${item.color} mb-2`} />
            <p className="text-lg font-tactical text-white">{item.value}</p>
            <p className="text-xs font-mono text-zinc-500 uppercase">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EngagementPanel;
