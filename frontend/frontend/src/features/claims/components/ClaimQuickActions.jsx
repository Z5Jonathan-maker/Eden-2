import React from 'react';
import {
  Shield,
  CalendarPlus,
  Camera,
  MessageSquare,
  Sparkles,
  FileText,
  FileCheck,
  Target,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Presentation,
  ChevronDown,
} from 'lucide-react';
import { GAMMA_AUDIENCES } from '../../../hooks/useGamma';

const ClaimQuickActions = ({
  navigate,
  openScheduleModal,
  handleGenerateAIBrief,
  loadingAiBrief,
  handleGenerateAIDraft,
  loadingAiDraft,
  handleGenerateReport,
  generatingReport,
  handleGenerateDemandManifest,
  loadingDemandManifest,
  handleGenerateCopilotActions,
  loadingCopilotActions,
  copilotActions,
  copilotEvidenceGaps,
  copilotMeta,
  getCopilotGapSeverityClass,
  executeCopilotGapCta,
  aiBrief,
  aiDraft,
  handoffAIDraftToComms,
  copyAIDraft,
  handleSendAIDraftEmail,
  sendingAIDraftEmail,
  handleOpenClaimEditor,
  floridaReadiness,
  getDeadlineStatusColor,
  demandManifest,
  handleExportManifestChecklist,
  showDeckMenu,
  setShowDeckMenu,
  generatingDeck,
  handleGenerateDeck,
}) => {
  return (
    <div className="card-tactical p-5">
      <div className="flex items-center gap-3 mb-5">
        <Shield className="w-5 h-5 text-orange-500" />
        <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">
          Quick Deploy
        </h2>
      </div>
      <div className="space-y-3">
        {/* Schedule Appointment */}
        <button
          className="w-full px-4 py-3 rounded bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          onClick={openScheduleModal}
          data-testid="schedule-appointment-btn"
        >
          <CalendarPlus className="w-4 h-4" />
          Schedule Appointment
        </button>

        <button
          className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          onClick={() => navigate('/inspections')}
          data-testid="start-inspection-btn"
        >
          <Camera className="w-4 h-4" />
          Start Recon
        </button>
        <button
          className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-blue-400 hover:border-blue-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          onClick={() => navigate('/eve')}
          data-testid="ask-eve-btn"
        >
          <MessageSquare className="w-4 h-4" />
          Agent Eve
        </button>
        <button
          className="w-full px-4 py-3 rounded border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          onClick={handleGenerateAIBrief}
          disabled={loadingAiBrief}
          data-testid="generate-ai-brief-btn"
        >
          {loadingAiBrief ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Brief...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI Claim Brief
            </>
          )}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="px-3 py-2 rounded border border-blue-500/30 text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
            onClick={() => handleGenerateAIDraft('client', 'email')}
            disabled={loadingAiDraft}
            data-testid="generate-ai-client-email-btn"
          >
            {loadingAiDraft ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Client Email
          </button>
          <button
            className="px-3 py-2 rounded border border-purple-500/30 text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
            onClick={() => handleGenerateAIDraft('carrier', 'email')}
            disabled={loadingAiDraft}
            data-testid="generate-ai-carrier-email-btn"
          >
            {loadingAiDraft ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Carrier Email
          </button>
          <button
            className="px-3 py-2 rounded border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
            onClick={() => handleGenerateAIDraft('client', 'sms')}
            disabled={loadingAiDraft}
            data-testid="generate-ai-client-sms-btn"
          >
            {loadingAiDraft ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Client SMS
          </button>
          <button
            className="px-3 py-2 rounded border border-amber-500/30 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
            onClick={() => handleGenerateAIDraft('carrier', 'sms')}
            disabled={loadingAiDraft}
            data-testid="generate-ai-carrier-sms-btn"
          >
            {loadingAiDraft ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Carrier SMS
          </button>
        </div>
        <button
          className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          onClick={handleGenerateReport}
          disabled={generatingReport}
          data-testid="generate-report-btn"
        >
          {generatingReport ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Open Reports
            </>
          )}
        </button>
        <button
          className="w-full px-4 py-3 rounded border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          onClick={handleGenerateDemandManifest}
          disabled={loadingDemandManifest}
          data-testid="generate-demand-manifest-btn"
        >
          {loadingDemandManifest ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Building Manifest...
            </>
          ) : (
            <>
              <FileCheck className="w-4 h-4" />
              Demand Package
            </>
          )}
        </button>
        <button
          className="w-full px-4 py-3 rounded border border-violet-500/30 text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all disabled:opacity-60"
          onClick={handleGenerateCopilotActions}
          disabled={loadingCopilotActions}
          data-testid="generate-copilot-actions-btn"
        >
          {loadingCopilotActions ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Thinking Next Steps...
            </>
          ) : (
            <>
              <Target className="w-4 h-4" />
              Copilot Next Actions
            </>
          )}
        </button>

        {Array.isArray(copilotActions) && copilotActions.length > 0 && (
          <div
            className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2"
            data-testid="copilot-actions-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono uppercase text-violet-300">Claim Copilot</p>
              <p className="text-[10px] text-zinc-500">
                {copilotMeta?.provider || 'unknown'} / {copilotMeta?.model || 'unknown'} /{' '}
                {copilotMeta?.confidence || 'medium'}
              </p>
            </div>
            <ul className="space-y-2">
              {copilotActions.map((action, idx) => (
                <li
                  key={`copilot-action-${idx}`}
                  className="rounded border border-violet-500/20 bg-zinc-900/50 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-zinc-100">{action.title}</p>
                    <span className="text-[10px] uppercase font-mono text-violet-300">
                      {action.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">{action.rationale}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase font-mono">
                    Owner: {action.owner || 'adjuster'} | ETA: {action.eta_hours || 4}h
                  </p>
                </li>
              ))}
            </ul>
            {Array.isArray(copilotEvidenceGaps) && copilotEvidenceGaps.length > 0 && (
              <div className="pt-2 border-t border-violet-500/20 space-y-2">
                <p className="text-[10px] uppercase font-mono text-zinc-500">Evidence Gaps</p>
                <ul className="space-y-2">
                  {copilotEvidenceGaps.slice(0, 4).map((gap, idx) => (
                    <li
                      key={`copilot-gap-${idx}`}
                      className="rounded border border-violet-500/20 bg-zinc-900/50 p-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium text-zinc-100">
                            {gap.title || 'Evidence gap'}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-1">
                            {gap.rationale || gap.recommended_action}
                          </p>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-mono ${getCopilotGapSeverityClass(gap.severity)}`}
                        >
                          {String(gap.severity || 'medium')}
                        </span>
                      </div>
                      {gap.recommended_action && (
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase font-mono">
                          {gap.recommended_action}
                        </p>
                      )}
                      <button
                        onClick={() => executeCopilotGapCta(gap)}
                        className="mt-2 px-2 py-1 rounded border border-violet-500/30 text-violet-200 hover:bg-violet-500/10 text-[10px] uppercase font-mono flex items-center gap-1"
                      >
                        <ChevronRight className="w-3 h-3" />
                        Resolve
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {aiBrief && (
          <div
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2"
            data-testid="ai-brief-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono uppercase text-cyan-300">AI Brief</p>
              <p className="text-[10px] text-zinc-500">
                {aiBrief.provider} / {aiBrief.model}
              </p>
            </div>
            <p className="text-xs text-zinc-200 whitespace-pre-wrap">{aiBrief.summary}</p>
            {Array.isArray(aiBrief.blockers) && aiBrief.blockers.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">Blockers</p>
                <ul className="space-y-1">
                  {aiBrief.blockers.slice(0, 3).map((item, idx) => (
                    <li key={`blocker-${idx}`} className="text-[11px] text-amber-300">
                      - {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pt-2 border-t border-cyan-500/20">
              <p className="text-[10px] uppercase font-mono text-zinc-500 mb-2">
                AI Suggested Actions
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleGenerateAIDraft('client', 'sms')}
                  disabled={loadingAiDraft}
                  className="px-2.5 py-2 rounded border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-[10px] uppercase font-mono flex items-center gap-1 disabled:opacity-60"
                  data-testid="ai-action-client-followup"
                >
                  <Sparkles className="w-3 h-3" />
                  Draft client follow-up SMS
                </button>
                <button
                  onClick={() => handleGenerateAIDraft('carrier', 'email')}
                  disabled={loadingAiDraft}
                  className="px-2.5 py-2 rounded border border-blue-500/30 text-blue-300 hover:bg-blue-500/10 text-[10px] uppercase font-mono flex items-center gap-1 disabled:opacity-60"
                  data-testid="ai-action-carrier-update"
                >
                  <Sparkles className="w-3 h-3" />
                  Draft carrier status email
                </button>
                {Array.isArray(aiBrief.blockers) &&
                  aiBrief.blockers.some((b) =>
                    String(b).toLowerCase().includes('missing core claim fields')
                  ) && (
                    <button
                      onClick={handleOpenClaimEditor}
                      className="px-2.5 py-2 rounded border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-[10px] uppercase font-mono flex items-center gap-1"
                      data-testid="ai-action-fix-missing-fields"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Fix missing core claim fields
                    </button>
                  )}
                {Array.isArray(aiBrief.blockers) &&
                  aiBrief.blockers.some((b) =>
                    String(b).toLowerCase().includes('no claim documents uploaded')
                  ) && (
                    <button
                      onClick={() => navigate('/documents')}
                      className="px-2.5 py-2 rounded border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-[10px] uppercase font-mono flex items-center gap-1"
                      data-testid="ai-action-upload-documents"
                    >
                      <FileText className="w-3 h-3" />
                      Upload supporting documents
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}
        {aiDraft && (
          <div
            className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2"
            data-testid="ai-draft-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono uppercase text-blue-300">
                AI Draft ({aiDraft.audience} / {aiDraft.channel})
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={handoffAIDraftToComms}
                  className="px-2 py-1 rounded border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10 text-[10px] uppercase font-mono"
                  data-testid="use-ai-draft-in-comms-btn"
                >
                  Use In Comms
                </button>
                <button
                  onClick={() => handoffAIDraftToComms(true)}
                  className="px-2 py-1 rounded border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10 text-[10px] uppercase font-mono"
                  data-testid="use-ai-draft-send-now-btn"
                >
                  Use & Send
                </button>
                <button
                  onClick={copyAIDraft}
                  className="px-2 py-1 rounded border border-blue-500/30 text-blue-200 hover:bg-blue-500/10 text-[10px] uppercase font-mono"
                  data-testid="copy-ai-draft-btn"
                >
                  Copy
                </button>
                {aiDraft.channel === 'email' && (
                  <button
                    onClick={handleSendAIDraftEmail}
                    disabled={sendingAIDraftEmail}
                    className="px-2 py-1 rounded border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10 text-[10px] uppercase font-mono disabled:opacity-60"
                    data-testid="send-ai-draft-email-btn"
                  >
                    {sendingAIDraftEmail ? 'Sending...' : 'Send AI Email'}
                  </button>
                )}
              </div>
            </div>
            {aiDraft.subject && (
              <p className="text-[11px] text-zinc-300">
                <span className="text-zinc-500">Subject:</span> {aiDraft.subject}
              </p>
            )}
            <p className="text-xs text-zinc-200 whitespace-pre-wrap">{aiDraft.body}</p>
            {Array.isArray(aiDraft.bullets) && aiDraft.bullets.length > 0 && (
              <div>
                <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                  Included facts
                </p>
                <ul className="space-y-1">
                  {aiDraft.bullets.slice(0, 3).map((item, idx) => (
                    <li key={`draft-bullet-${idx}`} className="text-[11px] text-zinc-300">
                      - {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {floridaReadiness && (
          <div
            className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-3 space-y-3"
            data-testid="florida-readiness-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono uppercase text-orange-300">
                Florida Readiness
              </p>
              <p className="text-[11px] font-mono text-orange-200">
                {floridaReadiness.readiness_score || 0}/100
              </p>
            </div>

            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                style={{
                  width: `${Math.max(0, Math.min(100, floridaReadiness.readiness_score || 0))}%`,
                }}
              />
            </div>

            {Array.isArray(floridaReadiness.missing_fields) &&
              floridaReadiness.missing_fields.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                    Missing Critical Fields
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {floridaReadiness.missing_fields.map((field) => (
                      <span
                        key={field}
                        className="px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-[10px] text-red-300"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {Array.isArray(floridaReadiness.deadlines) &&
              floridaReadiness.deadlines.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-mono text-zinc-500">Deadlines</p>
                  {floridaReadiness.deadlines.slice(0, 2).map((deadline) => (
                    <div
                      key={deadline.id}
                      className={`rounded border px-2 py-1 text-[11px] ${getDeadlineStatusColor(deadline.status)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{deadline.label}</span>
                        <span className="font-mono">
                          {typeof deadline.days_remaining === 'number'
                            ? `${deadline.days_remaining}d`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {Array.isArray(floridaReadiness.evidence_checklist) &&
              floridaReadiness.evidence_checklist.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-mono text-zinc-500">
                    Evidence Checklist
                  </p>
                  {floridaReadiness.evidence_checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-[11px] text-zinc-300"
                    >
                      <span className="truncate pr-2">{item.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded border ${item.complete ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-zinc-400 border-zinc-600/40 bg-zinc-800/50'}`}
                      >
                        {item.complete ? 'OK' : 'MISSING'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

            {Array.isArray(floridaReadiness.recommended_next_actions) &&
              floridaReadiness.recommended_next_actions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                    Next Action
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    {floridaReadiness.recommended_next_actions[0]}
                  </p>
                </div>
              )}

            <div className="flex items-start gap-1.5 text-[10px] text-zinc-500">
              <AlertTriangle className="w-3 h-3 mt-0.5 text-zinc-500" />
              <span>
                {floridaReadiness.disclaimer ||
                  'Operational guidance only. Confirm legal deadlines with counsel.'}
              </span>
            </div>
          </div>
        )}

        {demandManifest && (
          <div
            className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-3"
            data-testid="demand-manifest-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono uppercase text-emerald-300">
                Demand Package Manifest
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-mono text-emerald-200">
                  {demandManifest.package_score || 0}/100
                </p>
                <span
                  className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${demandManifest.ready_for_submission ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}
                >
                  {demandManifest.ready_for_submission ? 'READY' : 'NOT READY'}
                </span>
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                style={{
                  width: `${Math.max(0, Math.min(100, demandManifest.package_score || 0))}%`,
                }}
              />
            </div>

            {Array.isArray(demandManifest.section_status) &&
              demandManifest.section_status.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase font-mono text-zinc-500">
                    Section Status
                  </p>
                  {demandManifest.section_status.map((section) => (
                    <div
                      key={section.id}
                      className="flex items-center justify-between text-[11px] text-zinc-300"
                    >
                      <span className="truncate pr-2">{section.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded border ${section.complete ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}
                      >
                        {section.current_count}/{section.required_count}
                      </span>
                    </div>
                  ))}
                </div>
              )}

            {Array.isArray(demandManifest.missing_sections) &&
              demandManifest.missing_sections.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                    Missing Sections
                  </p>
                  <p className="text-[11px] text-amber-300">
                    {demandManifest.missing_sections.join(', ')}
                  </p>
                </div>
              )}

            {Array.isArray(demandManifest.submission_gate?.reasons) &&
              demandManifest.submission_gate.reasons.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                    Submission Gate
                  </p>
                  {demandManifest.submission_gate.reasons.slice(0, 2).map((reason, idx) => (
                    <p key={`gate-reason-${idx}`} className="text-[11px] text-amber-300">
                      - {reason}
                    </p>
                  ))}
                </div>
              )}

            <button
              className="w-full px-3 py-2 rounded border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 font-mono text-[11px] uppercase transition-all"
              onClick={handleExportManifestChecklist}
              data-testid="export-demand-manifest-btn"
            >
              Export Checklist JSON
            </button>

            <div className="flex items-start gap-1.5 text-[10px] text-zinc-500">
              <AlertTriangle className="w-3 h-3 mt-0.5 text-zinc-500" />
              <span>{demandManifest.disclaimer || 'Operational packaging guidance only.'}</span>
            </div>
          </div>
        )}

        {/* Gamma Presentation Decks */}
        <div className="relative">
          <button
            className="w-full px-4 py-3 rounded bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-400 hover:from-blue-600/30 hover:to-purple-600/30 font-mono text-xs uppercase flex items-center justify-between transition-all"
            onClick={() => setShowDeckMenu(!showDeckMenu)}
            disabled={!!generatingDeck}
            data-testid="gamma-deck-btn"
          >
            <span className="flex items-center gap-2">
              {generatingDeck ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Presentation className="w-4 h-4" />
              )}
              {generatingDeck
                ? `Creating ${GAMMA_AUDIENCES[generatingDeck]?.name}...`
                : 'Generate Deck'}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showDeckMenu ? 'rotate-180' : ''}`}
            />
          </button>

          {showDeckMenu && (
            <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl overflow-hidden">
              <div className="p-2 text-[10px] font-mono text-zinc-500 uppercase border-b border-zinc-700/50">
                Select Deck Type
              </div>

              {/* Client-Facing Decks */}
              <div className="p-1.5 text-[10px] font-mono text-zinc-600 uppercase bg-zinc-800/50">
                Client Decks
              </div>
              <button
                onClick={() => handleGenerateDeck('client_update')}
                className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                data-testid="deck-client-update"
              >
                <span>📋</span>
                <div>
                  <div className="font-medium">Client Update</div>
                  <div className="text-[10px] text-zinc-500">Status update for homeowner</div>
                </div>
              </button>
              <button
                onClick={() => handleGenerateDeck('client_approval')}
                className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                data-testid="deck-client-approval"
              >
                <span>✅</span>
                <div>
                  <div className="font-medium">Settlement Review</div>
                  <div className="text-[10px] text-zinc-500">For client approval</div>
                </div>
              </button>
              <button
                onClick={() => handleGenerateDeck('settlement')}
                className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                data-testid="deck-settlement"
              >
                <span>🎉</span>
                <div>
                  <div className="font-medium">Final Settlement</div>
                  <div className="text-[10px] text-zinc-500">Celebratory closing deck</div>
                </div>
              </button>

              {/* Internal Decks */}
              <div className="p-1.5 text-[10px] font-mono text-zinc-600 uppercase bg-zinc-800/50 border-t border-zinc-700/50">
                Internal Decks
              </div>
              <button
                onClick={() => handleGenerateDeck('rep_performance')}
                className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                data-testid="deck-rep-performance"
              >
                <span>📊</span>
                <div>
                  <div className="font-medium">Rep Performance</div>
                  <div className="text-[10px] text-zinc-500">Sales/adjuster review</div>
                </div>
              </button>
              <button
                onClick={() => handleGenerateDeck('pastor_report')}
                className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                data-testid="deck-pastor-report"
              >
                <span>✝️</span>
                <div>
                  <div className="font-medium">Ministry Report</div>
                  <div className="text-[10px] text-zinc-500">Kingdom impact report</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimQuickActions;
