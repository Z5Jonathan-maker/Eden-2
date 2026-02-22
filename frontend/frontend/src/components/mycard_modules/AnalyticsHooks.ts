import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { FeedbackPayload, MetricsState } from "./types";

export const calculateEngagementScore = (openRate: number, feedbackScore: number): number => {
  const normalizedOpenRate = Math.max(0, Math.min(openRate, 100));
  const normalizedFeedback = Math.max(0, Math.min(feedbackScore * 20, 100));
  return Math.round(normalizedOpenRate * 0.6 + normalizedFeedback * 0.4);
};

export const updateLeaderboardWithCardEvent = (eventType: string, payload: Record<string, unknown>) => {
  return { eventType, payload, queued: true, at: new Date().toISOString() };
};

interface InitialMetrics {
  total_views?: number;
  unique_visitors?: number;
  shares?: number;
  feedback_score?: number;
  feedback_count?: number;
}

export const useAnalyticsHooks = (initialMetrics: InitialMetrics = {}) => {
  const [metrics, setMetrics] = useState<MetricsState>({
    views: initialMetrics.total_views || 0,
    opens: initialMetrics.unique_visitors || 0,
    sends: initialMetrics.shares || 0,
    feedbackScore: initialMetrics.feedback_score || 0,
    feedbackCount: initialMetrics.feedback_count || 0,
  });

  const trackCardView = (cardId: string) => {
    setMetrics((prev) => ({ ...prev, views: prev.views + 1 }));
    return updateLeaderboardWithCardEvent("view", { cardId });
  };

  const trackCardOpen = (cardId: string) => {
    setMetrics((prev) => ({ ...prev, opens: prev.opens + 1 }));
    return updateLeaderboardWithCardEvent("open", { cardId });
  };

  const trackCardSend = (cardId: string) => {
    setMetrics((prev) => ({ ...prev, sends: prev.sends + 1 }));
    return updateLeaderboardWithCardEvent("send", { cardId });
  };

  const trackCardShare = (cardId: string) => {
    setMetrics((prev) => ({ ...prev, sends: prev.sends + 1 }));
    return updateLeaderboardWithCardEvent("share", { cardId });
  };

  const trackCardFeedback = (cardId: string, feedback: FeedbackPayload) => {
    const rating = Number(feedback?.rating || 0);
    setMetrics((prev) => {
      const nextCount = prev.feedbackCount + 1;
      const nextAvg = (prev.feedbackScore * prev.feedbackCount + rating) / nextCount;
      return {
        ...prev,
        feedbackCount: nextCount,
        feedbackScore: Number(nextAvg.toFixed(2)),
      };
    });
    return updateLeaderboardWithCardEvent("feedback", { cardId, feedback });
  };

  const summary = useMemo(() => {
    const openRate = metrics.views > 0 ? (metrics.opens / metrics.views) * 100 : 0;
    return {
      openRate: Number(openRate.toFixed(2)),
      engagementScore: calculateEngagementScore(openRate, metrics.feedbackScore),
    };
  }, [metrics]);

  return {
    metrics,
    summary,
    trackCardView,
    trackCardOpen,
    trackCardSend,
    trackCardShare,
    trackCardFeedback,
    setMetrics: setMetrics as Dispatch<SetStateAction<MetricsState>>,
  };
};
