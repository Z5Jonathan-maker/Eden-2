/**
 * ClientStatusPanel - Shows claim stage progress and next actions
 * Used in ClaimDetails for adjusters and simplified view for clients
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Loader2,
  MessageSquare,
  Copy,
  ExternalLink,
  Presentation,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useClientStatus, CLAIM_STAGES } from '../hooks/useClientStatus';
import { useGamma } from '../hooks/useGamma';
import { toast } from 'sonner';

// Stage Progress Bar Component
const StageProgressBar = ({ currentStage, onStageClick, editable = false }) => {
  const currentOrder = CLAIM_STAGES.find((s) => s.id === currentStage)?.order || 1;

  return (
    <div className="flex items-center justify-between w-full mb-4">
      {CLAIM_STAGES.map((stage, index) => {
        const isCompleted = stage.order < currentOrder;
        const isCurrent = stage.id === currentStage;
        const isUpcoming = stage.order > currentOrder;

        return (
          <React.Fragment key={stage.id}>
            {/* Stage dot/circle */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => editable && onStageClick && onStageClick(stage.id)}
                disabled={!editable}
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                  transition-all duration-200
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-200' : ''}
                  ${isUpcoming ? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400' : ''}
                  ${editable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                `}
                data-testid={`stage-${stage.id}`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : stage.order}
              </button>
              <span
                className={`
                text-xs mt-1 whitespace-nowrap
                ${isCurrent ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}
              `}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {index < CLAIM_STAGES.length - 1 && (
              <div
                className={`
                flex-1 h-0.5 mx-2
                ${stage.order < currentOrder ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
              `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Client Update Modal
const ClientUpdateModal = ({
  isOpen,
  onClose,
  generatedUpdate,
  onCreateDeck,
  creatingDeck,
  claimNumber,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !generatedUpdate) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedUpdate.message);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Client Update Generated</h3>
            <p className="text-sm text-gray-500">Claim #{claimNumber}</p>
          </div>
          <Badge variant="outline">{generatedUpdate.stage_label}</Badge>
        </div>

        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <div className="text-sm text-gray-500 mb-2">
            Subject: {generatedUpdate.suggested_subject}
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg whitespace-pre-wrap text-sm">
            {generatedUpdate.message}
          </div>
        </div>

        <div className="p-4 border-t dark:border-gray-700 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="flex-1"
            data-testid="copy-update-btn"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Text'}
          </Button>

          <Button
            onClick={onCreateDeck}
            disabled={creatingDeck}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
            data-testid="create-deck-btn"
          >
            {creatingDeck ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Presentation className="w-4 h-4 mr-2" />
            )}
            {creatingDeck ? 'Creating...' : 'Create Gamma Deck'}
          </Button>

          <Button variant="ghost" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Panel Component
export const ClientStatusPanel = ({ claimId, isClientView = false, compact = false }) => {
  const {
    status,
    loading,
    error,
    generatingUpdate,
    generatedUpdate,
    fetchStatus,
    generateUpdate,
    createClientDeck,
    updateStage,
    clearGeneratedUpdate,
  } = useClientStatus(claimId);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [toneDropdown, setToneDropdown] = useState(false);

  useEffect(() => {
    if (claimId) {
      fetchStatus();
    }
  }, [claimId, fetchStatus]);

  const handleGenerateUpdate = async (tone = 'encouraging') => {
    setToneDropdown(false);
    try {
      await generateUpdate(tone);
      setShowUpdateModal(true);
    } catch (err) {
      toast.error(err.message || 'Failed to generate update');
    }
  };

  const handleCreateDeck = async () => {
    setCreatingDeck(true);
    try {
      const result = await createClientDeck();
      if (result.edit_url) {
        toast.success('Client deck created!', {
          action: {
            label: 'Open in Gamma',
            onClick: () => window.open(result.edit_url, '_blank'),
          },
        });
        window.open(result.edit_url, '_blank');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create deck');
    } finally {
      setCreatingDeck(false);
    }
  };

  const handleStageClick = async (newStage) => {
    if (isClientView) return; // Clients can't change stage

    try {
      await updateStage(newStage);
      toast.success(`Stage updated to ${CLAIM_STAGES.find((s) => s.id === newStage)?.label}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update stage');
    }
  };

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (error && !status) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-500">{error}</CardContent>
      </Card>
    );
  }

  if (!status) return null;

  // Client View - Simplified
  if (isClientView) {
    return (
      <Card data-testid="client-status-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Your Claim Status</span>
            <Badge variant="outline" className="text-blue-600">
              {status.stage_label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StageProgressBar currentStage={status.stage} editable={false} />

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-sm">{status.status_text}</p>
          </div>

          {status.next_actions_firm && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">What We're Doing</h4>
              <p className="text-sm">{status.next_actions_firm}</p>
            </div>
          )}

          {status.next_actions_client && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                What We Need From You
              </h4>
              <p className="text-sm">{status.next_actions_client}</p>
            </div>
          )}

          {status.last_client_update_at && (
            <p className="text-xs text-gray-400">
              Last updated: {new Date(status.last_client_update_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Adjuster View - Full Controls
  return (
    <>
      <Card data-testid="client-status-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Client Status</span>
            <Badge variant="outline">{status.stage_label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StageProgressBar
            currentStage={status.stage}
            onStageClick={handleStageClick}
            editable={true}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              <h4 className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                What We're Doing
              </h4>
              <p className="text-sm">{status.next_actions_firm || 'Processing claim...'}</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1 uppercase tracking-wider">
                What We Need From Client
              </h4>
              <p className="text-sm">{status.next_actions_client || 'No action needed'}</p>
            </div>
          </div>

          {status.last_client_update_at && (
            <p className="text-xs text-gray-400">
              Last client update: {new Date(status.last_client_update_at).toLocaleString()}
            </p>
          )}

          {/* Generate Update Button with Tone Dropdown */}
          <div className="relative">
            <div className="flex gap-2">
              <Button
                onClick={() => handleGenerateUpdate('encouraging')}
                disabled={generatingUpdate}
                className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white"
                data-testid="generate-update-btn"
              >
                {generatingUpdate ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4 mr-2" />
                )}
                {generatingUpdate ? 'Eve is writing...' : 'Generate Client Update (Eve)'}
              </Button>

              <Button
                variant="outline"
                onClick={() => setToneDropdown(!toneDropdown)}
                className="px-2"
              >
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${toneDropdown ? 'rotate-180' : ''}`}
                />
              </Button>
            </div>

            {toneDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 overflow-hidden">
                <div className="p-2 text-xs text-gray-500 border-b dark:border-gray-700">
                  Select Tone
                </div>
                <button
                  onClick={() => handleGenerateUpdate('encouraging')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  😊 Encouraging
                </button>
                <button
                  onClick={() => handleGenerateUpdate('professional')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  📋 Professional
                </button>
                <button
                  onClick={() => handleGenerateUpdate('urgent')}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  ⚡ Urgent
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Update Modal */}
      <ClientUpdateModal
        isOpen={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false);
          clearGeneratedUpdate();
        }}
        generatedUpdate={generatedUpdate}
        onCreateDeck={handleCreateDeck}
        creatingDeck={creatingDeck}
        claimNumber={status.claim_number}
      />
    </>
  );
};

export default ClientStatusPanel;
