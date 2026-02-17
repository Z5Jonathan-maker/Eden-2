/**
 * Email Templates & Writing Style Guide
 * Based on Jonathan Cimadevilla's correspondence analysis
 * Care Claims Adjusting | Lic: W786531
 */

// ── Signature Block ──────────────────────────────────────────────
export const SIGNATURE_BLOCK = `Jonathan Cimadevilla
Public Adjuster | Lic: W786531
Care Claims Adjusting
(352) 782-2617
jonathan@careclaimsadjusting.com`;

export const SIGNATURE_BRIEF = 'Jonathan Cimadevilla';

// ── Template Categories ──────────────────────────────────────────
export const TEMPLATE_CATEGORIES = [
  { id: 'carrier', label: 'Carrier' },
  { id: 'client', label: 'Client' },
  { id: 'internal', label: 'Internal' },
];

// ── Email Templates ──────────────────────────────────────────────
export const EMAIL_TEMPLATES = [
  // ─── 1. Letter of Representation ───
  {
    id: 'lor',
    name: 'Letter of Representation',
    category: 'carrier',
    tone: 'formal',
    subject: 'Claim Number: [CLAIM#] [INSURED FULL NAME]',
    body: `Attention: [CARRIER NAME]

Insured Name: [INSURED FULL NAME]
Claim Number: [CLAIM#]

Good Day,

I will be representing the insured, [INSURED FULL NAME], on this claim. Please find the attached Letter of Representation and supporting documentation.

Thank you,

${SIGNATURE_BLOCK}`,
  },

  // ─── 2. Supplement Submission ───
  {
    id: 'supplement',
    name: 'Supplement Submission',
    category: 'carrier',
    tone: 'professional',
    subject: 'Supplement Documentation - Claim [CLAIM#] [INSURED FULL NAME]',
    body: `Good Day,

Please see the attached documentation regarding Claim [CLAIM#].

The attached files include the itemized estimate for the supplement.

Thank you,

${SIGNATURE_BLOCK}`,
  },

  // ─── 3. Settlement Demand / Counter Offer ───
  {
    id: 'settlement_demand',
    name: 'Settlement Demand',
    category: 'carrier',
    tone: 'authoritative',
    subject: 'CONFIDENTIAL Settlement Offer - Claim [CLAIM#] [INSURED FULL NAME]',
    body: `CONFIDENTIAL SETTLEMENT NEGOTIATIONS
WITHOUT PREJUDICE

Good Day,

On a confidential basis, and in a good-faith effort to reach an amicable resolution without waiving any rights under the policy, we would like to extend a settlement offer of $[AMOUNT] in new money in exchange for a full and final global release.

The basis for this offer is as follows:

1. [ITEM DESCRIPTION]
   - Carrier's Position: $[CARRIER_AMOUNT]
   - Verified Estimate: $[VERIFIED_AMOUNT]
   - Valuation Difference: $[DIFFERENCE]
   - Reference: [XACTIMATE CODE / FBC SECTION / FS CITATION]

2. [ITEM DESCRIPTION]
   - Carrier's Position: $[CARRIER_AMOUNT]
   - Verified Estimate: $[VERIFIED_AMOUNT]
   - Valuation Difference: $[DIFFERENCE]
   - Reference: [XACTIMATE CODE / FBC SECTION / FS CITATION]

───────────────────────────────────
VALUATION SUMMARY
───────────────────────────────────
Carrier's Estimate:    $[CARRIER_TOTAL]
Our Verified Estimate: $[VERIFIED_TOTAL]
Prior Payments:        $[PRIOR_PAYMENTS]
New Money Requested:   $[NEW_MONEY]
───────────────────────────────────

Please confirm if this is agreeable so we can proceed with the necessary release and bring this matter to a conclusion.

Respectfully,

${SIGNATURE_BLOCK}`,
  },

  // ─── 4. Follow-Up / Nudge ───
  {
    id: 'followup',
    name: 'Follow-Up / Status Check',
    category: 'carrier',
    tone: 'friendly',
    subject: 'Re: Claim [CLAIM#] [INSURED FULL NAME]',
    body: `Good Day!

Just reaching out to check on the status of Claim [CLAIM#]. Please advise when you have a moment.

Thank you!

${SIGNATURE_BRIEF}`,
  },

  // ─── 5. Counter Offer Nudge ───
  {
    id: 'counter_nudge',
    name: 'Counter Offer Follow-Up',
    category: 'carrier',
    tone: 'friendly',
    subject: 'Re: Claim [CLAIM#] - Settlement Offer',
    body: `Good Day!

Please advise on our counter offer for Claim [CLAIM#] at your earliest convenience.

Thank you!

${SIGNATURE_BRIEF}`,
  },

  // ─── 6. Escalation / DFS Warning ───
  {
    id: 'escalation_dfs',
    name: 'Escalation / DFS Warning',
    category: 'carrier',
    tone: 'escalation',
    subject: 'URGENT - Claim [CLAIM#] [INSURED FULL NAME] - Outstanding Response Required',
    body: `Good Day,

We have been reaching out for [X] weeks now with no response regarding Claim [CLAIM#]. We are trying to avoid naming you in a complaint with the Department of Financial Services.

The insured is willing to settle for $[AMOUNT] new money without the need for further escalation. Today marks [X] days since we submitted our [demand/supplement] on [DATE].

Pursuant to FS 627.70131(7)(a): "Within 90 days after an insurer receives notice of an initial, reopened, or supplemental property insurance claim from a policyholder, the insurer shall pay or deny such claim or a portion of the claim unless the failure to pay is caused by factors beyond the control of the insurer which reasonably prevent such payment."

Continued failure to acknowledge these documented deficiencies may be perceived as a violation of the insurer's duty of good faith pursuant to FS 626.9541(1)(i).

Please advise on resolution at your earliest convenience.

Respectfully,

${SIGNATURE_BLOCK}`,
  },

  // ─── 7. Offer Rejection ───
  {
    id: 'offer_rejection',
    name: 'Offer Rejection + Counter',
    category: 'carrier',
    tone: 'authoritative',
    subject: 'Re: Claim [CLAIM#] - Settlement Response',
    body: `Good Day,

We respectfully reject this offer. The carrier's valuation contains the following discrepancies:

1. [LINE ITEM]: Carrier omitted [SCOPE DESCRIPTION]. Per Florida Building Code [FBC SECTION], [EXPLANATION]. Verified cost: $[AMOUNT].

2. [LINE ITEM]: Carrier applied incorrect pricing of $[CARRIER_PRICE]/sq vs. Xactimate-verified $[CORRECT_PRICE]/sq. Valuation difference: $[DIFFERENCE].

3. [LINE ITEM]: [DESCRIPTION OF ERROR]. Reference: FS [STATUTE SECTION].

In a good-faith effort to resolve this claim, we are prepared to accept $[COUNTER_AMOUNT] in new money as a global settlement.

Let's get this one closed out. Please advise.

Respectfully,

${SIGNATURE_BLOCK}`,
  },

  // ─── 8. Settlement Acceptance ───
  {
    id: 'acceptance',
    name: 'Settlement Acceptance',
    category: 'carrier',
    tone: 'decisive',
    subject: 'Re: Claim [CLAIM#] - Accepted',
    body: `Good Day,

We accept the offer. Forward release.

Thank you,

${SIGNATURE_BRIEF}`,
  },

  // ─── 9. Client Update ───
  {
    id: 'client_update',
    name: 'Client Status Update',
    category: 'client',
    tone: 'warm',
    subject: 'Update on Your Claim - [CLAIM#]',
    body: `Hi [Mr./Ms. FIRST NAME],

I wanted to give you an update on your claim.

[UPDATE DETAILS]

In simple terms: [PLAIN ENGLISH SUMMARY OF WHAT THIS MEANS FOR THE CLIENT].

We have been relentlessly following up with the carrier to get this resolved as quickly as possible. I will keep you posted on any developments.

Thank you,

${SIGNATURE_BLOCK}`,
  },

  // ─── 10. Client Payment Breakdown ───
  {
    id: 'client_payment',
    name: 'Client Payment Explanation',
    category: 'client',
    tone: 'warm',
    subject: 'Payment Update - Claim [CLAIM#]',
    body: `Hi [Mr./Ms. FIRST NAME],

Great news! We have received payment on your claim. Here is the breakdown:

Total Settlement:     $[TOTAL]
Less Deductible:      $[DEDUCTIBLE]
Less Prior Payments:  $[PRIOR]
Net Payment:          $[NET]

In simple terms: You will be receiving a check for $[NET] which covers [DESCRIPTION OF WHAT IS COVERED].

[ADDITIONAL NOTES IF RECOVERABLE DEPRECIATION APPLIES]

If you have any questions at all, please do not hesitate to reach out.

Thank you!

${SIGNATURE_BLOCK}`,
  },

  // ─── 11. Phone-to-Email Redirect ───
  {
    id: 'phone_redirect',
    name: 'Redirect to Email',
    category: 'carrier',
    tone: 'professional',
    subject: 'Re: Claim [CLAIM#]',
    body: `Good Day,

I'm currently in the field today and will be out of the office, so phone availability is limited. For the sake of efficiency and to ensure I can review any figures or details accurately, please feel free to email me the details of the counter-settlement offer.

Thank you!

${SIGNATURE_BRIEF}`,
  },
];

// ── Tone Descriptions (for UI display) ───────────────────────────
export const TONE_LABELS = {
  formal: 'Formal & Professional',
  professional: 'Professional',
  friendly: 'Friendly & Brief',
  authoritative: 'Authoritative & Precise',
  escalation: 'Firm & Legal',
  decisive: 'Brief & Decisive',
  warm: 'Warm & Reassuring',
};

// ── Writing Style Rules (for AI/Eve reference) ───────────────────
export const WRITING_STYLE_RULES = [
  'Always open with a time-of-day greeting: "Good Day," "Good Morning," "Good Afternoon," or "Good Evening." Never open without one.',
  'Use respectful honorifics for adjusters ("Ms. [First Name]") and clients ("Mr./Ms. [First Name]"). Never use last names alone without the honorific.',
  'Keep follow-up emails extremely brief — one to two sentences max. Let the friendliness carry the urgency.',
  'Use exclamation points generously in collaborative/positive contexts. Drop them entirely in legal escalation emails.',
  'Frame all settlement discussions in "new money" terms. Always specify the dollar amount the insured would receive above prior payments.',
  'When rejecting a carrier offer, lead with "We respectfully reject this offer" and follow immediately with a numbered, itemized breakdown of discrepancies.',
  'Cite Florida Statutes by exact section (FS §627.70131, FS §626.9744, FS §626.9541(1)(i)) and Florida Building Code sections where applicable.',
  'Include Xactimate line item codes, per-square pricing, and valuation differences when disputing scope.',
  'Always offer a path to resolution, even in escalation emails. Pair threats with settlement offers.',
  'When accepting an offer, be decisively brief: "We accept the offer. Forward release." No elaboration needed.',
  'Keep negotiations in writing. If a carrier requests a phone call, redirect to email for documentation purposes.',
  'CC the insured on escalation emails to signal transparency and create accountability pressure.',
  'Close formal emails with "Respectfully," and the full signature block. Close friendly follow-ups with "Thank you!" and just the name.',
  'Never be emotionally reactive. Even the strongest legal language should feel measured, factual, and strategic — never angry.',
  'Use religious/faith-based language sparingly and only with clients ("prayerfully"). Never use it with carriers.',
];

// ── Negotiation Escalation Ladder ────────────────────────────────
export const ESCALATION_LADDER = [
  { phase: 1, name: 'Rapport', action: 'Build relationship with adjuster', tone: 'Warm, friendly, collaborative', template: null },
  { phase: 2, name: 'Document', action: 'Submit estimate, photos, codes', tone: 'Professional, thorough', template: 'supplement' },
  { phase: 3, name: 'Nudge', action: 'Friendly persistent follow-ups', tone: 'Brief, upbeat', template: 'followup' },
  { phase: 4, name: 'Demand', action: 'Formal settlement offer with rationale', tone: 'Authoritative, precise', template: 'settlement_demand' },
  { phase: 5, name: 'Pressure', action: 'Cite statutes, deadlines, DFS', tone: 'Firm, legal', template: 'escalation_dfs' },
  { phase: 6, name: 'Escalate', action: 'Threaten/file DFS complaint', tone: 'Direct, consequences-focused', template: 'escalation_dfs' },
  { phase: 7, name: 'Settle', action: 'Accept or counter at strategic number', tone: 'Concise, decisive', template: 'acceptance' },
];
