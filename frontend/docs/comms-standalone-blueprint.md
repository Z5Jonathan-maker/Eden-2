# Eden Comms Standalone Blueprint (Integrated with Eden)

Date: 2026-02-12
Scope: employee comms, announcement channels, client messaging, Twilio voice, media/GIF/files, AI-agent readiness

## 1) Current Eden evidence (already present)

Frontend:
- `frontend/src/components/CommCenterChat.jsx`: Twilio Conversations internal chat bootstrap + claim thread launcher.
- `frontend/src/components/CommCenterThread.jsx`: claim-centric thread with SMS panel and dialer.
- `frontend/src/components/ClaimCommsPanel.jsx`: SMS chat UI, templates, AI draft hook to `/api/ai/task`.
- `frontend/src/components/CommCenterDialer.jsx`: outbound call trigger to `/api/twilio/voice/outbound`.
- `frontend/src/components/VoiceAssistantConsole.jsx`: call review/config surface.

Backend:
- `backend/routes/comm_conversations.py`: init conversation + token refresh endpoints.
- `backend/services/twilio_conversations.py`: Twilio Conversations token/conversation/participant helpers.
- `backend/routes/messaging_sms.py`: claim SMS send, webhook ingest, rate limit, QA gate.
- `backend/routes/twilio_voice.py`: inbound voice flow, script/guardrail framework.

Conclusion: base primitives exist, but this is not yet a full standalone comms product.

## 2) What is missing for standalone-grade comms

1. Conversation model is too thin
- Need first-class channel/entity model: workspace, channel, membership, role, policy, retention.

2. Announcement-only channels
- Need role-enforced posting rights with reactions/read receipts for others.

3. Unified inbox
- Need one inbox for internal + claim/client channels with assignment/triage states.

4. Media + GIF pipeline
- Twilio media supported, but UI flow for file gallery, preview, and GIF pickers is not complete.

5. Presence + reliability
- Need unread counters, delivery receipts, retry semantics, typing/presence coherence.

6. Permissions and governance
- Need granular RBAC: who can create channels, invite, export transcripts, delete messages.

7. Automation substrate
- Need event bus + trigger engine before large AI wave rollout.

8. Compliance + auditability
- Need retention policies, legal hold/export, immutable message audit timeline.

## 3) Target architecture (build-on, not rewrite)

### A) Core Comms Domain
Collections/tables:
- `comms_workspaces`
- `comms_channels`
- `comms_channel_memberships`
- `comms_messages`
- `comms_message_attachments`
- `comms_read_state`
- `comms_announcements`
- `comms_policies`
- `comms_automation_rules`
- `comms_events`

Channel types:
- `internal_public`
- `internal_private`
- `announcement_only`
- `claim_client`
- `claim_internal`

Role model:
- `owner`, `admin`, `manager`, `agent`, `viewer`, `client_proxy`

### B) Transport Layer
- Twilio Conversations for chat + media.
- Twilio Messaging for SMS fallback and channel bridge.
- Twilio Voice for call handling and summaries.
- Eden keeps canonical metadata/mapping (claim_id, client_id, team_id, policy tags).

### C) Comms Gateway API
Additive routes:
- `GET /api/comms/inbox`
- `POST /api/comms/channels`
- `POST /api/comms/channels/{id}/members`
- `POST /api/comms/channels/{id}/messages`
- `POST /api/comms/channels/{id}/attachments`
- `POST /api/comms/channels/{id}/announcement`
- `POST /api/comms/automation/rules`
- `GET /api/comms/audit/export`

### D) Automation Layer (AI-ready)
- Event stream emits: message_sent, call_completed, attachment_uploaded, claim_status_changed, SLA_breach_risk.
- Rule engine triggers: templates, reminders, escalation, AI draft suggestions, voice follow-up tasks.
- Human-in-the-loop approvals for outbound client-facing automations.

## 4) Product surfaces to build

1. `Comms Home`
- Unified inbox, channel filters, SLA badges, assignment states.

2. `Team Channels`
- Rich chat, file uploads, GIF picker, pinned messages, thread replies.

3. `Announcements`
- Write-restricted channels, scheduled posts, mandatory acknowledgements.

4. `Claim Rooms`
- Split-pane: internal notes + client thread + recent calls + key claim timeline.

5. `Dialer + Calls`
- One-click call, disposition capture, transcript, summary, follow-up task creation.

6. `Comms Admin`
- RBAC, retention, templates, automation rules, AI policy controls.

## 5) AI wave strategy

Wave 1 (safe productivity)
- Suggested replies, message QA checks, call summaries, auto-tags.

Wave 2 (operational automation)
- SLA risk nudges, follow-up sequencing, announcement drafting.

Wave 3 (agentic workflows)
- Voice/SMS agents for after-hours intake, escalation routing, auto-drafted handoff packets.

Provider split:
- OpenAI: low-latency drafting/classification.
- Anthropic: long-context synthesis and policy-safe reasoning.

## 6) Implementation sequence (8 weeks)

1. Channel/domain schema + migrations.
2. Unified inbox API + UI.
3. Announcement-only channels + policy enforcement.
4. Attachments + GIF support + preview/cdn pipeline.
5. Read state/unread counters/presence improvements.
6. Claim room merge (SMS + internal + voice timeline).
7. Automation rules engine + event log.
8. AI copilot and approval workflows.
9. Audit export/retention/legal hold.
10. Perf pass (pagination, websocket fanout, retries, backpressure).

## 7) Inspiration extracted (without copying proprietary code)

- Drodat-style: one command center across inspection/data/contracts/comms.
- Enzy-style: high adoption from tight mobile loops + leaderboard/incentive awareness.
- Open-source proven patterns:
  - Chatwoot: omnichannel inbox and assignment model.
  - Rocket.Chat/Mattermost/Zulip: channel/role/thread governance patterns.
- Twilio best-fit: Conversations + Media + Roles + Voice as transport primitives.

## 8) Guardrails

- No removal of existing Eden claims/comms flows.
- Backward compatible adapters for current routes/components.
- Outbound AI actions require policy + approval for client-facing channels.
- All message/call automations logged with actor and decision trace.
