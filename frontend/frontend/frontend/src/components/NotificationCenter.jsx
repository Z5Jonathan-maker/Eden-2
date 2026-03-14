import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bell, CheckCheck, RefreshCw, Camera, Brain, ShieldAlert,
  TrendingUp, Mail, BarChart3
} from 'lucide-react';

const NOTIFICATION_TYPES = {
  status_change: { icon: RefreshCw, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  upload: { icon: Camera, color: 'text-green-400', bg: 'bg-green-500/10' },
  ai_complete: { icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  compliance: { icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  prediction: { icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  carrier: { icon: Mail, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  report: { icon: BarChart3, color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
};

const INITIAL_NOTIFICATIONS = [
  {
    id: 'n1',
    type: 'status_change',
    title: 'Claim #1847 status changed to Under Review',
    description: 'Carrier adjuster initiated review process for wind damage claim.',
    timestamp: Date.now() - 2 * 60 * 1000,
    read: false,
  },
  {
    id: 'n2',
    type: 'upload',
    title: 'New inspection photos uploaded for #2156',
    description: '14 photos added to the roof damage inspection set.',
    timestamp: Date.now() - 60 * 60 * 1000,
    read: false,
  },
  {
    id: 'n3',
    type: 'ai_complete',
    title: 'Eve AI completed analysis on Claim #1392',
    description: 'Damage assessment and settlement estimate ready for review.',
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
    read: false,
  },
  {
    id: 'n4',
    type: 'compliance',
    title: 'ComplianceWatch: 3 claims approaching 90-day deadline',
    description: 'Claims #1201, #1340, #1455 require action within 72 hours.',
    timestamp: Date.now() - 5 * 60 * 60 * 1000,
    read: false,
  },
  {
    id: 'n5',
    type: 'prediction',
    title: 'Settlement prediction ready for #2089',
    description: 'AI model predicts $14,200 - $18,500 range with 87% confidence.',
    timestamp: Date.now() - 26 * 60 * 60 * 1000,
    read: true,
  },
  {
    id: 'n6',
    type: 'carrier',
    title: 'Carrier response received for #1756',
    description: 'Citizens Insurance issued partial approval. Review recommended.',
    timestamp: Date.now() - 30 * 60 * 60 * 1000,
    read: true,
  },
  {
    id: 'n7',
    type: 'report',
    title: 'Monthly performance report available',
    description: 'March 2026 metrics: 47 claims processed, 92% approval rate.',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
    read: true,
  },
];

const formatTimestamp = (ts) => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
};

const getDateGroup = (ts) => {
  const now = new Date();
  const date = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;

  if (ts >= todayStart) return 'Today';
  if (ts >= yesterdayStart) return 'Yesterday';
  return 'Earlier';
};

const groupNotifications = (notifications) => {
  const groups = {};
  const order = ['Today', 'Yesterday', 'Earlier'];

  for (const n of notifications) {
    const group = getDateGroup(n.timestamp);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(n);
  }

  return order
    .filter((g) => groups[g]?.length > 0)
    .map((label) => ({ label, items: groups[label] }));
};

const NotificationIcon = ({ type }) => {
  const config = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.report;
  const Icon = config.icon;

  return (
    <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-4 h-4 ${config.color}`} />
    </div>
  );
};

const NotificationItem = React.memo(({ notification, onClick }) => (
  <button
    onClick={() => onClick(notification.id)}
    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-150 hover:bg-zinc-800/50 group ${
      !notification.read ? 'border-l-2 border-l-orange-500 bg-orange-500/[0.03]' : 'border-l-2 border-l-transparent'
    }`}
    data-testid={`notification-item-${notification.id}`}
  >
    <NotificationIcon type={notification.type} />
    <div className="flex-1 min-w-0">
      <p className={`text-sm leading-snug ${!notification.read ? 'text-zinc-100 font-semibold' : 'text-zinc-300'}`}>
        {notification.title}
      </p>
      <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
        {notification.description}
      </p>
      <p className="text-xs text-zinc-500 font-mono mt-1.5">
        {formatTimestamp(notification.timestamp)}
      </p>
    </div>
    {!notification.read && (
      <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0 shadow-[0_0_6px_rgba(249,115,22,0.4)]" />
    )}
  </button>
));

NotificationItem.displayName = 'NotificationItem';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);

  const handleClickOutside = useCallback((e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, handleClickOutside]);

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleNotificationClick = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={togglePanel}
        className="relative p-2 rounded-lg text-zinc-400 hover:text-orange-400 hover:bg-zinc-800/50 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        data-testid="notification-center-bell"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white px-1 shadow-[0_0_8px_rgba(249,115,22,0.4)] animate-scale-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-96 bg-[#1a1a1a] border border-zinc-700/50 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in"
          style={{ top: '100%' }}
          role="dialog"
          aria-label="Notification panel"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-700/50 flex items-center justify-between bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-tactical font-bold text-zinc-100 tracking-wide">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-orange-500/15 text-orange-400 text-[11px] font-bold px-1.5">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2"
                data-testid="notification-center-mark-all"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto scrollbar-hide">
            {grouped.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">All caught up</p>
                <p className="text-xs text-zinc-600 mt-1">No notifications to show</p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/50">
                    <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onClick={handleNotificationClick}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-zinc-700/50 bg-[#1a1a1a]">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2"
              data-testid="notification-center-view-all"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
