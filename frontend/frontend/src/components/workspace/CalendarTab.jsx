import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Clock, MapPin,
  Users, ExternalLink, X, Trash2, Calendar as CalendarIcon,
  LayoutGrid, List, Sun, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete } from '../../lib/api';

/* ─── Constants ─── */
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EVENT_COLORS = [
  { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-500' },
  { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' },
  { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-400', dot: 'bg-indigo-500' },
];

const hashEventColor = (str) => {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length];
};

/* ─── Helpers ─── */
const formatTime = (dateStr) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
};

const formatTimeRange = (start, end) => {
  if (!start) return '';
  const s = formatTime(start);
  const e = end ? formatTime(end) : '';
  return e ? `${s} – ${e}` : s;
};

const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

/* ─── Create Event Modal ─── */
const CreateEventModal = ({ onClose, onCreate, creating, initialDate }) => {
  const getDefaultTime = (hours) => {
    const d = initialDate ? new Date(initialDate) : new Date();
    d.setHours(hours, 0, 0, 0);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const [form, setForm] = useState({
    title: '', description: '', start_time: getDefaultTime(9), end_time: getDefaultTime(10),
    location: '', attendees: '', reminder_minutes: 30,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.start_time || !form.end_time) {
      toast.error('Title, start and end time required');
      return;
    }
    onCreate(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">New Event</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Title — big and prominent like Google Calendar */}
          <input
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Add title"
            className="w-full text-xl font-medium bg-transparent text-white outline-none border-b border-zinc-700 pb-3 placeholder:text-zinc-600 focus:border-orange-500 transition-colors"
            autoFocus
          />

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5 block font-medium">Start</label>
              <input type="datetime-local" value={form.start_time}
                onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white outline-none focus:border-orange-500 transition-colors" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5 block font-medium">End</label>
              <input type="datetime-local" value={form.end_time}
                onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white outline-none focus:border-orange-500 transition-colors" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5 block font-medium">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="Add location"
                className="w-full pl-10 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600" />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5 block font-medium">Guests</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input value={form.attendees} onChange={e => setForm(p => ({ ...p, attendees: e.target.value }))}
                placeholder="Add guests (comma-separated emails)"
                className="w-full pl-10 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-600" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] text-zinc-500 uppercase tracking-wide mb-1.5 block font-medium">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Add description"
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white outline-none focus:border-orange-500 transition-colors resize-none placeholder:text-zinc-600" />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={creating}
              className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Main CalendarTab ─── */
const CalendarTab = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState('month'); // month | week

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      let firstDay, lastDay;
      if (view === 'week') {
        const d = new Date(currentDate);
        const day = d.getDay();
        firstDay = new Date(d); firstDay.setDate(d.getDate() - day);
        lastDay = new Date(firstDay); lastDay.setDate(firstDay.getDate() + 6);
        lastDay.setHours(23, 59, 59);
      } else {
        firstDay = new Date(year, month, 1);
        lastDay = new Date(year, month + 1, 0, 23, 59, 59);
      }

      const res = await apiGet(
        `/api/integrations/google/calendar/events?time_min=${firstDay.toISOString()}&time_max=${lastDay.toISOString()}&max_results=200`
      );
      if (res.ok) setEvents(res.data.events || []);
    } catch { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  }, [year, month, view, currentDate]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const prevPeriod = () => {
    if (view === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const nextPeriod = () => {
    if (view === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const goToday = () => setCurrentDate(new Date());

  // Build month grid
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, currentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, currentMonth: true, date: new Date(year, month, d) });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, currentMonth: false, date: new Date(year, month + 1, d) });
    }
    return days;
  }, [year, month]);

  // Build week grid
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(start);
      dd.setDate(start.getDate() + i);
      days.push({ day: dd.getDate(), currentMonth: dd.getMonth() === month, date: dd });
    }
    return days;
  }, [currentDate, month]);

  const getEventsForDate = useCallback((date) => {
    return events.filter(ev => {
      const start = new Date(ev.start);
      return isSameDay(start, date);
    });
  }, [events]);

  const isToday = (date) => isSameDay(date, new Date());

  const handleCreate = async (form) => {
    setCreating(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        location: form.location,
        attendees: form.attendees ? form.attendees.split(',').map(s => s.trim()).filter(Boolean) : [],
        reminder_minutes: form.reminder_minutes,
      };
      const res = await apiPost('/api/integrations/google/calendar/events', payload);
      if (res.ok) {
        toast.success('Event created');
        setShowCreate(false);
        fetchEvents();
      } else toast.error('Failed to create event');
    } catch { toast.error('Failed to create event'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (eventId) => {
    try {
      const res = await apiDelete(`/api/integrations/google/calendar/events/${eventId}`);
      if (res.ok) { toast.success('Event deleted'); fetchEvents(); setSelectedDay(null); }
    } catch { toast.error('Failed to delete event'); }
  };

  const dayEvents = selectedDay ? getEventsForDate(selectedDay) : [];

  // Week date range label
  const weekLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    if (start.getMonth() === end.getMonth()) {
      return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
  }, [weekDays]);

  const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am to 9pm

  return (
    <div className="h-full flex bg-zinc-950">
      {/* ── Main calendar area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/70">
          <div className="flex items-center gap-3">
            <button onClick={goToday}
              className="px-3 py-1.5 text-sm font-medium text-zinc-300 border border-zinc-700 hover:bg-zinc-800 rounded-lg transition-colors">
              Today
            </button>
            <div className="flex items-center">
              <button onClick={prevPeriod} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
                <ChevronLeft className="w-4 h-4 text-zinc-400" />
              </button>
              <button onClick={nextPeriod} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            <h2 className="text-lg font-semibold text-white">
              {view === 'week' ? weekLabel : `${MONTHS[month]} ${year}`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex bg-zinc-800 rounded-lg p-0.5">
              {[
                { id: 'week', label: 'Week', icon: List },
                { id: 'month', label: 'Month', icon: LayoutGrid },
              ].map(v => (
                <button key={v.id} onClick={() => setView(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    view === v.id ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}>
                  <v.icon className="w-3.5 h-3.5" />
                  {v.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-orange-600/20">
              <Plus className="w-4 h-4" /> New Event
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : view === 'month' ? (
          /* ── Month View ── */
          <div className="flex-1 flex flex-col overflow-hidden p-3">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-[11px] text-zinc-500 font-medium py-2 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 flex-1 gap-px bg-zinc-800/20 rounded-xl overflow-hidden">
              {calendarDays.map((day, idx) => {
                const dayEvts = getEventsForDate(day.date);
                const today = isToday(day.date);
                const selected = selectedDay && isSameDay(day.date, selectedDay);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (selectedDay && isSameDay(day.date, selectedDay)) setSelectedDay(null);
                      else setSelectedDay(day.date);
                    }}
                    className={`min-h-[90px] p-1.5 text-left transition-all duration-100 flex flex-col
                      ${day.currentMonth ? 'bg-zinc-900/80 hover:bg-zinc-800/60' : 'bg-zinc-950/60'}
                      ${selected ? 'ring-2 ring-orange-500/50 ring-inset bg-zinc-800/60' : ''}
                    `}
                  >
                    <span className={`text-[11px] inline-flex items-center justify-center w-7 h-7 rounded-full mb-0.5 font-medium
                      ${today ? 'bg-orange-600 text-white font-bold' : day.currentMonth ? 'text-zinc-300' : 'text-zinc-600'}
                    `}>
                      {day.day}
                    </span>
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {dayEvts.slice(0, 3).map(ev => {
                        const color = hashEventColor(ev.title);
                        return (
                          <div key={ev.id}
                            className={`text-[10px] leading-tight ${color.bg} ${color.border} border ${color.text} rounded px-1.5 py-0.5 truncate font-medium`}>
                            {formatTime(ev.start)} {ev.title}
                          </div>
                        );
                      })}
                      {dayEvts.length > 3 && (
                        <div className="text-[10px] text-zinc-500 pl-1 font-medium">+{dayEvts.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── Week View ── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-800/70">
              <div />
              {weekDays.map((day, idx) => {
                const today = isToday(day.date);
                return (
                  <button key={idx}
                    onClick={() => {
                      if (selectedDay && isSameDay(day.date, selectedDay)) setSelectedDay(null);
                      else setSelectedDay(day.date);
                    }}
                    className="text-center py-3 hover:bg-zinc-900/50 transition-colors">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">{DAYS_SHORT[idx]}</div>
                    <span className={`text-lg font-medium inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors
                      ${today ? 'bg-orange-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}
                    `}>
                      {day.day}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
                {HOURS.map(hour => (
                  <React.Fragment key={hour}>
                    <div className="h-16 flex items-start justify-end pr-3 pt-0.5">
                      <span className="text-[10px] text-zinc-600 font-medium">
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </span>
                    </div>
                    {weekDays.map((day, dayIdx) => {
                      const dayEvts = getEventsForDate(day.date);
                      const hourEvts = dayEvts.filter(ev => new Date(ev.start).getHours() === hour);
                      return (
                        <div key={dayIdx}
                          className="h-16 border-t border-l border-zinc-800/30 relative group hover:bg-zinc-900/30 transition-colors">
                          {hourEvts.map(ev => {
                            const color = hashEventColor(ev.title);
                            const startMin = new Date(ev.start).getMinutes();
                            const endDate = ev.end ? new Date(ev.end) : new Date(new Date(ev.start).getTime() + 3600000);
                            const durationMin = (endDate - new Date(ev.start)) / 60000;
                            const heightPx = Math.max(20, (durationMin / 60) * 64);
                            const topPx = (startMin / 60) * 64;
                            return (
                              <div key={ev.id}
                                className={`absolute left-0.5 right-0.5 ${color.bg} ${color.border} border rounded-md px-1.5 py-0.5 overflow-hidden cursor-pointer z-10 hover:z-20 hover:shadow-lg transition-shadow`}
                                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                                onClick={() => setSelectedDay(day.date)}>
                                <div className={`text-[10px] font-medium ${color.text} truncate`}>{ev.title}</div>
                                <div className="text-[9px] text-zinc-500 truncate">{formatTimeRange(ev.start, ev.end)}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Day detail sidebar ── */}
      {selectedDay && (
        <div className="w-80 border-l border-zinc-800/70 bg-zinc-900/40 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
            <div>
              <h3 className="text-sm font-semibold text-white">
                {DAYS_FULL[selectedDay.getDay()]}
              </h3>
              <p className="text-xs text-zinc-500">{MONTHS[selectedDay.getMonth()]} {selectedDay.getDate()}, {selectedDay.getFullYear()}</p>
            </div>
            <button onClick={() => setSelectedDay(null)} className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-8">
                <Sun className="w-10 h-10 mb-3 text-zinc-700" />
                <p className="text-sm font-medium text-zinc-400 mb-1">Nothing planned</p>
                <p className="text-xs text-zinc-600">Enjoy your free time</p>
                <button onClick={() => setShowCreate(true)}
                  className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                  <Plus className="w-3 h-3" /> Add event
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dayEvents.map(ev => {
                  const color = hashEventColor(ev.title);
                  return (
                    <div key={ev.id}
                      className={`${color.bg} border ${color.border} rounded-xl p-3 transition-all hover:shadow-lg`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                          <h4 className="text-sm font-medium text-white">{ev.title}</h4>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {ev.htmlLink && (
                            <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                              className="p-1 text-zinc-500 hover:text-zinc-300 rounded transition-colors">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button onClick={() => handleDelete(ev.id)}
                            className="p-1 text-zinc-500 hover:text-red-400 rounded transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-zinc-400">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{formatTimeRange(ev.start, ev.end)}</span>
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-2 text-zinc-400">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{ev.location}</span>
                          </div>
                        )}
                        {ev.attendees?.length > 0 && (
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Users className="w-3 h-3 flex-shrink-0" />
                            <span>{ev.attendees.length} guest{ev.attendees.length > 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {ev.description && (
                          <p className="text-zinc-500 mt-1.5 line-clamp-3 leading-relaxed">{ev.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Event Modal ── */}
      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          creating={creating}
          initialDate={selectedDay}
        />
      )}
    </div>
  );
};

export default CalendarTab;
