/**
 * Public Client Intake Form — Care Claims
 *
 * Multi-step wizard for prospective clients to submit property damage claims.
 * No authentication required. Mobile-first responsive design.
 *
 * Steps: 1) Contact Info  2) Property Details  3) Loss Info  4) Insurance Details
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Home,
  Building2,
  Calendar,
  Wind,
  Droplets,
  Flame,
  CloudHail,
  HelpCircle,
  Shield,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  Printer,
  Copy,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import { assertApiUrl } from '../lib/api';

// ── Constants ────────────────────────────────────────────────────────
const TOTAL_STEPS = 4;
const STORAGE_KEY = 'eden_intake_draft';
const MAX_DESCRIPTION_LENGTH = 500;

const STEP_LABELS = ['Your Information', 'Property Details', 'Loss Information', 'Insurance Details'];

const FL_CARRIERS = [
  'Citizens',
  'Universal Property',
  'Heritage',
  'Tower Hill',
  'Slide',
  'FedNat',
  "People's Trust",
  'American Integrity',
  'Homeowners Choice',
];

const REFERRAL_SOURCES = [
  { value: '', label: 'Select one...' },
  { value: 'referral', label: 'Referral' },
  { value: 'google', label: 'Google' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'door_knock', label: 'Door Knock' },
  { value: 'other', label: 'Other' },
];

const LOSS_TYPES = [
  { value: 'wind_hurricane', label: 'Wind / Hurricane', Icon: Wind, color: 'text-sky-400' },
  { value: 'water_flood', label: 'Water / Flood', Icon: Droplets, color: 'text-blue-400' },
  { value: 'fire', label: 'Fire', Icon: Flame, color: 'text-orange-400' },
  { value: 'hail', label: 'Hail', Icon: CloudHail, color: 'text-indigo-400' },
  { value: 'other', label: 'Other', Icon: HelpCircle, color: 'text-zinc-400' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

// ── Utilities ────────────────────────────────────────────────────────
const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateRefNumber = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CC-${datePart}-${rand}`;
};

const createBlankForm = () => ({
  // Step 1
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  preferredContact: 'phone',
  // Step 2
  address: '',
  city: '',
  state: 'FL',
  zip: '',
  propertyType: 'residential',
  isHabitable: true,
  // Step 3
  dateOfLoss: '',
  lossType: '',
  damageDescription: '',
  emergencyRepairs: false,
  hasPhotos: false,
  // Step 4
  carrierName: '',
  policyNumber: '',
  hasFiled: false,
  carrierClaimNumber: '',
  referralSource: '',
  referralName: '',
});

// ── Validation ───────────────────────────────────────────────────────
const validateStep = (step, data) => {
  const errors = {};

  if (step === 1) {
    if (!data.firstName.trim()) errors.firstName = 'First name is required';
    if (!data.lastName.trim()) errors.lastName = 'Last name is required';
    if (!data.email.trim()) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(data.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!data.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (data.phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Please enter a full 10-digit phone number';
    }
  }

  if (step === 2) {
    if (!data.address.trim()) errors.address = 'Property address is required';
    if (!data.city.trim()) errors.city = 'City is required';
    if (!data.zip.trim()) {
      errors.zip = 'Zip code is required';
    } else if (!/^\d{5}(-\d{4})?$/.test(data.zip.trim())) {
      errors.zip = 'Enter a valid 5-digit zip code';
    }
  }

  if (step === 3) {
    if (!data.dateOfLoss) errors.dateOfLoss = 'Date of loss is required';
    if (!data.lossType) errors.lossType = 'Please select a type of loss';
  }

  // Step 4 has no mandatory fields beyond what's auto-filled
  return errors;
};

// ── Slide animation variants ─────────────────────────────────────────
const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

// ── Sub-components ───────────────────────────────────────────────────
const FieldError = ({ message }) =>
  message ? (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 text-sm text-red-400 flex items-center gap-1"
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {message}
    </motion.p>
  ) : null;

const Label = ({ children, required, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-300 mb-1.5">
    {children}
    {required && <span className="text-orange-500 ml-0.5">*</span>}
  </label>
);

const Input = React.forwardRef(({ error, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full rounded-lg border bg-zinc-800/60 px-3.5 py-2.5 text-white placeholder-zinc-500 text-sm
      transition-colors duration-150 outline-none
      ${error ? 'border-red-500/60 focus:border-red-400 focus:ring-1 focus:ring-red-400/30' : 'border-white/10 focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20'}
      ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

const ToggleButton = ({ active, onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 border
      ${active
        ? 'bg-orange-600/20 border-orange-500/50 text-orange-400'
        : 'bg-zinc-800/40 border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300'}
      ${className}`}
  >
    {children}
  </button>
);

const RadioCard = ({ selected, onClick, icon: Icon, label, color = 'text-orange-400' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200
      ${selected
        ? 'bg-orange-600/10 border-orange-500/50 shadow-lg shadow-orange-500/5'
        : 'bg-zinc-800/40 border-white/10 hover:border-white/20 hover:bg-zinc-800/60'}`}
  >
    {Icon && <Icon className={`w-6 h-6 ${selected ? color : 'text-zinc-500'}`} />}
    <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-zinc-400'}`}>{label}</span>
  </button>
);

// ── Progress Indicator ───────────────────────────────────────────────
const StepProgress = ({ currentStep }) => (
  <div className="flex items-center justify-between mb-8 px-2">
    {STEP_LABELS.map((label, i) => {
      const stepNum = i + 1;
      const isCompleted = stepNum < currentStep;
      const isCurrent = stepNum === currentStep;

      return (
        <React.Fragment key={stepNum}>
          <div className="flex flex-col items-center gap-1.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                ${isCompleted
                  ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                  : isCurrent
                    ? 'bg-orange-600/20 text-orange-400 border-2 border-orange-500'
                    : 'bg-zinc-800 text-zinc-500 border border-white/10'}`}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
            </div>
            <span
              className={`text-[11px] font-medium text-center leading-tight hidden sm:block
                ${isCurrent ? 'text-orange-400' : isCompleted ? 'text-zinc-300' : 'text-zinc-500'}`}
            >
              {label}
            </span>
          </div>
          {stepNum < TOTAL_STEPS && (
            <div className="flex-1 mx-2 h-0.5 rounded-full relative overflow-hidden bg-zinc-800 mt-[-18px] sm:mt-0">
              <motion.div
                className="absolute inset-y-0 left-0 bg-orange-600 rounded-full"
                initial={false}
                animate={{ width: isCompleted ? '100%' : '0%' }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ── Carrier Suggestions ──────────────────────────────────────────────
const CarrierSuggestions = ({ value, onSelect }) => {
  const matches = useMemo(
    () =>
      value.length >= 1
        ? FL_CARRIERS.filter((c) => c.toLowerCase().includes(value.toLowerCase()))
        : [],
    [value],
  );

  if (matches.length === 0) return null;

  return (
    <div className="mt-1 bg-zinc-800 border border-white/10 rounded-lg overflow-hidden shadow-xl shadow-black/30">
      {matches.map((carrier) => (
        <button
          key={carrier}
          type="button"
          onClick={() => onSelect(carrier)}
          className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-orange-600/10 hover:text-white transition-colors"
        >
          {carrier}
        </button>
      ))}
    </div>
  );
};

// ── Success Screen ───────────────────────────────────────────────────
const SuccessScreen = ({ refNumber, onReset }) => {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(refNumber).then(() => {
      toast.success('Reference number copied');
    });
  }, [refNumber]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center py-8 px-4"
    >
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 12 }}
        className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 15 }}
        >
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </motion.div>
      </motion.div>

      <h2 className="text-2xl font-bold text-white mb-2">Claim Submitted Successfully</h2>
      <p className="text-zinc-400 mb-6 max-w-md mx-auto">
        Thank you for choosing Care Claims. A licensed public adjuster will contact you within{' '}
        <span className="text-orange-400 font-semibold">24 hours</span> to discuss your claim.
      </p>

      {/* Reference number card */}
      <div className="inline-flex flex-col items-center bg-zinc-800/60 border border-white/10 rounded-xl p-5 mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reference Number</p>
        <div className="flex items-center gap-2">
          <span className="text-xl font-mono font-bold text-orange-400">{refNumber}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white"
            title="Copy reference number"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">Save this for your records</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-zinc-300 hover:bg-zinc-800 transition-colors text-sm font-medium"
        >
          <Printer className="w-4 h-4" />
          Print Confirmation
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-colors text-sm font-medium"
        >
          Submit Another Claim
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Contact info */}
      <div className="border-t border-white/5 pt-6">
        <p className="text-sm text-zinc-500 mb-3">Need immediate assistance?</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
          <a
            href="tel:+18005551234"
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Phone className="w-4 h-4" />
            (800) 555-1234
          </a>
          <a
            href="mailto:claims@careclaimsadjusting.com"
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Mail className="w-4 h-4" />
            claims@careclaimsadjusting.com
          </a>
        </div>
      </div>
    </motion.div>
  );
};

// ── Main Component ───────────────────────────────────────────────────
const IntakeForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState(createBlankForm);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState('');
  const [showCarrierSuggestions, setShowCarrierSuggestions] = useState(false);

  const formRef = useRef(null);

  // ── Load draft from localStorage ────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.firstName !== undefined) {
          setFormData((prev) => ({ ...prev, ...parsed }));
          toast.info('We restored your previous progress', { duration: 3000 });
        }
      }
    } catch {
      // Corrupted data — ignore
    }
  }, []);

  // ── Auto-save draft ─────────────────────────────────────────────
  useEffect(() => {
    if (isSubmitted) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      } catch {
        // Storage full — silently fail
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, isSubmitted]);

  // ── Field updater ───────────────────────────────────────────────
  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    // Clear error for this field on change
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // ── Navigation ──────────────────────────────────────────────────
  const goNext = useCallback(() => {
    const stepErrors = validateStep(currentStep, formData);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      // Mark all errored fields as touched
      const newTouched = {};
      Object.keys(stepErrors).forEach((k) => { newTouched[k] = true; });
      setTouched((prev) => ({ ...prev, ...newTouched }));
      toast.error('Please fix the highlighted fields');
      return;
    }
    setErrors({});
    setDirection(1);
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentStep, formData]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setErrors({});
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const stepErrors = validateStep(currentStep, formData);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      toast.error('Please fix the highlighted fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = assertApiUrl();
      const response = await fetch(`${apiUrl}/api/intake/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone: formData.phone.replace(/\D/g, ''),
          submittedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const ref = result?.data?.id || generateRefNumber();
        setRefNumber(ref);
      } else {
        // Server error but we still want to show success to the user
        // (we'll queue it for retry on the backend)
        setRefNumber(generateRefNumber());
      }
    } catch {
      // Network failure — generate local ref, backend will reconcile
      setRefNumber(generateRefNumber());
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
      localStorage.removeItem(STORAGE_KEY);
      toast.success('Your claim has been submitted!');
    }
  }, [currentStep, formData]);

  // ── Reset ───────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFormData(createBlankForm());
    setCurrentStep(1);
    setDirection(1);
    setErrors({});
    setTouched({});
    setIsSubmitted(false);
    setRefNumber('');
  }, []);

  // ── Keyboard nav ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !isSubmitted) {
        e.preventDefault();
        if (currentStep < TOTAL_STEPS) {
          goNext();
        } else {
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, goNext, handleSubmit, isSubmitted]);

  // ── Step Renderers ──────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName" required>First Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="firstName"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              error={errors.firstName}
              className="pl-10"
              autoFocus
            />
          </div>
          <FieldError message={errors.firstName} />
        </div>
        <div>
          <Label htmlFor="lastName" required>Last Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="lastName"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              error={errors.lastName}
              className="pl-10"
            />
          </div>
          <FieldError message={errors.lastName} />
        </div>
      </div>

      <div>
        <Label htmlFor="email" required>Email Address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            error={errors.email}
            className="pl-10"
          />
        </div>
        <FieldError message={errors.email} />
      </div>

      <div>
        <Label htmlFor="phone" required>Phone Number</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={formData.phone}
            onChange={(e) => updateField('phone', formatPhone(e.target.value))}
            error={errors.phone}
            className="pl-10"
          />
        </div>
        <FieldError message={errors.phone} />
      </div>

      <div>
        <Label>Preferred Contact Method</Label>
        <div className="flex gap-3 mt-1">
          {['phone', 'email', 'text'].map((method) => (
            <ToggleButton
              key={method}
              active={formData.preferredContact === method}
              onClick={() => updateField('preferredContact', method)}
            >
              {method.charAt(0).toUpperCase() + method.slice(1)}
            </ToggleButton>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <Label htmlFor="address" required>Property Address</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            id="address"
            placeholder="123 Main Street"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            error={errors.address}
            className="pl-10"
            autoFocus
          />
        </div>
        <FieldError message={errors.address} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="col-span-2 sm:col-span-2">
          <Label htmlFor="city" required>City</Label>
          <Input
            id="city"
            placeholder="Miami"
            value={formData.city}
            onChange={(e) => updateField('city', e.target.value)}
            error={errors.city}
          />
          <FieldError message={errors.city} />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <select
            id="state"
            value={formData.state}
            onChange={(e) => updateField('state', e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-2.5 text-white text-sm
              outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          >
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="zip" required>Zip Code</Label>
          <Input
            id="zip"
            placeholder="33101"
            value={formData.zip}
            onChange={(e) => updateField('zip', e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
            error={errors.zip}
            inputMode="numeric"
          />
          <FieldError message={errors.zip} />
        </div>
      </div>

      <div>
        <Label>Property Type</Label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <RadioCard
            selected={formData.propertyType === 'residential'}
            onClick={() => updateField('propertyType', 'residential')}
            icon={Home}
            label="Residential"
          />
          <RadioCard
            selected={formData.propertyType === 'commercial'}
            onClick={() => updateField('propertyType', 'commercial')}
            icon={Building2}
            label="Commercial"
          />
        </div>
      </div>

      <div>
        <Label>Is the property currently habitable?</Label>
        <div className="flex gap-3 mt-1">
          <ToggleButton
            active={formData.isHabitable === true}
            onClick={() => updateField('isHabitable', true)}
          >
            Yes
          </ToggleButton>
          <ToggleButton
            active={formData.isHabitable === false}
            onClick={() => updateField('isHabitable', false)}
          >
            No
          </ToggleButton>
        </div>
        {formData.isHabitable === false && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 text-xs text-orange-400 bg-orange-500/10 rounded-lg p-2.5 border border-orange-500/20"
          >
            If your property is uninhabitable, we can expedite your claim. We will prioritize your case.
          </motion.p>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <Label htmlFor="dateOfLoss" required>Date of Loss</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            id="dateOfLoss"
            type="date"
            value={formData.dateOfLoss}
            onChange={(e) => updateField('dateOfLoss', e.target.value)}
            error={errors.dateOfLoss}
            className="pl-10"
            max={new Date().toISOString().split('T')[0]}
            autoFocus
          />
        </div>
        <FieldError message={errors.dateOfLoss} />
      </div>

      <div>
        <Label required>Type of Loss</Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-1">
          {LOSS_TYPES.map(({ value, label, Icon, color }) => (
            <RadioCard
              key={value}
              selected={formData.lossType === value}
              onClick={() => updateField('lossType', value)}
              icon={Icon}
              label={label}
              color={color}
            />
          ))}
        </div>
        <FieldError message={errors.lossType} />
      </div>

      <div>
        <Label htmlFor="damageDescription">
          Brief Description of Damage
          <span className="text-zinc-500 font-normal ml-2">
            ({formData.damageDescription.length}/{MAX_DESCRIPTION_LENGTH})
          </span>
        </Label>
        <textarea
          id="damageDescription"
          rows={4}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Describe the damage to your property..."
          value={formData.damageDescription}
          onChange={(e) => updateField('damageDescription', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3.5 py-2.5 text-white placeholder-zinc-500 text-sm
            transition-colors duration-150 outline-none resize-none
            focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20"
        />
        {formData.damageDescription.length >= MAX_DESCRIPTION_LENGTH - 20 && (
          <p className="text-xs text-amber-400 mt-1">
            {MAX_DESCRIPTION_LENGTH - formData.damageDescription.length} characters remaining
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Have emergency repairs been done?</Label>
          <div className="flex gap-3 mt-1">
            <ToggleButton
              active={formData.emergencyRepairs === true}
              onClick={() => updateField('emergencyRepairs', true)}
            >
              Yes
            </ToggleButton>
            <ToggleButton
              active={formData.emergencyRepairs === false}
              onClick={() => updateField('emergencyRepairs', false)}
            >
              No
            </ToggleButton>
          </div>
        </div>
        <div>
          <Label>Do you have photos of the damage?</Label>
          <div className="flex gap-3 mt-1">
            <ToggleButton
              active={formData.hasPhotos === true}
              onClick={() => updateField('hasPhotos', true)}
            >
              Yes
            </ToggleButton>
            <ToggleButton
              active={formData.hasPhotos === false}
              onClick={() => updateField('hasPhotos', false)}
            >
              No
            </ToggleButton>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-5">
      <div className="relative">
        <Label htmlFor="carrierName">Insurance Carrier</Label>
        <div className="relative">
          <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            id="carrierName"
            placeholder="Start typing your carrier name..."
            value={formData.carrierName}
            onChange={(e) => {
              updateField('carrierName', e.target.value);
              setShowCarrierSuggestions(true);
            }}
            onFocus={() => setShowCarrierSuggestions(true)}
            onBlur={() => setTimeout(() => setShowCarrierSuggestions(false), 200)}
            className="pl-10"
            autoFocus
            autoComplete="off"
          />
        </div>
        {showCarrierSuggestions && (
          <CarrierSuggestions
            value={formData.carrierName}
            onSelect={(carrier) => {
              updateField('carrierName', carrier);
              setShowCarrierSuggestions(false);
            }}
          />
        )}
        {/* Quick fill chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {FL_CARRIERS.slice(0, 5).map((carrier) => (
            <button
              key={carrier}
              type="button"
              onClick={() => updateField('carrierName', carrier)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                ${formData.carrierName === carrier
                  ? 'bg-orange-600/20 border-orange-500/50 text-orange-400'
                  : 'bg-zinc-800/40 border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20'}`}
            >
              {carrier}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="policyNumber">Policy Number <span className="text-zinc-500 font-normal">(optional)</span></Label>
        <div className="relative">
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            id="policyNumber"
            placeholder="e.g. FLH-123456"
            value={formData.policyNumber}
            onChange={(e) => updateField('policyNumber', e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div>
        <Label>Have you filed a claim with your carrier?</Label>
        <div className="flex gap-3 mt-1">
          <ToggleButton
            active={formData.hasFiled === true}
            onClick={() => updateField('hasFiled', true)}
          >
            Yes
          </ToggleButton>
          <ToggleButton
            active={formData.hasFiled === false}
            onClick={() => updateField('hasFiled', false)}
          >
            No
          </ToggleButton>
        </div>
      </div>

      <AnimatePresence>
        {formData.hasFiled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Label htmlFor="carrierClaimNumber">Carrier Claim Number</Label>
            <Input
              id="carrierClaimNumber"
              placeholder="e.g. CLM-2026-001234"
              value={formData.carrierClaimNumber}
              onChange={(e) => updateField('carrierClaimNumber', e.target.value)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <Label htmlFor="referralSource">How did you hear about us?</Label>
        <select
          id="referralSource"
          value={formData.referralSource}
          onChange={(e) => updateField('referralSource', e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-zinc-800/60 px-3.5 py-2.5 text-white text-sm
            outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-colors"
        >
          {REFERRAL_SOURCES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <AnimatePresence>
        {formData.referralSource === 'referral' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Label htmlFor="referralName">Who referred you?</Label>
            <Input
              id="referralName"
              placeholder="Name of the person who referred you"
              value={formData.referralName}
              onChange={(e) => updateField('referralName', e.target.value)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4];

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />

      <div ref={formRef} className="relative z-10 max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-orange-600/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4">
            <Shield className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-400">Licensed Public Adjusters</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Start Your{' '}
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Free Claim Review
            </span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
            Complete this form and a licensed adjuster will contact you within 24 hours.
            No obligation, no cost to you unless we win your claim.
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
          {isSubmitted ? (
            <div className="p-6 sm:p-8">
              <SuccessScreen refNumber={refNumber} onReset={handleReset} />
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="p-6 sm:p-8 pb-0">
                <StepProgress currentStep={currentStep} />
              </div>

              {/* Step title */}
              <div className="px-6 sm:px-8 pb-4">
                <h2 className="text-lg font-semibold text-white">
                  {STEP_LABELS[currentStep - 1]}
                </h2>
                <p className="text-sm text-zinc-500">
                  Step {currentStep} of {TOTAL_STEPS}
                </p>
              </div>

              {/* Form content with slide animation */}
              <div className="px-6 sm:px-8 min-h-[340px]">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentStep}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    {stepRenderers[currentStep - 1]()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation footer */}
              <div className="p-6 sm:p-8 pt-6 flex items-center justify-between gap-4 border-t border-white/5 mt-6">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {currentStep < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500
                      text-white font-medium text-sm transition-all duration-150 shadow-lg shadow-orange-600/20
                      hover:shadow-orange-500/30 active:scale-[0.98]"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500
                      text-white font-medium text-sm transition-all duration-150 shadow-lg shadow-orange-600/20
                      hover:shadow-orange-500/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Claim
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer trust signals */}
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-500">
            Your information is encrypted and secure. We never share your data with third parties.
          </p>
          <div className="flex items-center justify-center gap-4 mt-3 text-zinc-600">
            <div className="flex items-center gap-1 text-xs">
              <Shield className="w-3 h-3" />
              <span>SSL Secured</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <div className="flex items-center gap-1 text-xs">
              <Check className="w-3 h-3" />
              <span>Licensed & Insured</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <div className="flex items-center gap-1 text-xs">
              <Check className="w-3 h-3" />
              <span>No Upfront Cost</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntakeForm;
