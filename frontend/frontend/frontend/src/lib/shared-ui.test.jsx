/**
 * Unit Tests for Eden Shared UI Components
 *
 * Covers: Spinner, LoadingState, ErrorState, EmptyState,
 *         StatusPill, PageHeader, SectionCard, ConfirmDialog, InfoBanner
 *
 * Run: npx vitest run src/lib/shared-ui.test.jsx
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the Button component used by shared-ui
vi.mock('../components/ui/button', () => ({
  Button: ({ children, onClick, className, variant, size, ...rest }) => (
    <button onClick={onClick} className={className} data-variant={variant} data-size={size} {...rest}>
      {children}
    </button>
  ),
}));

// Mock lucide-react icons as simple SVG stubs
vi.mock('lucide-react', () => ({
  Loader2: ({ className, ...props }) => <svg data-testid="icon-loader2" className={className} {...props} />,
  AlertCircle: ({ className, ...props }) => <svg data-testid="icon-alert-circle" className={className} {...props} />,
  FileQuestion: ({ className, ...props }) => <svg data-testid="icon-file-question" className={className} {...props} />,
  RefreshCcw: ({ className, ...props }) => <svg data-testid="icon-refresh" className={className} {...props} />,
  Home: ({ className, ...props }) => <svg data-testid="icon-home" className={className} {...props} />,
}));

import {
  Spinner,
  LoadingState,
  ErrorState,
  EmptyState,
  StatusPill,
  PageHeader,
  SectionCard,
  ConfirmDialog,
  InfoBanner,
} from './shared-ui';

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
describe('Spinner', () => {
  // SVG elements use SVGAnimatedString for className in jsdom,
  // so we use getAttribute('class') instead.
  const getClasses = (el) => el.getAttribute('class') || '';

  it('renders with default size (md)', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(getClasses(svg)).toContain('w-8');
    expect(getClasses(svg)).toContain('h-8');
  });

  it('renders sm size', () => {
    const { container } = render(<Spinner size="sm" />);
    const svg = container.querySelector('svg');
    expect(getClasses(svg)).toContain('w-4');
    expect(getClasses(svg)).toContain('h-4');
  });

  it('renders lg size', () => {
    const { container } = render(<Spinner size="lg" />);
    const svg = container.querySelector('svg');
    expect(getClasses(svg)).toContain('w-12');
    expect(getClasses(svg)).toContain('h-12');
  });

  it('renders xl size', () => {
    const { container } = render(<Spinner size="xl" />);
    const svg = container.querySelector('svg');
    expect(getClasses(svg)).toContain('w-16');
    expect(getClasses(svg)).toContain('h-16');
  });

  it('applies custom className', () => {
    const { container } = render(<Spinner className="extra-class" />);
    const svg = container.querySelector('svg');
    expect(getClasses(svg)).toContain('extra-class');
  });

  it('always includes animate-spin class', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');
    expect(getClasses(svg)).toContain('animate-spin');
  });
});

// ---------------------------------------------------------------------------
// LoadingState
// ---------------------------------------------------------------------------
describe('LoadingState', () => {
  it('renders with default message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders a custom message', () => {
    render(<LoadingState message="Fetching claims..." />);
    expect(screen.getByText('Fetching claims...')).toBeInTheDocument();
  });

  it('hides message when set to empty string', () => {
    const { container } = render(<LoadingState message="" />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });

  it('applies fullScreen styles when fullScreen=true', () => {
    const { container } = render(<LoadingState fullScreen />);
    const wrapper = container.firstChild;
    expect(wrapper.className).toContain('fixed');
    expect(wrapper.className).toContain('inset-0');
    expect(wrapper.className).toContain('z-50');
  });

  it('applies inline styles when fullScreen=false', () => {
    const { container } = render(<LoadingState fullScreen={false} />);
    const wrapper = container.firstChild;
    expect(wrapper.className).toContain('py-12');
    expect(wrapper.className).not.toContain('fixed');
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingState className="my-loader" />);
    expect(container.firstChild.className).toContain('my-loader');
  });

  it('contains a Spinner', () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------
describe('ErrorState', () => {
  it('renders with default title and message', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(<ErrorState title="Network Error" message="Could not connect." />);
    expect(screen.getByText('Network Error')).toBeInTheDocument();
    expect(screen.getByText('Could not connect.')).toBeInTheDocument();
  });

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const btn = screen.getByText('Try Again');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button when onRetry is undefined', () => {
    render(<ErrorState />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('shows Go Home button when showHomeButton=true and onGoHome provided', () => {
    const onGoHome = vi.fn();
    render(<ErrorState showHomeButton onGoHome={onGoHome} />);
    const btn = screen.getByText('Go Home');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('does not show Go Home button when showHomeButton=false', () => {
    render(<ErrorState showHomeButton={false} onGoHome={vi.fn()} />);
    expect(screen.queryByText('Go Home')).not.toBeInTheDocument();
  });

  it('does not show Go Home button when onGoHome is undefined', () => {
    render(<ErrorState showHomeButton />);
    expect(screen.queryByText('Go Home')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorState className="err-custom" />);
    expect(container.firstChild.className).toContain('err-custom');
  });
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe('EmptyState', () => {
  it('renders with default title and message', () => {
    render(<EmptyState />);
    expect(screen.getByText('No data found')).toBeInTheDocument();
    expect(screen.getByText("There's nothing here yet.")).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(<EmptyState title="No Claims" message="Create your first claim." />);
    expect(screen.getByText('No Claims')).toBeInTheDocument();
    expect(screen.getByText('Create your first claim.')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Add Item" onAction={onAction} />);
    const btn = screen.getByText('Add Item');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when actionLabel missing', () => {
    render(<EmptyState onAction={vi.fn()} />);
    // No button should be rendered since actionLabel is undefined
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('does not render action button when onAction missing', () => {
    render(<EmptyState actionLabel="Click me" />);
    expect(screen.queryByText('Click me')).not.toBeInTheDocument();
  });

  it('renders a custom icon component', () => {
    const CustomIcon = (props) => <svg data-testid="custom-icon" {...props} />;
    render(<EmptyState icon={CustomIcon} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState className="empty-cls" />);
    expect(container.firstChild.className).toContain('empty-cls');
  });
});

// ---------------------------------------------------------------------------
// StatusPill
// ---------------------------------------------------------------------------
describe('StatusPill', () => {
  it('renders the raw status when no labels mapping provided', () => {
    render(<StatusPill status="active" />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders the mapped label when labels provided', () => {
    render(<StatusPill status="active" labels={{ active: 'Active', inactive: 'Inactive' }} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('falls back to raw status when status key not in labels', () => {
    render(<StatusPill status="unknown" labels={{ active: 'Active' }} />);
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('applies color class from colors map', () => {
    const { container } = render(
      <StatusPill status="active" colors={{ active: 'bg-green-100 text-green-800' }} />
    );
    const pill = container.firstChild;
    expect(pill.className).toContain('bg-green-100');
    expect(pill.className).toContain('text-green-800');
  });

  it('applies default gray color when status not in colors map', () => {
    const { container } = render(<StatusPill status="active" />);
    const pill = container.firstChild;
    expect(pill.className).toContain('bg-gray-100');
    expect(pill.className).toContain('text-gray-800');
  });

  it('renders as a span with rounded-full class', () => {
    const { container } = render(<StatusPill status="test" />);
    const pill = container.firstChild;
    expect(pill.tagName).toBe('SPAN');
    expect(pill.className).toContain('rounded-full');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusPill status="x" className="pill-extra" />);
    expect(container.firstChild.className).toContain('pill-extra');
  });
});

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------
describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders the title as an h1', () => {
    render(<PageHeader title="Dashboard" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Dashboard');
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Dashboard" subtitle="Overview of your claims" />);
    expect(screen.getByText('Overview of your claims')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<PageHeader title="Dashboard" />);
    // Only the heading text, no <p> for subtitle
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });

  it('renders actions slot', () => {
    render(
      <PageHeader title="Claims" actions={<button>New Claim</button>} />
    );
    expect(screen.getByText('New Claim')).toBeInTheDocument();
  });

  it('renders back button slot', () => {
    render(
      <PageHeader title="Detail" backButton={<button aria-label="Go back">Back</button>} />
    );
    expect(screen.getByLabelText('Go back')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PageHeader title="T" className="hdr-cls" />);
    expect(container.firstChild.className).toContain('hdr-cls');
  });
});

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------
describe('SectionCard', () => {
  it('renders children', () => {
    render(<SectionCard><p>Card content</p></SectionCard>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders title in header', () => {
    render(<SectionCard title="Settings"><p>Body</p></SectionCard>);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<SectionCard title="Settings" subtitle="Manage your preferences"><p>Body</p></SectionCard>);
    expect(screen.getByText('Manage your preferences')).toBeInTheDocument();
  });

  it('does not render header section when title and headerActions absent', () => {
    const { container } = render(<SectionCard><p>Body</p></SectionCard>);
    const borderBSection = container.querySelector('.border-b');
    expect(borderBSection).not.toBeInTheDocument();
  });

  it('renders header when headerActions provided without title', () => {
    render(<SectionCard headerActions={<button>Edit</button>}><p>Body</p></SectionCard>);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('applies padding by default', () => {
    const { container } = render(<SectionCard><p>Body</p></SectionCard>);
    // The content wrapper should have p-4
    const contentDiv = container.querySelector('.p-4');
    expect(contentDiv).toBeInTheDocument();
  });

  it('removes padding when noPadding=true', () => {
    const { container } = render(<SectionCard noPadding><p>Body</p></SectionCard>);
    const contentDiv = container.querySelector('.p-4');
    expect(contentDiv).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SectionCard className="card-cls"><p>X</p></SectionCard>);
    expect(container.firstChild.className).toContain('card-cls');
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------
describe('ConfirmDialog', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(
      <ConfirmDialog isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders when isOpen is true', () => {
    render(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item?"
        message="This cannot be undone."
      />
    );
    expect(screen.getByText('Delete Item?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    render(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
      />
    );
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
    expect(screen.getByText('No, keep')).toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog isOpen onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm and onClose when confirm button clicked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog isOpen onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop overlay clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmDialog isOpen onClose={onClose} onConfirm={vi.fn()} />);
    // The backdrop is the element with aria-hidden="true"
    const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has correct accessibility attributes', () => {
    render(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title');
  });

  it('has title element with matching id for aria-labelledby', () => {
    render(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="My Title" />);
    const titleEl = document.getElementById('confirm-dialog-title');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl).toHaveTextContent('My Title');
  });

  it('applies danger variant styles by default', () => {
    render(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} />);
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('bg-red-600');
  });

  it('applies warning variant styles', () => {
    render(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} variant="warning" />);
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('bg-amber-600');
  });

  it('applies info variant styles', () => {
    render(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} variant="info" />);
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('bg-blue-600');
  });
});

// ---------------------------------------------------------------------------
// InfoBanner
// ---------------------------------------------------------------------------
describe('InfoBanner', () => {
  it('renders title and message', () => {
    render(<InfoBanner title="Heads up" message="Something to know." />);
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Something to know.')).toBeInTheDocument();
  });

  it('renders without title (only message)', () => {
    render(<InfoBanner message="Just a message." />);
    expect(screen.getByText('Just a message.')).toBeInTheDocument();
  });

  it('renders without message (only title)', () => {
    render(<InfoBanner title="Title only" />);
    expect(screen.getByText('Title only')).toBeInTheDocument();
  });

  it('applies info type styles by default', () => {
    const { container } = render(<InfoBanner title="Info" />);
    const banner = container.firstChild;
    expect(banner.className).toContain('bg-blue-50');
    expect(banner.className).toContain('border-blue-200');
    expect(banner.className).toContain('text-blue-800');
  });

  it('applies warning type styles', () => {
    const { container } = render(<InfoBanner type="warning" title="Warn" />);
    const banner = container.firstChild;
    expect(banner.className).toContain('bg-amber-50');
    expect(banner.className).toContain('text-amber-800');
  });

  it('applies error type styles', () => {
    const { container } = render(<InfoBanner type="error" title="Err" />);
    const banner = container.firstChild;
    expect(banner.className).toContain('bg-red-50');
    expect(banner.className).toContain('text-red-800');
  });

  it('applies success type styles', () => {
    const { container } = render(<InfoBanner type="success" title="OK" />);
    const banner = container.firstChild;
    expect(banner.className).toContain('bg-green-50');
    expect(banner.className).toContain('text-green-800');
  });

  it('shows dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn();
    render(<InfoBanner title="Test" onDismiss={onDismiss} />);
    const dismissBtn = screen.getByLabelText('Dismiss notification');
    expect(dismissBtn).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<InfoBanner title="Test" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not show dismiss button when onDismiss is undefined', () => {
    render(<InfoBanner title="Test" />);
    expect(screen.queryByLabelText('Dismiss notification')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<InfoBanner title="T" className="banner-cls" />);
    expect(container.firstChild.className).toContain('banner-cls');
  });
});

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------
describe('default export', () => {
  it('exports an object containing all components', async () => {
    const mod = await import('./shared-ui');
    const defaultExport = mod.default;
    expect(defaultExport.Spinner).toBe(Spinner);
    expect(defaultExport.LoadingState).toBe(LoadingState);
    expect(defaultExport.ErrorState).toBe(ErrorState);
    expect(defaultExport.EmptyState).toBe(EmptyState);
    expect(defaultExport.StatusPill).toBe(StatusPill);
    expect(defaultExport.PageHeader).toBe(PageHeader);
    expect(defaultExport.SectionCard).toBe(SectionCard);
    expect(defaultExport.ConfirmDialog).toBe(ConfirmDialog);
    expect(defaultExport.InfoBanner).toBe(InfoBanner);
  });
});
