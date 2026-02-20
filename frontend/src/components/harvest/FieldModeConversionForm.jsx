/**
 * FieldModeConversionForm — Compact slide-up form for warm/hot pins
 *
 * Appears when rep taps FU, AP, or DL on the quick-tap bar.
 * Minimal fields per status:
 *   FU: notes only (optional)
 *   AP: date/time + notes
 *   DL: notes + optional contract value
 */
import React, { useState } from 'react';
import { FIELD_MODE_PINS } from '../../features/harvest/components/constants';
import { X, Send, Calendar, FileText, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FORM_CONFIG = {
  FU: {
    title: 'Follow Up',
    fields: ['notes'],
    placeholder: 'When to follow up? Any details...',
  },
  AP: {
    title: 'Appointment Set',
    fields: ['datetime', 'notes'],
    placeholder: 'Appointment notes...',
  },
  DL: {
    title: 'Deal Closed',
    fields: ['notes', 'value'],
    placeholder: 'Deal details...',
  },
};

const FieldModeConversionForm = ({ status, pin, onSubmit, onCancel }) => {
  const config = FORM_CONFIG[status];
  const pinInfo = FIELD_MODE_PINS.find((p) => p.code === status);
  const [notes, setNotes] = useState('');
  const [datetime, setDatetime] = useState('');
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!config) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    const combinedNotes = [
      notes,
      datetime && `Appt: ${datetime}`,
      value && `Value: $${value}`,
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      await onSubmit(status, combinedNotes || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 z-20 bg-zinc-900 border-t-2 rounded-t-2xl shadow-2xl safe-area-inset-bottom"
        style={{ borderTopColor: pinInfo?.color || '#8B5CF6' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: pinInfo?.color }}
            >
              {status}
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">{config.title}</h3>
              {pin?.address && (
                <p className="text-zinc-500 text-xs truncate max-w-[200px]">{pin.address}</p>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form fields */}
        <div className="px-4 pb-4 space-y-3">
          {/* Date/time for AP */}
          {config.fields.includes('datetime') && (
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Appointment date & time"
              />
            </div>
          )}

          {/* Notes — always present */}
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={config.placeholder}
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Value for DL */}
          {config.fields.includes('value') && (
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Contract value (optional)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            style={{ backgroundColor: pinInfo?.color }}
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                LOG {config.title.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FieldModeConversionForm;
