import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../shared/ui/dialog';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Textarea } from '../../../shared/ui/textarea';
import { CalendarPlus, Calendar, Loader2 } from 'lucide-react';

const ScheduleAppointmentModal = ({
  open,
  onOpenChange,
  appointmentForm,
  setAppointmentForm,
  onSchedule,
  isScheduling,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-green-600" />
            Schedule Appointment
          </DialogTitle>
          <DialogDescription>Create an appointment for this claim</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="apt-title">Title *</Label>
            <Input
              id="apt-title"
              value={appointmentForm.title}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
              placeholder="e.g., Property Inspection"
              data-testid="apt-title-input"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="apt-date">Date *</Label>
              <Input
                id="apt-date"
                type="date"
                value={appointmentForm.date}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                data-testid="apt-date-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apt-time">Time *</Label>
              <Input
                id="apt-time"
                type="time"
                value={appointmentForm.time}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })}
                data-testid="apt-time-input"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="apt-duration">Duration</Label>
            <select
              id="apt-duration"
              value={appointmentForm.duration}
              onChange={(e) =>
                setAppointmentForm({ ...appointmentForm, duration: parseInt(e.target.value) })
              }
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
              data-testid="apt-duration-select"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={180}>3 hours</option>
            </select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="apt-location">Location</Label>
            <Input
              id="apt-location"
              value={appointmentForm.location}
              onChange={(e) =>
                setAppointmentForm({ ...appointmentForm, location: e.target.value })
              }
              placeholder="Property address"
              data-testid="apt-location-input"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="apt-description">Notes</Label>
            <Textarea
              id="apt-description"
              value={appointmentForm.description}
              onChange={(e) =>
                setAppointmentForm({ ...appointmentForm, description: e.target.value })
              }
              placeholder="Additional details..."
              rows={3}
              data-testid="apt-description-input"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={onSchedule}
              disabled={isScheduling}
              data-testid="confirm-schedule-btn"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleAppointmentModal;
