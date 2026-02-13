const KEY = 'harvest_knock_metrics';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};

const write = (items) => {
  localStorage.setItem(KEY, JSON.stringify(items.slice(-200)));
};

export const recordKnockMetric = ({ type, durationMs, status, success, error }) => {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    durationMs: Math.round(durationMs),
    status: status || null,
    success: Boolean(success),
    error: error || null,
    createdAt: new Date().toISOString(),
  };

  const next = read();
  next.push(entry);
  write(next);

  window.dispatchEvent(new CustomEvent('harvest:knock-metric', { detail: entry }));
  return entry;
};

export const getKnockMetricsSummary = () => {
  const entries = read();
  if (!entries.length) {
    return { count: 0, avgMs: 0, p95Ms: 0, successRate: 0 };
  }

  const sorted = [...entries].map((e) => e.durationMs).sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const successCount = entries.filter((e) => e.success).length;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

  return {
    count: entries.length,
    avgMs: Math.round(sum / entries.length),
    p95Ms: sorted[p95Index],
    successRate: Math.round((successCount / entries.length) * 100),
  };
};
