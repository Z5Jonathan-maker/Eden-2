import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, FileText, UserPlus, RefreshCw,
  Wifi, WifiOff, X, Flame, Trophy, MessageSquare, AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Button } from '../shared/ui/button';
import { apiGet, apiPut, API_URL } from '@/lib/api';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
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

  // Connect to WebSocket
  // Note: WebSocket can't use httpOnly cookies, so we rely on polling fallback
  const connectWebSocket = useCallback(() => {
    // WebSocket auth with httpOnly cookies is not supported
    // Fall back to polling which works with httpOnly cookies
    startPolling();
    return undefined;

    /* WebSocket connection disabled - httpOnly cookies don't work with WebSocket URLs
    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');

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
        setWsConnected(true);
        stopPolling();

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'notification') {
            setNotifications(prev => [data.data, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        setWsConnected(false);
        wsRef.current = null;

        startPolling();

        if (event.code !== 1000 && event.code !== 4001) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 10000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
      };

      wsRef.current = ws;

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
      console.error('WebSocket creation failed:', e);
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
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
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

  // Notification Item Component
  const NotificationItem = ({ notification }) => {
    const typeLabel = getNotificationTypeLabel(notification.type);
    
    return (
      <div
        onClick={() => handleNotificationClick(notification)}
        className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
          !notification.is_read ? 'bg-orange-50' : ''
        }`}
        data-testid={`notification-${notification.id}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex-shrink-0">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            {typeLabel && (
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {typeLabel}
              </span>
            )}
            <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''} text-gray-900 mt-0.5`}>
              {notification.title}
            </p>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {notification.body || notification.message}
            </p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
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
  };

  // Mobile Full-Screen Modal
  if (isMobile && isOpen) {
    return (
      <>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="notification-bell"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
        
        {/* Full Screen Modal */}
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
              {wsConnected ? (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3" />
                  Live
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* Actions Bar */}
          {unreadCount > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-orange-600 font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all as read ({unreadCount})
              </button>
            </div>
          )}
          
          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No notifications yet</p>
                <p className="text-sm text-gray-400 mt-1">
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
        className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-gray-300'}`} 
        title={wsConnected ? 'Real-time connected' : 'Reconnecting...'} 
      />
      
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden" style={{ top: '100%' }}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Notifications</h3>
              {wsConnected ? (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3" />
                  Live
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  Offline
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
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
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No notifications</p>
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
