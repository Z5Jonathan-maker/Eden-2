import { SEVERITY_STYLES } from './config';

export default function SeverityBadge({ level, label }) {
  const style = SEVERITY_STYLES[level] || SEVERITY_STYLES.low;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} ring-1 ${style.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.text.replace('text-', 'bg-')}`} />
      {label || style.label}
    </span>
  );
}
