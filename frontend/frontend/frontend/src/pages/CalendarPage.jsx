import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, MapPin,
  User, FileText, Search, Filter, List, Grid3X3, LayoutGrid, Columns,
  AlertCircle, Loader2, X, Phone, Users, Flag, Eye, Zap, Timer,
  CalendarDays, CalendarCheck, ArrowRight, PanelRightOpen, PanelRightClose,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from '../shared/ui/dialog';
import { Input } from '../shared/ui/input';
import { Textarea } from '../shared/ui/textarea';
import { Label } from '../shared/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../shared/ui/select';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'inspection', label: 'Inspection', color: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: Eye },
  { value: 'follow_up', label: 'Follow-up', color: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', icon: Phone },
  { value: 'carrier_call', label: 'Carrier Call', color: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: Phone },
  { value: 'client_meeting', label: 'Client Meeting', color: 'bg-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', icon: Users },
  { value: 'deadline', label: 'Deadline', color: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', icon: Flag },
  { value: 'other', label: 'Other', color: 'bg-zinc-500', text: 'text-zinc-400', bg: 'bg-zinc-500/15', border: 'border-zinc-500/30', icon: CalendarIcon },
];

const EVENT_TYPE_MAP = Object.fromEntries(EVENT_TYPES.map(t => [t.value, t]));

const VIEWS = [
  { value: 'month', label: 'Month', icon: Grid3X3 },
  { value: 'week', label: 'Week', icon: Columns },
  { value: 'day', label: 'Day', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: List },
];

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am-6pm
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_OF_WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const REMINDER_OPTIONS = [
  { value: 'none', label: 'No reminder' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTimeRange = (start, end) => `${formatTime(start)} - ${formatTime(end)}`;

const isSameDay = (d1, d2) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const isToday = (date) => isSameDay(date, new Date());

const isPast = (dateStr) => new Date(dateStr) < new Date();

const getTimePosition = (dateStr) => {
  const d = new Date(dateStr);
  const hours = d.getHours() - 8;
  const minutes = d.getMinutes();
  return Math.max(0, (hours * 60 + minutes) / 60);
};

const getEventDuration = (start, end) => {
  const diff = (new Date(end) - new Date(start)) / (1000 * 60 * 60);
  return Math.max(0.5, diff);
};

const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days = [];

  // Previous month fill
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, prevMonthLast - i), isCurrentMonth: false });
  }
  // Current month
  for (let i = 1; i <= totalDays; i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  // Next month fill (always show 6 rows)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }
  return days;
};

const getWeekDays = (date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
};

const getCountdown = (dateStr) => {
  const diff = new Date(dateStr) - new Date();
  if (diff < 0) return 'Overdue';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getDateRangeForView = (date, view) => {
  const d = new Date(date);
  let start, end;
  if (view === 'month') {
    start = new Date(d.getFullYear(), d.getMonth(), 1);
    start.setDate(start.getDate() - start.getDay());
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));
  } else if (view === 'week') {
    start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    end = new Date(start);
    end.setDate(start.getDate() + 6);
  } else {
    start = new Date(d);
    end = new Date(d);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

const defaultFormState = () => ({
  title: '',
  event_type: 'inspection',
  date: new Date().toISOString().split('T')[0],
  start_time: '09:00',
  end_time: '10:00',
  claim_id: '',
  claim_search: '',
  assigned_to: '',
  location: '',
  description: '',
  reminder: 'none',
});

// ─── Sub-Components ──────────────────────────────────────────────────────────

const EventTypeBadge = ({ type, size = 'sm' }) => {
  const config = EVENT_TYPE_MAP[type] || EVENT_TYPE_MAP.other;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text} ${config.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.color}`} />
      {size !== 'dot' && config.label}
    </span>
  );
};

const EventDot = ({ type }) => {
  const config = EVENT_TYPE_MAP[type] || EVENT_TYPE_MAP.other;
  return <span className={`h-1.5 w-1.5 rounded-full ${config.color} shrink-0`} />;
};

const OverduePulse = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
  </span>
);

const LoadingSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-8 bg-zinc-800/50 rounded-lg w-48" />
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="h-24 bg-zinc-800/30 rounded-lg" />
      ))}
    </div>
  </div>
);

const EmptyState = ({ view }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="w-20 h-20 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-6 border border-white/5">
      <CalendarDays className="w-10 h-10 text-zinc-600" />
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">No events scheduled</h3>
    <p className="text-zinc-500 text-sm max-w-sm mb-6">
      Your {view} view is clear. Schedule inspections, calls, and meetings to keep your claims moving.
    </p>
    <div className="flex gap-2 flex-wrap justify-center">
      {EVENT_TYPES.slice(0, 4).map(et => (
        <span key={et.value} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${et.bg} ${et.text} ${et.border} opacity-50`}>
          <span className={`h-1.5 w-1.5 rounded-full ${et.color}`} />
          {et.label}
        </span>
      ))}
    </div>
  </div>
);

// ─── Event Card (reusable) ───────────────────────────────────────────────────

const EventCard = ({ event, compact = false, onClick }) => {
  const config = EVENT_TYPE_MAP[event.event_type] || EVENT_TYPE_MAP.other;
  const overdue = event.event_type === 'deadline' && isPast(event.start);
  const navigate = useNavigate();

  const handleClaimClick = (e) => {
    e.stopPropagation();
    if (event.claim_id) {
      navigate(`/claims/${event.claim_id}`);
    }
  };

  if (compact) {
    return (
      <button
        onClick={() => onClick?.(event)}
        className={`w-full text-left rounded-md px-1.5 py-0.5 text-[11px] leading-tight truncate border transition-all hover:brightness-125 ${config.bg} ${config.text} ${config.border}`}
      >
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick?.(event)}
      className={`group w-full text-left rounded-xl border p-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg ${config.bg} ${config.border} hover:brightness-110`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {overdue && <OverduePulse />}
            <span className="text-sm font-medium text-white truncate">{event.title}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeRange(event.start, event.end)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3" />
                {event.location}
              </span>
            )}
          </div>
        </div>
        <EventTypeBadge type={event.event_type} />
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs">
        {event.claim_number && (
          <button
            onClick={handleClaimClick}
            className="flex items-center gap-1 text-orange-400 hover:text-orange-300 hover:underline transition-colors"
          >
            <FileText className="w-3 h-3" />
            #{event.claim_number}
          </button>
        )}
        {event.assigned_to_name && (
          <span className="flex items-center gap-1 text-zinc-500">
            <User className="w-3 h-3" />
            {event.assigned_to_name}
          </span>
        )}
      </div>
    </button>
  );
};

// ─── Month View ──────────────────────────────────────────────────────────────

const MonthView = ({ currentDate, events, onEventClick, onDayClick }) => {
  const days = useMemo(
    () => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const key = new Date(ev.start).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-zinc-900/60">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="px-2 py-2.5 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-white/5">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map(({ date, isCurrentMonth }, i) => {
          const dayEvents = eventsByDate[date.toDateString()] || [];
          const today = isToday(date);
          return (
            <button
              key={i}
              onClick={() => onDayClick(date)}
              className={`relative min-h-[100px] lg:min-h-[120px] p-1.5 border-b border-r border-white/5 text-left transition-colors hover:bg-zinc-800/30 ${!isCurrentMonth ? 'opacity-30' : ''}`}
            >
              <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-medium ${today ? 'bg-orange-500 text-white' : 'text-zinc-300'}`}>
                {date.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <EventCard key={ev._id || ev.id} event={ev} compact onClick={onEventClick} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="block text-[10px] text-zinc-500 pl-1">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── Week View ───────────────────────────────────────────────────────────────

const WeekView = ({ currentDate, events, onEventClick }) => {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const key = new Date(ev.start).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const nowPosition = useMemo(() => {
    const now = new Date();
    return getTimePosition(now.toISOString());
  }, []);

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-zinc-900/60 border-b border-white/5">
        <div className="p-2" />
        {weekDays.map((d, i) => {
          const today = isToday(d);
          return (
            <div key={i} className={`p-2 text-center border-l border-white/5 ${today ? 'bg-orange-500/5' : ''}`}>
              <div className="text-xs text-zinc-500 uppercase">{DAYS_OF_WEEK[i]}</div>
              <div className={`text-lg font-semibold mt-0.5 ${today ? 'text-orange-400' : 'text-white'}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      {/* Time grid */}
      <div className="relative max-h-[calc(100vh-320px)] overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Time labels + grid rows */}
          {HOURS.map(hour => (
            <React.Fragment key={hour}>
              <div className="h-16 flex items-start justify-end pr-2 pt-0.5">
                <span className="text-[11px] text-zinc-600 font-medium">
                  {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'p' : 'a'}
                </span>
              </div>
              {weekDays.map((d, di) => (
                <div key={di} className="h-16 border-l border-b border-white/5 relative" />
              ))}
            </React.Fragment>
          ))}
        </div>
        {/* Event overlays */}
        <div className="absolute inset-0 grid grid-cols-[60px_repeat(7,1fr)] pointer-events-none">
          <div /> {/* spacer for time column */}
          {weekDays.map((d, di) => {
            const dayEvents = eventsByDate[d.toDateString()] || [];
            const today = isToday(d);
            return (
              <div key={di} className="relative border-l border-white/5">
                {/* Current time indicator */}
                {today && nowPosition >= 0 && nowPosition <= 10 && (
                  <div
                    className="absolute left-0 right-0 z-10"
                    style={{ top: `${nowPosition * 64}px` }}
                  >
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500 -ml-1" />
                      <div className="flex-1 h-[2px] bg-orange-500" />
                    </div>
                  </div>
                )}
                {dayEvents.map(ev => {
                  const top = getTimePosition(ev.start) * 64;
                  const height = Math.max(32, getEventDuration(ev.start, ev.end) * 64);
                  const config = EVENT_TYPE_MAP[ev.event_type] || EVENT_TYPE_MAP.other;
                  return (
                    <button
                      key={ev._id || ev.id}
                      onClick={() => onEventClick(ev)}
                      className={`absolute left-0.5 right-0.5 rounded-lg border px-2 py-1 text-left cursor-pointer pointer-events-auto transition-all hover:brightness-125 hover:z-20 hover:shadow-lg ${config.bg} ${config.border}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className={`text-xs font-medium truncate ${config.text}`}>{ev.title}</div>
                      {height >= 48 && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">{formatTime(ev.start)}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Day View ────────────────────────────────────────────────────────────────

const DayView = ({ currentDate, events, onEventClick }) => {
  const dayEvents = useMemo(
    () => events.filter(ev => isSameDay(new Date(ev.start), currentDate)),
    [events, currentDate]
  );

  const today = isToday(currentDate);
  const nowPosition = useMemo(() => {
    const now = new Date();
    return getTimePosition(now.toISOString());
  }, []);

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900/60 border-b border-white/5 p-4">
        <div className={`text-lg font-semibold ${today ? 'text-orange-400' : 'text-white'}`}>
          {DAYS_OF_WEEK_FULL[currentDate.getDay()]}, {MONTHS[currentDate.getMonth()]} {currentDate.getDate()}
        </div>
        <div className="text-sm text-zinc-500 mt-0.5">
          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
        </div>
      </div>
      {/* Time grid */}
      <div className="relative max-h-[calc(100vh-380px)] overflow-y-auto">
        {HOURS.map(hour => (
          <div key={hour} className="flex border-b border-white/5">
            <div className="w-16 shrink-0 flex items-start justify-end pr-3 pt-1">
              <span className="text-xs text-zinc-600 font-medium">
                {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
              </span>
            </div>
            <div className="flex-1 h-16 relative" />
          </div>
        ))}
        {/* Current time line */}
        {today && nowPosition >= 0 && nowPosition <= 10 && (
          <div
            className="absolute left-16 right-0 z-10"
            style={{ top: `${nowPosition * 64}px` }}
          >
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-orange-500 -ml-1.5" />
              <div className="flex-1 h-[2px] bg-orange-500" />
            </div>
          </div>
        )}
        {/* Event blocks */}
        {dayEvents.map(ev => {
          const top = getTimePosition(ev.start) * 64;
          const height = Math.max(48, getEventDuration(ev.start, ev.end) * 64);
          return (
            <div
              key={ev._id || ev.id}
              className="absolute left-20 right-4"
              style={{ top: `${top}px`, height: `${height}px` }}
            >
              <EventCard event={ev} onClick={onEventClick} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── List View ───────────────────────────────────────────────────────────────

const ListView = ({ events, onEventClick }) => {
  const groupedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
    const groups = {};
    sorted.forEach(ev => {
      const key = new Date(ev.start).toDateString();
      if (!groups[key]) groups[key] = { date: new Date(ev.start), events: [] };
      groups[key].events.push(ev);
    });
    return Object.values(groups);
  }, [events]);

  if (groupedEvents.length === 0) return <EmptyState view="list" />;

  return (
    <div className="space-y-6">
      {groupedEvents.map(group => {
        const today = isToday(group.date);
        return (
          <div key={group.date.toDateString()}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${today ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'bg-zinc-800/50 text-zinc-400 border border-white/5'}`}>
                {today && <span className="h-2 w-2 rounded-full bg-orange-500" />}
                {today ? 'Today' : group.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="space-y-2 pl-2">
              {group.events.map(ev => (
                <EventCard key={ev._id || ev.id} event={ev} onClick={onEventClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const UpcomingSidebar = ({ isOpen, onToggle }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-upcoming'],
    queryFn: () => apiGet('/api/calendar/upcoming'),
    refetchInterval: 60000,
  });

  const upcoming = data?.data || [];
  const navigate = useNavigate();

  return (
    <div className={`transition-all duration-300 ${isOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
      <Card tactical className="h-full ml-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Timer className="w-4 h-4 text-orange-400" />
              Upcoming
            </CardTitle>
            <Button variant="tacticalGhost" size="icon" onClick={onToggle} className="h-7 w-7">
              <PanelRightClose className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 bg-zinc-800/50 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800/30 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="text-center py-8">
              <CalendarCheck className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-600">All clear for now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 5).map(ev => {
                const config = EVENT_TYPE_MAP[ev.event_type] || EVENT_TYPE_MAP.other;
                const overdue = ev.event_type === 'deadline' && isPast(ev.start);
                return (
                  <div
                    key={ev._id || ev.id}
                    className="group rounded-lg border border-white/5 p-2.5 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    onClick={() => {}}
                  >
                    <div className="flex items-start gap-2">
                      {overdue ? <OverduePulse /> : <EventDot type={ev.event_type} />}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{ev.title}</div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          {formatDate(ev.start)} at {formatTime(ev.start)}
                        </div>
                        {ev.claim_number && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/claims/${ev.claim_id}`); }}
                            className="text-[11px] text-orange-400/70 hover:text-orange-400 mt-0.5 flex items-center gap-1"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            #{ev.claim_number}
                          </button>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono ${overdue ? 'text-red-400' : 'text-zinc-600'}`}>
                        {getCountdown(ev.start)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── New Event Dialog ────────────────────────────────────────────────────────

const NewEventDialog = ({ open, onOpenChange, editEvent, teamMembers }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultFormState);
  const [claimResults, setClaimResults] = useState([]);
  const [searchingClaims, setSearchingClaims] = useState(false);

  useEffect(() => {
    if (editEvent) {
      const start = new Date(editEvent.start);
      const end = new Date(editEvent.end);
      setForm({
        title: editEvent.title || '',
        event_type: editEvent.event_type || 'other',
        date: start.toISOString().split('T')[0],
        start_time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
        end_time: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
        claim_id: editEvent.claim_id || '',
        claim_search: editEvent.claim_number ? `#${editEvent.claim_number}` : '',
        assigned_to: editEvent.assigned_to || '',
        location: editEvent.location || '',
        description: editEvent.description || '',
        reminder: editEvent.reminder || 'none',
      });
    } else {
      setForm(defaultFormState());
    }
  }, [editEvent, open]);

  const createMutation = useMutation({
    mutationFn: (body) => apiPost('/api/calendar/', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-upcoming'] });
      toast.success('Event created');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err?.message || 'Failed to create event'),
  });

  const updateMutation = useMutation({
    mutationFn: (body) => apiPatch(`/api/calendar/${editEvent?._id || editEvent?.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-upcoming'] });
      toast.success('Event updated');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err?.message || 'Failed to update event'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/api/calendar/${editEvent?._id || editEvent?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-upcoming'] });
      toast.success('Event deleted');
      onOpenChange(false);
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete event'),
  });

  const handleClaimSearch = useCallback(async (query) => {
    setForm(prev => ({ ...prev, claim_search: query }));
    if (query.length < 2) { setClaimResults([]); return; }
    setSearchingClaims(true);
    try {
      const res = await apiGet(`/api/claims?search=${encodeURIComponent(query)}&limit=5`);
      setClaimResults(res?.data || []);
    } catch {
      setClaimResults([]);
    } finally {
      setSearchingClaims(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const start = new Date(`${form.date}T${form.start_time}`);
    const end = new Date(`${form.date}T${form.end_time}`);
    const payload = {
      title: form.title,
      event_type: form.event_type,
      start: start.toISOString(),
      end: end.toISOString(),
      claim_id: form.claim_id || undefined,
      assigned_to: form.assigned_to || undefined,
      location: form.location || undefined,
      description: form.description || undefined,
      reminder: form.reminder !== 'none' ? parseInt(form.reminder) : undefined,
    };
    if (editEvent) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editEvent ? 'Edit Event' : 'New Event'}</DialogTitle>
          <DialogDescription>
            {editEvent ? 'Update event details.' : 'Schedule a new event for your team.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              placeholder="e.g., Roof inspection at 123 Main St"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              required
            />
          </div>

          {/* Type + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Event Type</Label>
              <Select value={form.event_type} onValueChange={v => updateField('event_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(et => (
                    <SelectItem key={et.value} value={et.value}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${et.color}`} />
                        {et.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={form.date}
                onChange={e => updateField('date', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Start Time</Label>
              <Input
                id="event-start"
                type="time"
                value={form.start_time}
                onChange={e => updateField('start_time', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">End Time</Label>
              <Input
                id="event-end"
                type="time"
                value={form.end_time}
                onChange={e => updateField('end_time', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Claim link */}
          <div className="space-y-1.5">
            <Label>Link to Claim</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <Input
                placeholder="Search by claim # or name..."
                className="pl-9"
                value={form.claim_search}
                onChange={e => handleClaimSearch(e.target.value)}
              />
              {searchingClaims && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 animate-spin" />}
            </div>
            {claimResults.length > 0 && (
              <div className="rounded-lg border border-zinc-700/50 bg-zinc-900 overflow-hidden mt-1">
                {claimResults.map(c => (
                  <button
                    key={c._id || c.id}
                    type="button"
                    onClick={() => {
                      updateField('claim_id', c._id || c.id);
                      updateField('claim_search', `#${c.claimNumber || c.claim_number} - ${c.insuredName || c.insured_name || ''}`);
                      setClaimResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 flex items-center gap-2 border-b border-white/5 last:border-0"
                  >
                    <FileText className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="font-medium text-orange-400">#{c.claimNumber || c.claim_number}</span>
                    <span className="truncate text-zinc-400">{c.insuredName || c.insured_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assigned to */}
          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <Select value={form.assigned_to} onValueChange={v => updateField('assigned_to', v)}>
              <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent>
                {(teamMembers || []).map(m => (
                  <SelectItem key={m._id || m.id} value={m._id || m.id}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="event-location">Location</Label>
            <Input
              id="event-location"
              placeholder="e.g., 456 Oak Ave, Tampa, FL"
              value={form.location}
              onChange={e => updateField('location', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="event-desc">Description</Label>
            <Textarea
              id="event-desc"
              placeholder="Add notes or context..."
              rows={3}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
            />
          </div>

          {/* Reminder */}
          <div className="space-y-1.5">
            <Label>Reminder</Label>
            <Select value={form.reminder} onValueChange={v => updateField('reminder', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            {editEvent && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="mr-auto"
              >
                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete'}
              </Button>
            )}
            <DialogClose asChild>
              <Button type="button" variant="tacticalOutline" size="sm">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="tactical" size="sm" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Quick Schedule Menu ─────────────────────────────────────────────────────

const QuickScheduleBar = ({ onQuickCreate }) => (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs text-zinc-600 font-medium mr-1 flex items-center gap-1">
      <Zap className="w-3 h-3" /> Quick:
    </span>
    {EVENT_TYPES.filter(t => t.value !== 'other').map(et => {
      const Icon = et.icon;
      return (
        <button
          key={et.value}
          onClick={() => onQuickCreate(et.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all hover:brightness-125 hover:scale-105 ${et.bg} ${et.text} ${et.border}`}
        >
          <Icon className="w-3 h-3" />
          {et.label}
        </button>
      );
    })}
  </div>
);

// ─── Legend ──────────────────────────────────────────────────────────────────

const EventLegend = () => (
  <div className="flex items-center gap-3 flex-wrap">
    {EVENT_TYPES.map(et => (
      <span key={et.value} className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className={`h-2 w-2 rounded-full ${et.color}`} />
        {et.label}
      </span>
    ))}
  </div>
);

// ─── Main CalendarPage ───────────────────────────────────────────────────────

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adjusterFilter, setAdjusterFilter] = useState('all');

  const dateRange = useMemo(
    () => getDateRangeForView(currentDate, view),
    [currentDate, view]
  );

  // Fetch events for current view range
  const { data: eventsData, isLoading, isError, error } = useQuery({
    queryKey: ['calendar', dateRange.start, dateRange.end],
    queryFn: () => apiGet(`/api/calendar/?start=${dateRange.start}&end=${dateRange.end}`),
    staleTime: 30000,
  });

  // Fetch team members for assignment dropdown
  const { data: teamData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => apiGet('/api/users?role=adjuster'),
    staleTime: 300000,
  });

  const events = useMemo(() => {
    const raw = eventsData?.data || [];
    if (adjusterFilter === 'all') return raw;
    return raw.filter(ev => ev.assigned_to === adjusterFilter);
  }, [eventsData, adjusterFilter]);

  const teamMembers = teamData?.data || [];

  // Today's event count for badge
  const todayCount = useMemo(() => {
    const today = new Date();
    return events.filter(ev => isSameDay(new Date(ev.start), today)).length;
  }, [events]);

  // Navigation
  const navigate = (dir) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      else if (view === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const goToday = () => setCurrentDate(new Date());

  const handleEventClick = (event) => {
    setEditEvent(event);
    setDialogOpen(true);
  };

  const handleDayClick = (date) => {
    setCurrentDate(date);
    setView('day');
  };

  const handleNewEvent = () => {
    setEditEvent(null);
    setDialogOpen(true);
  };

  const handleQuickCreate = (eventType) => {
    const config = EVENT_TYPE_MAP[eventType];
    setEditEvent(null);
    setDialogOpen(true);
    // Pre-fill will happen via useEffect in dialog since editEvent is null
    // We use a slight delay to let dialog mount, then update
    setTimeout(() => {
      const titleInput = document.getElementById('event-title');
      if (titleInput) {
        titleInput.value = `${config.label} - `;
        titleInput.focus();
      }
    }, 100);
  };

  const getHeaderTitle = () => {
    if (view === 'month') return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === 'week') {
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0];
      const end = weekDays[6];
      if (start.getMonth() === end.getMonth()) {
        return `${MONTHS[start.getMonth()]} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
      }
      return `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} - ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Calendar</h1>
                {todayCount > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-orange-500 text-white text-[10px] font-bold px-1.5">
                    {todayCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">Schedule inspections, calls, and deadlines</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggles */}
            <div className="flex items-center rounded-lg border border-white/10 bg-zinc-900/50 p-0.5">
              {VIEWS.map(v => {
                const Icon = v.icon;
                return (
                  <button
                    key={v.value}
                    onClick={() => setView(v.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v.value ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{v.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Adjuster filter */}
            <Select value={adjusterFilter} onValueChange={setAdjusterFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1 text-zinc-500" />
                <SelectValue placeholder="All adjusters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Adjusters</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m._id || m.id} value={m._id || m.id}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sidebar toggle */}
            <Button
              variant="tacticalGhost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8"
            >
              {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>

            {/* New event */}
            <Button variant="tactical" size="sm" onClick={handleNewEvent} className="h-8">
              <Plus className="w-4 h-4" />
              New Event
            </Button>
          </div>
        </div>

        {/* Navigation + Quick Schedule */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="tacticalOutline" size="sm" onClick={() => navigate(-1)} className="h-8 w-8 p-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="tacticalOutline" size="sm" onClick={goToday} className="h-8 text-xs">
              Today
            </Button>
            <Button variant="tacticalOutline" size="sm" onClick={() => navigate(1)} className="h-8 w-8 p-0">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <h2 className="text-base font-semibold text-white ml-2">{getHeaderTitle()}</h2>
          </div>
          <QuickScheduleBar onQuickCreate={handleQuickCreate} />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-0">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <LoadingSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <h3 className="text-lg font-semibold text-white mb-1">Failed to load events</h3>
              <p className="text-sm text-zinc-500 mb-4">{error?.message || 'Something went wrong'}</p>
              <Button variant="tacticalOutline" size="sm" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          ) : (
            <>
              {view === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                  onDayClick={handleDayClick}
                />
              )}
              {view === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                />
              )}
              {view === 'day' && (
                <DayView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                />
              )}
              {view === 'list' && (
                <ListView events={events} onEventClick={handleEventClick} />
              )}
            </>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-between">
            <EventLegend />
            <span className="text-xs text-zinc-600">
              {events.length} event{events.length !== 1 ? 's' : ''} in view
            </span>
          </div>
        </div>

        {/* Right sidebar */}
        <UpcomingSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
      </div>

      {/* New/Edit event dialog */}
      <NewEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editEvent={editEvent}
        teamMembers={teamMembers}
      />
    </div>
  );
};

export default CalendarPage;
