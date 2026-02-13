/**
 * Smoke Tests for Extracted Claim Components
 *
 * Validates that our refactored components render without crashing.
 * Tests basic prop handling and integration patterns.
 *
 * Run: npm test -- ClaimComponents.test.jsx
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import extracted components
import ClaimHeader from '../../features/claims/components/ClaimHeader';
import ClaimEditModal from '../../features/claims/components/ClaimEditModal';
import ScheduleAppointmentModal from '../../features/claims/components/ScheduleAppointmentModal';
import PhotoViewerModal from '../../features/claims/components/PhotoViewerModal';

// Mock navigate function
const mockNavigate = jest.fn();

// Mock claim data
const mockClaim = {
  id: 'test-claim-001',
  claim_number: 'CLM-2024-001',
  client_name: 'John Doe',
  client_email: 'john@example.com',
  property_address: '123 Main St, Miami, FL',
  status: 'In Progress',
  claim_type: 'Water Damage',
  estimated_value: 50000,
  priority: 'High',
  created_by: 'user-001',
  assigned_to: 'adjuster-001'
};

const mockGetStatusColor = (status) => {
  if (status === 'In Progress') return 'badge-rare';
  if (status === 'Under Review') return 'badge-epic';
  if (status === 'Completed') return 'badge-uncommon';
  return 'badge-common';
};

describe('ClaimHeader Component', () => {
  test('renders without crashing', () => {
    render(
      <ClaimHeader
        claim={mockClaim}
        navigate={mockNavigate}
        gammaPage={null}
        creatingGammaPage={false}
        createGammaStrategyPage={jest.fn()}
        handleEditClaim={jest.fn()}
        getStatusColor={mockGetStatusColor}
      />
    );

    // Verify claim number is displayed
    expect(screen.getByText(mockClaim.claim_number)).toBeInTheDocument();
  });

  test('displays claim status badge', () => {
    render(
      <ClaimHeader
        claim={mockClaim}
        navigate={mockNavigate}
        gammaPage={null}
        creatingGammaPage={false}
        createGammaStrategyPage={jest.fn()}
        handleEditClaim={jest.fn()}
        getStatusColor={mockGetStatusColor}
      />
    );

    expect(screen.getByText(mockClaim.status)).toBeInTheDocument();
  });

  test('shows create strategy button when no gamma page exists', () => {
    render(
      <ClaimHeader
        claim={mockClaim}
        navigate={mockNavigate}
        gammaPage={null}
        creatingGammaPage={false}
        createGammaStrategyPage={jest.fn()}
        handleEditClaim={jest.fn()}
        getStatusColor={mockGetStatusColor}
      />
    );

    expect(screen.getByText('Create Strategy')).toBeInTheDocument();
  });

  test('shows strategy page button when gamma page exists', () => {
    const mockGammaPage = {
      exists: true,
      url: 'https://gamma.app/test'
    };

    render(
      <ClaimHeader
        claim={mockClaim}
        navigate={mockNavigate}
        gammaPage={mockGammaPage}
        creatingGammaPage={false}
        createGammaStrategyPage={jest.fn()}
        handleEditClaim={jest.fn()}
        getStatusColor={mockGetStatusColor}
      />
    );

    expect(screen.getByText('Strategy Page')).toBeInTheDocument();
  });
});

describe('ClaimEditModal Component', () => {
  test('renders when open', () => {
    const mockEditForm = { ...mockClaim };

    render(
      <ClaimEditModal
        isOpen={true}
        editForm={mockEditForm}
        setEditForm={jest.fn()}
        onSave={jest.fn()}
        onCancel={jest.fn()}
        isSaving={false}
      />
    );

    expect(screen.getByText('Edit Mission')).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    const mockEditForm = { ...mockClaim };

    const { container } = render(
      <ClaimEditModal
        isOpen={false}
        editForm={mockEditForm}
        setEditForm={jest.fn()}
        onSave={jest.fn()}
        onCancel={jest.fn()}
        isSaving={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test('displays client name input', () => {
    const mockEditForm = { ...mockClaim };

    render(
      <ClaimEditModal
        isOpen={true}
        editForm={mockEditForm}
        setEditForm={jest.fn()}
        onSave={jest.fn()}
        onCancel={jest.fn()}
        isSaving={false}
      />
    );

    const input = screen.getByDisplayValue(mockClaim.client_name);
    expect(input).toBeInTheDocument();
  });
});

describe('ScheduleAppointmentModal Component', () => {
  test('renders when open', () => {
    const mockAppointmentForm = {
      title: 'Test Appointment',
      date: '2024-02-15',
      time: '10:00',
      duration: 60,
      location: '123 Main St',
      description: 'Test description'
    };

    render(
      <ScheduleAppointmentModal
        open={true}
        onOpenChange={jest.fn()}
        appointmentForm={mockAppointmentForm}
        setAppointmentForm={jest.fn()}
        onSchedule={jest.fn()}
        isScheduling={false}
      />
    );

    expect(screen.getByText('Schedule Appointment')).toBeInTheDocument();
  });

  test('displays form fields', () => {
    const mockAppointmentForm = {
      title: 'Test Appointment',
      date: '2024-02-15',
      time: '10:00',
      duration: 60,
      location: '123 Main St',
      description: 'Test description'
    };

    render(
      <ScheduleAppointmentModal
        open={true}
        onOpenChange={jest.fn()}
        appointmentForm={mockAppointmentForm}
        setAppointmentForm={jest.fn()}
        onSchedule={jest.fn()}
        isScheduling={false}
      />
    );

    expect(screen.getByDisplayValue(mockAppointmentForm.title)).toBeInTheDocument();
  });
});

describe('PhotoViewerModal Component', () => {
  test('renders when photo provided', () => {
    const mockPhoto = {
      id: 'photo-001',
      room: 'Living Room',
      category: 'Water Damage',
      created_at: '2024-02-13T12:00:00Z',
      voice_transcript: 'Test transcript'
    };

    render(
      <PhotoViewerModal
        photo={mockPhoto}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText(mockPhoto.room)).toBeInTheDocument();
  });

  test('does not render when photo is null', () => {
    const { container } = render(
      <PhotoViewerModal
        photo={null}
        onClose={jest.fn()}
      />
    );

    // Component should not render anything when photo is null
    expect(container.querySelector('.max-w-4xl')).not.toBeInTheDocument();
  });
});

describe('Component Integration', () => {
  test('all components export correctly', () => {
    expect(ClaimHeader).toBeDefined();
    expect(ClaimEditModal).toBeDefined();
    expect(ScheduleAppointmentModal).toBeDefined();
    expect(PhotoViewerModal).toBeDefined();
  });

  test('components accept expected prop types', () => {
    // This test verifies components don't crash with valid props
    const validProps = {
      claim: mockClaim,
      navigate: mockNavigate,
      gammaPage: null,
      creatingGammaPage: false,
      createGammaStrategyPage: jest.fn(),
      handleEditClaim: jest.fn(),
      getStatusColor: mockGetStatusColor
    };

    expect(() => {
      render(<ClaimHeader {...validProps} />);
    }).not.toThrow();
  });
});
