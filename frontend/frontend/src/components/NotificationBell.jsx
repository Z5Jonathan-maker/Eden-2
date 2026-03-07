import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, FileText, UserPlus, RefreshCw,
  Wifi, WifiOff, X, Flame, Trophy, MessageSquare, AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Button } from '../shared/ui/button';
import { apiGet, apiPut, API_URL, getAuthToken } from '@/lib/api';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const dropdownRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Track screen size for responsive UI
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Polling fallback
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;
    
    // console.log('Starting notification polling');
    pollIntervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, 15000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      // console.log('Stopping notification polling');
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket with message-based JWT auth
  // Backend accepts: connect → send {"type":"auth","token":"<jwt>"} → authenticated
  const connectWebSocket = useCallback(() => {
    const token = getAuthToken();
    if (!token) {
      // No JWT token — fall back to polling
      startPolling();
      return undefined;
    }

    const wsUrl = (API_URL || '').replace('https://', 'wss://').replace('http://', 'ws://');
    if (!wsUrl) {
      startPolling();
      return undefined;
    }

    try {
      const ws = new WebSocket(`${wsUrl}/ws/notifications`);

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          startPolling();
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        // Send auth message with JWT token (Method 2: message-based auth)
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            // Auth confirmed — switch from polling to WebSocket
            setWsConnected(true);
            stopPolling();
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
            }
          } else if (data.type === 'notification') {
            setNotifications(prev => [data.data, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        } catch (e) {
          // Ignore non-JSON messages (e.g. "pong")
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        setWsConnected(false);
        wsRef.current = null;
        startPolling();

        // Auto-reconnect unless intentional close or auth failure
        if (event.code !== 1000 && event.code !== 4001) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 10000);
        }
      };

      ws.onerror = () => {
        clearTimeout(connectionTimeout);
      };

      wsRef.current = ws;

      // Keep-alive ping every 25 seconds
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 25000);

      return () => {
        clearInterval(pingInterval);
        clearTimeout(connectionTimeout);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Component unmounting');
        }
      };
    } catch (e) {
      startPolling();
      return undefined;
    }
  }, [startPolling, stopPolling]);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
    
    const cleanup = connectWebSocket();
    
    return () => {
      if (cleanup) cleanup();
      stopPolling();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connectWebSocket, stopPolling]);

  useEffect(() => {
    // Close dropdown when clicking outside (desktop only)
    const handleClickOutside = (event) => {
      if (!isMobile && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile]);

  // Lock body scroll when mobile modal is open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/notifications?limit=30');
      if (res.ok) {
        setNotifications(res.data.notifications || res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await apiGet('/api/notifications/unread-count');
      if (res.ok) {
        setUnreadCount(res.data.unread_count || res.data.count || 0);
        setPollingActive(true);
      } else {
        setPollingActive(false);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
      setPollingActive(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      try {
        const res = await apiPut(`/api/notifications/${notification.id}/read`);
        if (res.ok) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    // Navigate to cta_route if available, otherwise fallback to claim_id
    if (notification.cta_route) {
      navigate(notification.cta_route);
      setIsOpen(false);
    } else if (notification.claim_id) {
      navigate(`/claims/${notification.claim_id}`);
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await apiPut('/api/notifications/read-all');
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'harvest_coach':
        return <Flame className="w-4 h-4 text-orange-500" />;
      case 'claims_ops':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'comms_bot':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'claim_created':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'claim_assigned':
        return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'claim_status_changed':
        return <RefreshCw className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'harvest_coach':
        return 'Harvest Coach';
      case 'claims_ops':
        return 'Claims Ops';
      case 'comms_bot':
        return 'Communications';
      default:
        return null;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Notification Item Component (memoized — renders inside list map)
  const NotificationItem = React.memo(({ notification }) => {
    const typeLabel = getNotificationTypeLabel(notification.type);
    
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleNotificationClick(notification)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotificationClick(notification); } }}
        className={`p-4 border-b border-zinc-700 hover:bg-zinc-700/50 cursor-pointer transition-colors ${
          !notification.is_read ? 'bg-orange-500/10' : ''
        }`}
        data-testid={`notification-${notification.id}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex-shrink-0">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            {typeLabel && (
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                {typeLabel}
              </span>
            )}
            <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''} text-zinc-100 mt-0.5`}>
              {notification.title}
            </p>
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">
              {notification.body || notification.message}
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-zinc-500">
                {formatTime(notification.created_at)}
              </p>
              {notification.cta_label && (
                <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                  {notification.cta_label}
                  <ChevronRight className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
          {!notification.is_read && (
            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
          )}
        </div>
      </div>
    );
  });

  // Mobile Full-Screen Modal
  if (isMobile && isOpen) {
    return (
      <>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative p-2 hover:bg-zinc-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            aria-label="Notifications"
            data-testid="notification-bell"
          >
            <Bell className="w-5 h-5 text-zinc-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Full Screen Modal */}
        <div className="fixed inset-0 z-50 bg-zinc-900 flex flex-col" role="dialog" aria-modal="true" aria-label="Notifications">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-700 bg-zinc-800">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-zinc-100">Notifications</h2>
              {(wsConnected || pollingActive) ? (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3" />
                  {wsConnected ? 'Live' : 'Polling'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  Connecting...
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-zinc-700 rounded-full focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2"
              aria-label="Close notifications"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Actions Bar */}
          {unreadCount > 0 && (
            <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-orange-500 font-medium flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all as read ({unreadCount})
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-zinc-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No notifications yet</p>
                <p className="text-sm text-zinc-500 mt-1">
                  We'll notify you about important updates here
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop Dropdown
  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      {/* Connection status indicator */}
      <div
        className={`w-2 h-2 rounded-full ${(wsConnected || pollingActive) ? 'bg-green-500' : 'bg-gray-300'}`}
        title={(wsConnected || pollingActive) ? 'Connected' : 'Connecting...'}
      />
      
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 hover:bg-zinc-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        aria-label="Notifications"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-zinc-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-zinc-800 rounded-xl shadow-xl border border-zinc-700 z-50 overflow-hidden" style={{ top: '100%' }}>
          {/* Header */}
          <div className="p-4 border-b border-zinc-700 flex items-center justify-between bg-zinc-800/80">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-zinc-100">Notifications</h3>
              {(wsConnected || pollingActive) ? (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3" />
                  {wsConnected ? 'Live' : 'Polling'}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  Connecting...
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2"
                data-testid="mark-all-read"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-zinc-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
