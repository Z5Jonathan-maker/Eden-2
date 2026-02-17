import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Clock, MapPin,
  Users, ExternalLink, X, Trash2, Edit2, Calendar as CalendarIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CalendarTab = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', start_time: '', end_time: '',
    location: '', attendees: '', reminder_minutes: 30,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59);
      const timeMin = firstDay.toISOString();
      const timeMax = lastDay.toISOString();

      const res = await apiGet(
        `/api/integrations/google/calendar/events?time_min=${timeMin}&time_max=${timeMax}&max_results=100`
      );
      if (res.ok) {
        setEvents(res.data.events || []);
      }
    } catch {
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Build calendar grid
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, currentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, currentMonth: true });
  }
  // Next month leading days
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    calendarDays.push({ day: d, currentMonth: false });
  }

  const getEventsForDay = (day) => {
    if (!day.currentMonth) return [];
    return events.filter(ev => {
      const start = new Date(ev.start);
      return start.getFullYear() === year && start.getMonth() === month && start.getDate() === day.day;
    });
  };

  const isToday = (day) => {
    if (!day.currentMonth) return false;
    const now = new Date();
    return day.day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const handleCreate = async () => {
    if (!newEvent.title || !newEvent.start_time || !newEvent.end_time) {
      toast.error('Title, start time, and end time are required');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        title: newEvent.title,
        description: newEvent.description,
        start_time: new Date(newEvent.start_time).toISOString(),
        end_time: new Date(newEvent.end_time).toISOString(),
        location: newEvent.location,
        attendees: newEvent.attendees ? newEvent.attendees.split(',').map(s => s.trim()).filter(Boolean) : [],
        reminder_minutes: newEvent.reminder_minutes,
      };
      const res = await apiPost('/api/integrations/google/calendar/events', payload);
      if (res.ok) {
        toast.success('Event created');
        setShowCreate(false);
        setNewEvent({ title: '', description: '', start_time: '', end_time: '', location: '', attendees: '', reminder_minutes: 30 });
        fetchEvents();
      } else {
        toast.error('Failed to create event');
      }
    } catch {
      toast.error('Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (eventId) => {
    try {
      const res = await apiDelete(`/api/integrations/google/calendar/events/${eventId}`);
      if (res.ok) {
        toast.success('Event deleted');
        fetchEvents();
        setSelectedDay(null);
      }
    } catch {
      toast.error('Failed to delete event');
    }
  };

  const dayEvents = selectedDay ? getEventsForDay({ day: selectedDay, currentMonth: true }) : [];

  // Create event modal
  if (showCreate) {
    return (
      <div className="h-full flex flex-col bg-zinc-950 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">New Event</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
            <X className="w-4 h-4 text-zinc-400" />
          </Button>
        </div>

        <div className="max-w-lg space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Title</label>
            <Input
              value={newEvent.title}
              onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
              placeholder="Event title"
              className="bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Start</label>
              <Input
                type="datetime-local"
                value={newEvent.start_time}
                onChange={e => setNewEvent(p => ({ ...p, start_time: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">End</label>
              <Input
                type="datetime-local"
                value={newEvent.end_time}
                onChange={e => setNewEvent(p => ({ ...p, end_time: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Location</label>
            <Input
              value={newEvent.location}
              onChange={e => setNewEvent(p => ({ ...p, location: e.target.value }))}
              placeholder="123 Main St, City, FL"
              className="bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Attendees (comma-separated emails)</label>
            <Input
              value={newEvent.attendees}
              onChange={e => setNewEvent(p => ({ ...p, attendees: e.target.value }))}
              placeholder="john@example.com, jane@example.com"
              className="bg-zinc-900 border-zinc-700 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Description</label>
            <textarea
              value={newEvent.description}
              onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))}
              placeholder="Event details..."
              className="w-full h-24 bg-zinc-900 border border-zinc-700 rounded-md p-3 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-orange-600 hover:bg-orange-700 text-white">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Event
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-zinc-950">
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevMonth} className="text-zinc-400">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold text-white min-w-[200px] text-center">
              {MONTHS[month]} {year}
            </h2>
            <Button variant="ghost" size="sm" onClick={nextMonth} className="text-zinc-400">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday} className="text-zinc-400 text-xs ml-2">
              Today
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" /> New Event
          </Button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs text-zinc-500 font-medium py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 flex-1 gap-px bg-zinc-800/30 rounded-lg overflow-hidden">
              {calendarDays.map((day, idx) => {
                const dayEvts = getEventsForDay(day);
                const today = isToday(day);
                const selected = selectedDay === day.day && day.currentMonth;

                return (
                  <button
                    key={idx}
                    onClick={() => day.currentMonth && setSelectedDay(day.day === selectedDay ? null : day.day)}
                    className={`min-h-[80px] p-1.5 text-left transition-colors ${
                      day.currentMonth ? 'bg-zinc-900 hover:bg-zinc-800/80' : 'bg-zinc-950/50'
                    } ${selected ? 'ring-1 ring-orange-500' : ''}`}
                  >
                    <span className={`text-xs inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      today ? 'bg-orange-600 text-white font-bold' :
                      day.currentMonth ? 'text-zinc-300' : 'text-zinc-600'
                    }`}>
                      {day.day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvts.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          className="text-[10px] leading-tight text-orange-400 bg-orange-500/10 rounded px-1 py-0.5 truncate"
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvts.length > 3 && (
                        <div className="text-[10px] text-zinc-500">+{dayEvts.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              {MONTHS[month]} {selectedDay}, {year}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>
              <X className="w-4 h-4 text-zinc-400" />
            </Button>
          </div>

          {dayEvents.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              <p className="text-sm">No events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayEvents.map(ev => (
                <div key={ev.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-white">{ev.title}</h4>
                    <div className="flex items-center gap-1">
                      {ev.htmlLink && (
                        <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => handleDelete(ev.id)} className="text-zinc-500 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {formatTime(ev.start)} - {formatTime(ev.end)}
                    </div>
                    {ev.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        {ev.location}
                      </div>
                    )}
                    {ev.attendees?.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3" />
                        {ev.attendees.length} attendee{ev.attendees.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  {ev.description && (
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{ev.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarTab;
