'''
University Seed Data

Comprehensive course and article content for the University module.
This data can be regenerated, updated, or loaded from external sources.
'''

from datetime import datetime, timezone
import logging
from dependencies import db
from .models import Course, Lesson, Article, QuizQuestion

logger = logging.getLogger(__name__)

async def seed_university_data():
    """Seed Care Claims University courses - homeowner-focused, leverage-based claims education"""
    
    # Clear existing data to refresh with new content
    await db.courses.delete_many({})
    await db.articles.delete_many({})
    
    # ========== FOUNDATION COURSES ==========

    foundation_courses = [
        Course(
            title="Understanding Carrier Tactics",
            description="Learn to identify and counter the common tactics carriers use to underpay or deny legitimate claims. Knowledge is leverage.",
            category="Carrier Warfare",
            track="foundation",
            difficulty=1,
            est_minutes=65,
            tags=["carrier tactics", "fundamentals", "negotiation"],
            why_this_matters="Carriers are publicly traded companies that minimize payouts by design. Understanding their playbook is the first step to winning fair settlements.",
            outcomes=["Identify the 4 most common carrier underpayment tactics", "Counter lowball offers with documentation strategy", "Read carrier behavior signals to anticipate their next move"],
            thumbnail="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400",
            lessons=[
                Lesson(
                    title="The Carrier's Playbook",
                    description="Why carriers behave the way they do",
                    content="""# The Carrier's Playbook

Insurance carriers are publicly traded companies with shareholders. Their business model is simple: collect premiums, minimize payouts.

## The Core Reality
The carrier's adjuster is not your friend. They are trained to protect company reserves, not ensure you receive full indemnification. This isn't personal—it's structural.

## Common Tactics You Will Encounter

### 1. The Lowball Initial Offer
Carriers routinely issue estimates 30-60% below actual repair costs. They count on policyholders accepting out of fatigue or ignorance.

**Your response:** Never accept the first estimate. Document everything. Get your own contractor estimates.

### 2. Moving Goalposts
First they need "more documentation." Then they need a "re-inspection." Then they need an "engineering report." Each request buys time and tests your resolve.

**Your response:** Provide what's reasonable, but recognize delay tactics. Set deadlines. Document every request and response.

### 3. Depreciation Games
Carriers depreciate materials aggressively, sometimes illegally. They may withhold recoverable depreciation indefinitely.

**Your response:** Know your policy. Understand ACV vs RCV. Track what's owed.

### 4. Scope Denial
"That damage was pre-existing." "That's not storm-related." "That's maintenance, not covered loss."

**Your response:** Photos, reports, and expert opinions. Build your file before they build theirs.

## The Golden Rule
The carrier will pay what they believe you can prove and will fight for—nothing more. Your job is to make the path of least resistance the path of fair payment.""",
                    duration_minutes=20,
                    order=1
                ),
                Lesson(
                    title="Documentation That Creates Leverage",
                    description="Your file is your weapon",
                    content="""# Documentation That Creates Leverage

In claims, what isn't documented didn't happen. Your file quality determines your outcome.

## The Documentation Mindset
Every photo, every note, every email builds your case. The carrier is building theirs. Who has the better file wins.

## Photo Documentation Standards

### What to Capture
- **Wide shots** showing context and location
- **Medium shots** showing extent of damage
- **Close-ups** showing specific damage details
- **Measurement references** in frame when relevant
- **Date/time stamps** enabled on your device

### Critical Areas (Roof Claims)
- All slopes, not just damaged areas
- Gutters and downspouts
- Flashings and penetrations
- Valleys and ridges
- Satellite damage indicators

### The "Before and After" Problem
You rarely have "before" photos. Solution: Obtain Google Earth historical imagery, real estate listing photos, or neighbor documentation of similar undamaged properties.

## Written Documentation

### Moisture Readings
- Location, date, time, reading value
- Equipment used and calibration status
- Comparison to dry standard

### Observations
Be specific. Not "water damage in bedroom" but "Active water intrusion at ceiling/wall junction, NE corner of master bedroom. Drywall soft to touch, visible staining extending 18 inches from corner. Moisture reading 42% (dry standard 12%)."

## Communication Records
- Save all emails in a dedicated folder
- Follow up phone calls with written confirmation
- Log dates, times, names, and summaries of all conversations
- Request responses in writing

## The File Review Test
Ask yourself: If this claim went to appraisal or litigation, would my file support my position? If not, keep documenting.""",
                    duration_minutes=25,
                    order=2
                ),
                Lesson(
                    title="Reading Carrier Behavior",
                    description="What their actions really mean",
                    content="""# Reading Carrier Behavior

Every carrier action sends a signal. Learn to read them.

## Timeline Tells

### Fast Initial Response
Could mean straightforward claim. Could also mean they want to lock in a low scope before you document fully.

**Your move:** Don't rush. Complete your documentation before accepting any offer.

### Slow Response / Radio Silence
Delay costs you money (temporary repairs, additional damage, lost use). They know this.

**Your move:** Send written requests with deadlines. Reference your state's prompt payment statutes. Create a paper trail.

### Repeated Re-inspections
Each "second look" resets the clock. Often fishing for reasons to reduce scope.

**Your move:** Attend every inspection. Document who attended, what was discussed. Follow up in writing.

## Language Tells

### "We're still reviewing..."
Translation: We're hoping you go away or accept less.

### "Our expert determined..."
Translation: We hired someone to give us the answer we wanted.

### "Policy limits prevent..."
Translation: Check your policy. This may or may not be true.

### "This appears to be pre-existing..."
Translation: We're testing whether you'll fight back.

## Adjuster Behavior

### The Friendly Adjuster
Being nice doesn't mean fair payment. Charm is a tactic like any other. Judge them by their numbers, not their demeanor.

### The Hostile Adjuster
Hostility often signals a weak position. They're trying to intimidate you into accepting less.

### The "I'm on Your Side" Adjuster
They're not. They work for the carrier. Period.

## Response Patterns

### Quick Denial After Documentation Submission
They reviewed your file, found it strong, and are testing your resolve.

### Partial Payment
Often a tactic—accepting partial payment can complicate your ability to dispute the remainder in some jurisdictions.

### Settlement Offer Before Appraisal
They believe appraisal will cost them more. This signals your position is stronger than their offer reflects.""",
                    duration_minutes=20,
                    order=3
                )
            ],
            quiz=[
                QuizQuestion(
                    question="When a carrier issues a lowball initial estimate, you should:",
                    options=["Accept it to maintain a good relationship", "Never accept the first estimate—document and get your own estimates", "Wait for them to increase it automatically", "Immediately file a lawsuit"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="Why do carriers request repeated re-inspections?",
                    options=["They genuinely want to help", "Each inspection resets timelines and tests your resolve", "It's required by law", "To provide better service"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="The carrier's adjuster works for:",
                    options=["You, the policyholder", "The state insurance department", "The carrier—period", "Both parties equally"],
                    correct_answer=2
                )
            ]
        ),
        
        Course(
            title="The Supplement Process",
            description="Supplements are where claims are won or lost. Master the strategy and timing that maximizes recovery.",
            category="Supplement Strategy",
            track="foundation",
            difficulty=2,
            est_minutes=65,
            tags=["supplements", "recovery", "documentation", "O&P"],
            why_this_matters="The initial estimate is never the final number. Supplements are where the real recovery happens — but only if you know when and how to file them.",
            outcomes=["Time supplement submissions for maximum leverage", "Write supplements that get paid using policy-first language", "Calculate and claim Overhead & Profit when warranted"],
            thumbnail="https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=400",
            lessons=[
                Lesson(
                    title="Supplement Strategy Fundamentals",
                    description="Why supplements exist and how to use them",
                    content="""# Supplement Strategy Fundamentals

A supplement is a request for additional payment after the initial estimate. It's not begging—it's claiming what's owed.

## Why Supplements Are Necessary

### Initial Estimates Are Incomplete By Design
Carrier adjusters spend limited time on-site. They estimate what's visible and convenient. Hidden damage, proper repair methodology, and code upgrades are routinely excluded.

### Discovery During Repairs
Demolition reveals concealed damage. A roof tear-off shows decking damage. Drywall removal exposes mold or structural issues. These are legitimate supplements.

### Pricing Updates
Material and labor costs change. Carrier price lists often lag behind market reality.

## Supplement Timing

### Too Early
Submitting supplements before work begins weakens your position. You're asking for payment on damage not yet confirmed.

### The Right Time
Document during demolition. Submit supplements when you can prove:
1. The damage exists
2. It's related to the loss
3. It wasn't included in the original scope

### Too Late
Waiting until after repairs complete can trigger "why didn't you tell us" objections. Document progressively.

## The Supplement Package

### Required Elements
- Clear photos of discovered damage
- Explanation of how damage relates to loss
- Line-item breakdown of additional costs
- Reference to original estimate showing omission
- Requested action and deadline for response

### Optional But Powerful
- Expert reports (engineering, industrial hygiene)
- Code requirements documentation
- Manufacturer specifications
- Contractor methodology statements

## Common Supplement Categories

1. **Hidden damage** revealed during repairs
2. **Scope items** missed in original estimate
3. **Code upgrades** required by local jurisdiction
4. **Overhead and profit** when general contractor involvement is warranted
5. **Price adjustments** when carrier pricing is below market""",
                    duration_minutes=20,
                    order=1
                ),
                Lesson(
                    title="Writing Supplements That Get Paid",
                    description="Structure, language, and leverage",
                    content="""# Writing Supplements That Get Paid

A supplement isn't a wishlist—it's a documented claim for specific, provable damage.

## Structure

### Lead With the Policy
Reference the coverage provision that applies. Make them explain why they won't pay, not why you deserve it.

Example: "Per Coverage A - Dwelling, the policy provides coverage for direct physical loss to the described premises. The following items constitute additional direct physical loss discovered during the repair process..."

### Be Specific, Not Vague
Wrong: "Additional drywall damage found."
Right: "During demolition on 1/15, water-damaged drywall was discovered behind the kitchen cabinets (see photos 47-52). Affected area measures 8' x 4' (32 SF). Damage includes saturated drywall, rusted metal studs at 3 locations, and visible microbial growth requiring remediation."

### Price It Correctly
Use industry-standard pricing (Xactimate or equivalent). Line-item everything. Make it easy to approve—or force them to explain line-by-line what they're denying.

## Language That Works

### Assertive, Not Aggressive
- "Please provide payment for the following documented items..."
- "Per the attached documentation, we request adjustment of..."
- "Carrier's estimate did not include the following covered damage..."

### Avoid
- "I think maybe there might be more damage..."
- "We feel we deserve more..."
- "This isn't fair..."

### Create Accountability
- "Please respond by [date] with payment or written explanation of denial."
- "If additional information is required, please specify in writing."

## Handling Denials

### Partial Denial
Get it in writing. Which items specifically? Why? This becomes your roadmap for dispute.

### Full Denial
Request the specific policy language they're relying on. Often, they can't produce it—or it doesn't say what they claim.

### No Response
Document the silence. Send follow-up with new deadline. This builds your bad faith file.

## The Supplement Tracking System

For every supplement:
- Date submitted
- Items requested
- Amount requested
- Carrier response date
- Items approved/denied
- Running total owed vs. paid

This tracking exposes patterns and supports escalation if needed.""",
                    duration_minutes=25,
                    order=2
                ),
                Lesson(
                    title="Overhead & Profit",
                    description="When it's owed and how to claim it",
                    content="""# Overhead & Profit (O&P)

O&P is one of the most disputed—and most misunderstood—components of property claims.

## What O&P Is

When repairs require a general contractor to coordinate multiple trades, the GC charges overhead (business costs) and profit (margin). Industry standard is 10% overhead + 10% profit (10/10).

## When O&P Is Owed

### The Three-Trade Rule
Most carriers internally use a "three-trade" guideline: if three or more trades are required, GC involvement is warranted, and O&P should be included.

Common trades:
- Roofing
- Siding
- Drywall
- Painting
- Flooring
- Electrical
- Plumbing
- HVAC
- Framing/Carpentry

### Complexity, Not Just Trade Count
Even with fewer trades, O&P may be warranted if:
- Work requires sequencing and coordination
- Permits and inspections are involved
- Homeowner cannot reasonably self-coordinate

## Carrier Objections and Responses

### "The homeowner can coordinate the repairs"
**Response:** The policy promises to restore the property—not to make the homeowner a general contractor. Coordination is a skilled service with liability implications.

### "We only pay O&P on actual GC invoices"
**Response:** The policy provides coverage for the cost to repair. If GC involvement is reasonably necessary, the cost includes O&P—regardless of who actually performs coordination.

### "Our estimate doesn't include O&P"
**Response:** Carrier estimates routinely exclude items that are owed. Exclusion from estimate ≠ exclusion from coverage.

## Documenting O&P Claims

1. List all trades involved
2. Describe coordination requirements
3. Reference permit/inspection requirements
4. Include contractor statements on GC necessity
5. Cite policy language on cost to repair

## The Math

If repair estimate (without O&P) = $50,000:
- 10% overhead = $5,000
- 10% profit = $5,000
- Subtotal with O&P = $60,000

On larger claims, this is significant money. Don't leave it on the table.""",
                    duration_minutes=20,
                    order=3
                )
            ],
            quiz=[
                QuizQuestion(
                    question="The best time to submit a supplement is:",
                    options=["Before any work begins", "When damage is discovered and documented during repairs", "After all repairs are complete", "Only if the carrier asks for one"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="The 'three-trade rule' for O&P means:",
                    options=["You can only claim O&P three times per year", "O&P is only for three-story buildings", "If three or more trades are needed, GC involvement and O&P is typically warranted", "You need three estimates to claim O&P"],
                    correct_answer=2
                ),
                QuizQuestion(
                    question="When a carrier denies a supplement without explanation, you should:",
                    options=["Accept the denial and move on", "Get the denial in writing with specific reasons", "Immediately sue them", "Never submit supplements again"],
                    correct_answer=1
                )
            ]
        ),
        
        Course(
            title="Policy Interpretation Essentials",
            description="The policy is a contract. Learn to read it like one—because the carrier certainly does.",
            category="Policy Mastery",
            track="foundation",
            difficulty=2,
            est_minutes=70,
            tags=["policy", "coverage", "exclusions", "ACV", "RCV"],
            why_this_matters="The policy is the battlefield. Every dollar recovered or denied traces back to specific policy language. If you can't read the contract, you can't win the claim.",
            outcomes=["Navigate all sections of a property policy", "Identify exclusions AND their exceptions", "Distinguish ACV vs RCV and recover withheld depreciation"],
            thumbnail="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400",
            lessons=[
                Lesson(
                    title="Policy Structure and Key Provisions",
                    description="Navigate the document that controls everything",
                    content="""# Policy Structure and Key Provisions

The insurance policy is a contract. Every word matters. Carriers draft policies carefully—you should read them just as carefully.

## Basic Policy Structure

### Declarations Page
- Named insured
- Property address
- Coverage limits (A, B, C, D)
- Deductible
- Policy period
- Endorsements listed

### Insuring Agreement
The core promise. Usually broad: "We will pay for direct physical loss to covered property..."

### Definitions
Critical section. Terms like "collapse," "flood," "occurrence" have specific meanings that may differ from common usage.

### Exclusions
What's NOT covered. Read carefully—but also read the exceptions to exclusions.

### Conditions
Duties after loss, claim procedures, time limits, dispute resolution provisions.

### Endorsements
Modifications to the base policy. Can expand OR restrict coverage. Must be read in conjunction with base policy.

## Key Coverage Provisions

### Coverage A - Dwelling
The structure itself. Typically replacement cost.

### Coverage B - Other Structures
Detached garage, fence, shed. Usually 10% of Coverage A.

### Coverage C - Personal Property
Contents. Often ACV unless replacement cost endorsement added.

### Coverage D - Loss of Use
Additional living expenses if home is uninhabitable.

## Words That Matter

### "Direct Physical Loss"
The trigger for coverage. Carriers increasingly argue this requires physical alteration—courts are split.

### "Sudden and Accidental"
Often used in exclusion exceptions. Timing and expectation matter.

### "Ensuing Loss"
When an excluded event leads to covered damage. Complex and frequently litigated.

### "Collapse"
Does your policy define it? If not, courts may apply dictionary definition. If defined, read carefully—may require "abrupt falling down."

## The Reading Order

1. Declarations (what's covered, limits)
2. Insuring agreement (the promise)
3. Definitions (what words mean)
4. Exclusions (what's carved out)
5. Endorsements (modifications)
6. Conditions (procedures and duties)

Never assume. Always verify in the policy language.""",
                    duration_minutes=25,
                    order=1
                ),
                Lesson(
                    title="Exclusions and Exceptions",
                    description="The battleground of coverage disputes",
                    content="""# Exclusions and Exceptions

Exclusions take away what the insuring agreement gives. But exceptions to exclusions can give it back. This is where claims are won and lost.

## How Exclusions Work

### Structure
"We do not pay for loss caused by: [EXCLUSION]. But we do pay for loss caused by: [EXCEPTION]."

### The Carrier's Burden
In most jurisdictions, the carrier must prove an exclusion applies. You don't have to disprove it—they have to prove it.

## Common Exclusions and How to Navigate Them

### Water Exclusion
Most policies exclude flood, surface water, waves, overflow of bodies of water.

**Key questions:**
- What caused the water?
- Is there an exception for "sudden and accidental discharge"?
- Did wind create openings that allowed water entry?

### Earth Movement
Earthquake, landslide, sinkhole often excluded.

**Key questions:**
- Is there a sinkhole endorsement?
- Was the earth movement caused by a covered peril (like broken pipe)?

### Wear and Tear / Maintenance
Routine deterioration excluded.

**Key questions:**
- Did a covered peril (storm, water discharge) cause damage that's separate from wear?
- Is the carrier conflating cosmetic aging with structural damage?

### Faulty Workmanship
Poor construction often excluded.

**Key questions:**
- Is resulting damage covered even if the faulty work isn't?
- Does the ensuing loss provision apply?

## The Ensuing Loss Doctrine

Many policies exclude certain causes but cover "ensuing loss."

Example: The policy excludes faulty construction but covers ensuing water damage when the faulty construction allows water entry.

**This is powerful:** Even when the root cause is excluded, the resulting damage may be covered.

## Anti-Concurrent Causation Clauses

Some policies say: if a covered AND excluded peril combine to cause loss, there's no coverage.

**Status:** These clauses are controversial. Some courts enforce them strictly. Others find them unconscionable or apply them narrowly.

**Your approach:** Know if your policy has one. Document the covered peril's independent contribution to the loss.

## Ambiguity

If policy language is genuinely ambiguous, courts generally interpret it against the drafter (the carrier). This is the doctrine of "contra proferentem."

**But:** Don't overplay this. Judges are skeptical of manufactured ambiguity. The language must be legitimately unclear.""",
                    duration_minutes=25,
                    order=2
                ),
                Lesson(
                    title="Valued Policy Law & ACV vs RCV",
                    description="Understanding how payment amounts are determined",
                    content="""# Valued Policy Law & ACV vs RCV

How much you get paid depends on your policy type and your state's laws.

## Replacement Cost Value (RCV)

### Definition
The cost to repair or replace with materials of like kind and quality, without deduction for depreciation.

### How It Works
1. Carrier estimates RCV
2. Carrier calculates depreciation
3. Initial payment = RCV - Depreciation (this is ACV)
4. After repairs completed, you claim depreciation holdback
5. Carrier pays remaining depreciation (if you've incurred the cost)

### The Depreciation Recovery Trap
Many policyholders leave money on the table by not claiming recoverable depreciation. Read your policy—there's usually a time limit.

## Actual Cash Value (ACV)

### Definition
Replacement cost minus depreciation. What the item is "worth" accounting for age and condition.

### Common Calculation Methods
- **Replacement cost minus depreciation** (most common)
- **Fair market value** (what a willing buyer would pay)
- **Broad evidence rule** (considers all relevant factors)

### ACV Policies
Some policies only provide ACV—no depreciation recovery. Know what you have.

## Valued Policy Laws

### What They Are
Some states (FL, LA, MS, TX, others) have "valued policy laws." If a covered peril causes TOTAL LOSS, the carrier must pay the full Coverage A limit, regardless of actual value.

### Requirements
- Must be a total loss (not partial)
- Must be a covered peril
- Limit applies to the dwelling (Coverage A)

### Why It Matters
In a total loss scenario in a valued policy state, don't let the carrier depreciate or argue the home was worth less than the limit.

## Depreciation Disputes

### What Can Be Depreciated
Materials with a limited lifespan (shingles, carpet, etc.)

### What Cannot Be Depreciated (Generally)
- Labor (in most jurisdictions—this is actively litigated)
- Items that don't "wear out" with use

### Florida Labor Depreciation
Florida statute specifically prohibits depreciating labor costs. Know your state's rules.

## Practical Application

1. Identify your policy type (RCV or ACV)
2. Check for valued policy law in your state
3. Track depreciation withheld
4. Submit for depreciation recovery after repairs
5. Dispute improper depreciation calculations

The difference between ACV and RCV can be 20-40% of the claim. Don't surrender it.""",
                    duration_minutes=20,
                    order=3
                )
            ],
            quiz=[
                QuizQuestion(
                    question="Who has the burden to prove an exclusion applies?",
                    options=["The policyholder must disprove it", "The carrier must prove it applies", "The court decides without input", "Neither party has a burden"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="What is 'recoverable depreciation'?",
                    options=["Depreciation you can never get back", "The withheld amount you can claim after completing repairs", "A tax deduction", "The carrier's profit margin"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="In a valued policy state with a total loss:",
                    options=["You get whatever the carrier decides", "The carrier must pay the full Coverage A limit", "Depreciation is doubled", "The claim is automatically denied"],
                    correct_answer=1
                )
            ]
        ),

        # --- Foundation 4: The Core Promise ---
        Course(
            title="The Core Promise: Full Indemnification",
            description="Every claim starts with one principle: the policyholder is owed full restoration to pre-loss condition.",
            category="Claims Fundamentals",
            track="foundation",
            difficulty=1,
            est_minutes=30,
            tags=["core promise", "indemnification", "fundamentals"],
            why_this_matters="Full indemnification is not a negotiating position — it is the contractual obligation. Understanding this shifts you from asking favors to claiming what is owed.",
            outcomes=["Define full indemnification and its contractual basis", "Explain why carriers structurally underpay", "Apply the core promise to any claim scenario"],
            lessons=[
                Lesson(
                    title="What Full Indemnification Means",
                    description="The contractual obligation every carrier owes",
                    content="""# What Full Indemnification Means

The insurance policy is a contract. The carrier's core obligation is to restore the property to its pre-loss condition — not partially, not approximately. Fully.

## The Contractual Basis
Every property policy contains an insuring agreement: "We will pay for direct physical loss to covered property." This is not discretionary — it is a binding promise.

## Why Carriers Underpay
Carriers are publicly traded companies. Their business model: collect premiums, minimize payouts. The adjuster's job is to protect reserves, not ensure full payment.

## The Golden Rule
The carrier will pay what the evidence compels and leverage requires — nothing more. Your job is to build a file that makes full payment the path of least resistance.""",
                    duration_minutes=10,
                    order=1,
                    teaching_beats=["Insurance policy = binding contract with full restoration obligation", "Carrier business model structurally incentivizes underpayment", "File quality determines outcome — evidence and leverage drive payment"],
                    carrier_move="Issue initial estimate 30-60% below actual cost, counting on fatigue-based acceptance",
                    our_move="Never accept the first number. Document everything. Build the file before they build theirs.",
                    completion_criteria="Can articulate why full indemnification is a contractual right, not a request"
                ),
                Lesson(
                    title="Pre-Loss Condition Standard",
                    description="Establishing the benchmark for every claim",
                    content="""# Pre-Loss Condition Standard

Every claim recovery is measured against one benchmark: what was the property's condition immediately before the loss event?

## Establishing Pre-Loss Condition
- Historical aerial imagery (Google Earth, ESRI Wayback)
- Real estate listing photos
- Permit records showing prior work
- Neighbor properties of similar age and construction

## Why This Matters
The carrier will argue damage is "pre-existing" or "maintenance." Your pre-loss documentation proves the property's actual condition before the event — defeating their argument with objective evidence.""",
                    duration_minutes=10,
                    order=2,
                    teaching_beats=["Pre-loss condition = the benchmark for all recovery", "Objective evidence (aerial, permits, listings) defeats pre-existing arguments", "Document pre-loss condition before the carrier attempts to redefine it"],
                    carrier_move="Claim damage is pre-existing or maintenance to reduce scope",
                    our_move="Establish pre-loss condition with dated objective evidence before carrier inspection",
                    completion_criteria="Can gather 3+ forms of pre-loss evidence for any property"
                ),
                Lesson(
                    title="Applying the Core Promise Daily",
                    description="Making full indemnification your operating standard",
                    content="""# Applying the Core Promise Daily

The core promise is your daily operating filter.

## Every Decision Filters Through This
- Is the scope complete? Does it restore to pre-loss condition?
- Is the pricing accurate? Does it reflect actual repair costs?
- Is documentation sufficient? Would it compel payment from a neutral reviewer?

## Structure Over Emotion
Claims are won by structure, not arguing. We don't inflate. We don't guess. We document accurately and claim what is owed — every dollar, every time.""",
                    duration_minutes=10,
                    order=3,
                    teaching_beats=["Filter every claim decision through the full indemnification standard", "Accuracy over inflation — every line item must be defensible", "Structure wins claims, not arguments or emotion"],
                    carrier_move="Test resolve with delays, re-inspections, and partial payments",
                    our_move="Maintain professional posture. Let the file do the talking. Set deadlines.",
                    completion_criteria="Can evaluate any estimate against the pre-loss restoration standard"
                )
            ],
            quiz=[
                QuizQuestion(question="Full indemnification means:", options=["Pay whatever the policyholder asks", "Restore property to pre-loss condition", "Pay depreciated value only", "Split the difference"], correct_answer=1),
                QuizQuestion(question="The best evidence for pre-loss condition is:", options=["Verbal description", "Historical aerial imagery and permits", "Carrier inspection photos", "Neighbor testimony"], correct_answer=1),
                QuizQuestion(question="Claims are won primarily by:", options=["Arguing aggressively", "Structure and documentation", "Filing complaints immediately", "Accepting the first offer"], correct_answer=1)
            ]
        ),

        # --- Foundation 5: Structure Wins ---
        Course(
            title="The Claim is Won on Structure",
            description="Learn why organized documentation and methodical process beat emotion and argument every time.",
            category="Claims Fundamentals",
            track="foundation",
            difficulty=1,
            est_minutes=35,
            tags=["structure", "documentation", "process", "file building"],
            why_this_matters="The adjuster with the better file wins. Period. Structure is not busywork — it is the single greatest predictor of claim outcome.",
            outcomes=["Build a claim file that supports your position independently", "Organize evidence by the hierarchy that compels payment", "Create documentation a neutral third party would find persuasive"],
            lessons=[
                Lesson(
                    title="Why Structure Beats Arguing",
                    description="The fundamental principle of claims success",
                    content="""# Why Structure Beats Arguing

Arguments are subjective. Structure is objective. Carriers can dismiss opinions — they cannot dismiss properly organized evidence.

## The Structural Advantage
A structured file forces the carrier to respond to facts, not feelings. Each document, photo, and measurement creates a data point they must address or concede.

## What a Structured File Contains
1. Loss timeline with dates and events
2. Evidence organized by hierarchy (objective proof first)
3. Scope with defensible line items
4. Communication log with deadlines
5. Supplement tracking with amounts and responses""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["Arguments are dismissible, structured evidence is not", "A structured file forces carriers to respond to facts", "Five components of a structured claim file"],
                    carrier_move="Dismiss verbal arguments and emotional appeals without response",
                    our_move="Let the organized file speak. Present evidence, not opinions.",
                    completion_criteria="Can list the 5 components of a structured claim file"
                ),
                Lesson(
                    title="Building Your Claim File",
                    description="Step-by-step file construction",
                    content="""# Building Your Claim File

Start building your file on Day 1. Do not wait for the carrier.

## The Build Order
1. **Document the loss** — photos (wide, medium, close-up), measurements, moisture readings
2. **Establish timeline** — date of loss, date reported, carrier response dates
3. **Secure pre-loss evidence** — aerials, listing photos, permits
4. **Create the scope** — defensible line items with methodology
5. **Log all communications** — dates, names, content, follow-ups

## The File Review Test
Ask yourself: If this claim went to appraisal, would my file support my position without me in the room? If not, keep documenting.""",
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Start file construction on Day 1, before carrier inspection", "Follow the 5-step build order for every claim", "Apply the file review test: would it win without you present?"],
                    carrier_move="Build their file while you delay building yours",
                    our_move="Build your file before they build theirs. First complete file wins.",
                    completion_criteria="Can construct a claim file following the 5-step build order"
                ),
                Lesson(
                    title="The Structure Checklist",
                    description="Quality control for every claim",
                    content="""# The Structure Checklist

Before submitting anything to the carrier, verify:

## Pre-Submission Checklist
- [ ] All damage documented with photos (3 angles minimum)
- [ ] Measurements recorded and verified
- [ ] Pre-loss condition established with objective evidence
- [ ] Scope complete with defensible line items only
- [ ] Communication log current with all dates and names
- [ ] Deadlines set and documented
- [ ] Supplement tracking current (if applicable)

## The Standard
Every submission must be clean, organized, and self-supporting. If you wouldn't present it to an umpire, don't submit it to the carrier.""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["Use the pre-submission checklist for every carrier interaction", "Every line item must be defensible — no inflation, no guessing", "Hold every submission to the umpire standard"],
                    carrier_move="Exploit disorganized submissions to deny or delay",
                    our_move="Submit clean, organized packages that are difficult to dispute",
                    completion_criteria="Can complete the pre-submission checklist for a real claim"
                )
            ],
            quiz=[
                QuizQuestion(question="The adjuster with the better ___ wins:", options=["Argument", "File", "Attitude", "Connections"], correct_answer=1),
                QuizQuestion(question="When should you start building your claim file?", options=["After the carrier inspection", "Day 1, before the carrier", "When you file a supplement", "Only if the claim is disputed"], correct_answer=1),
                QuizQuestion(question="The file review test asks:", options=["Is the carrier happy?", "Would this win at appraisal without me present?", "Did I include enough photos?", "Is the estimate high enough?"], correct_answer=1)
            ]
        ),

        # --- Foundation 6: Evidence Hierarchy ---
        Course(
            title="Evidence Hierarchy & Documentation",
            description="Not all evidence is equal. Learn the five tiers that determine what carriers pay attention to — and what they ignore.",
            category="Documentation",
            track="foundation",
            difficulty=2,
            est_minutes=35,
            tags=["evidence", "documentation", "photos", "proof"],
            why_this_matters="Carriers dismiss weak evidence and respect strong evidence. Knowing the hierarchy means you build the right file from day one.",
            outcomes=["Rank evidence by the 5-tier hierarchy", "Prioritize objective proof over opinions", "Document every claim to the standard that compels payment"],
            lessons=[
                Lesson(
                    title="The Five Tiers of Evidence",
                    description="From strongest to weakest",
                    content="""# The Five Tiers of Evidence

Not all evidence is equal. Build your file from the top down.

## The Hierarchy (Strongest → Weakest)
1. **Objective proof** — Weather data, historical aerial imagery, permits, engineering reports
2. **Photos showing cause + damage** — Dated, with context, showing causal connection
3. **Room-by-room continuity** — Systematic documentation showing full scope of loss
4. **Written narrative** — Detailed descriptions with measurements and specifics
5. **Contractor opinions** — Expert views supporting scope and methodology

## The Rule
Always lead with Tier 1. Carriers can argue with opinions. They cannot argue with weather data and satellite imagery.""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["5 tiers: objective proof > photos > continuity > narrative > opinions", "Always lead with Tier 1 evidence", "Carriers argue with opinions but not weather data and satellite imagery"],
                    carrier_move="Dismiss lower-tier evidence (opinions, narratives) while ignoring higher-tier proof you haven't provided",
                    our_move="Lead every claim with Tier 1 objective proof. Make the carrier address facts, not opinions.",
                    completion_criteria="Can rank any 5 pieces of evidence by tier from memory"
                ),
                Lesson(
                    title="Objective Proof: The Gold Standard",
                    description="Weather data, aerials, permits, and reports",
                    content="""# Objective Proof: The Gold Standard

Tier 1 evidence cannot be argued — it can only be acknowledged or ignored (and ignoring it builds your bad faith file).

## Sources of Objective Proof
- **Weather data** — NOAA storm reports, hail maps, wind speed records
- **Historical aerials** — Google Earth timeline, ESRI Wayback, Nearmap
- **Permit records** — Prior work history, code compliance status
- **Engineering reports** — Structural assessments from licensed engineers
- **Manufacturer specs** — Product lifespan, installation requirements, warranty conditions

## Application
Pull weather data on Day 1. Capture aerials before the carrier can claim "pre-existing." These are your strongest cards — play them first.""",
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Tier 1 evidence cannot be argued, only acknowledged or ignored", "Pull weather data and aerials on Day 1", "Ignoring objective proof builds the bad faith file"],
                    carrier_move="Claim damage is pre-existing or unrelated to the loss event",
                    our_move="Present dated weather data + historical aerials proving condition changed after loss event",
                    completion_criteria="Can identify 5+ sources of Tier 1 objective proof"
                ),
                Lesson(
                    title="Photo Documentation Standards",
                    description="Making Tier 2 evidence compelling",
                    content="""# Photo Documentation Standards

Photos are Tier 2, but well-taken photos showing cause and damage are extremely powerful.

## The Three-Shot Rule
For every damage area:
1. **Wide shot** — Shows location and context
2. **Medium shot** — Shows extent of damage
3. **Close-up** — Shows specific damage detail with measurement reference

## Critical Requirements
- Date/time stamps enabled
- Measurement references in frame
- Causal indicators visible (hail impacts, wind damage patterns)
- All slopes/areas documented, not just damaged ones

## The Standard
Not "water damage in bedroom" but "Active water intrusion at ceiling/wall junction, NE corner of master bedroom. Drywall soft to touch, visible staining extending 18 inches from corner. Moisture reading 42% (dry standard 12%).\"""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["Three-shot rule: wide, medium, close-up for every damage area", "Always include date stamps and measurement references", "Specific descriptions defeat vague observations"],
                    carrier_move="Dismiss vague photos without context, measurements, or causal indicators",
                    our_move="Provide three-angle documentation with measurements and specific written descriptions",
                    completion_criteria="Can photograph a damage area using the three-shot rule with proper documentation"
                )
            ],
            quiz=[
                QuizQuestion(question="The strongest tier of evidence is:", options=["Contractor opinions", "Written narrative", "Objective proof (weather, aerials, permits)", "Photos"], correct_answer=2),
                QuizQuestion(question="The three-shot rule requires:", options=["3 photos of the whole house", "Wide, medium, and close-up of each damage area", "Photos from 3 different days", "3 different cameras"], correct_answer=1),
                QuizQuestion(question="When should you pull weather data and aerials?", options=["After the carrier denies the claim", "Day 1, before carrier inspection", "Only for large claims", "When the attorney requests it"], correct_answer=1)
            ]
        ),

        # --- Foundation 7: Scope Discipline ---
        Course(
            title="Scope Discipline",
            description="Every line item must be defensible. No inflation, no guessing. Scope discipline protects your credibility and wins claims.",
            category="Estimating",
            track="foundation",
            difficulty=2,
            est_minutes=30,
            tags=["scope", "estimating", "line items", "discipline"],
            why_this_matters="Inflated or sloppy scopes give carriers ammunition. Disciplined scoping builds credibility that pays dividends across every claim.",
            outcomes=["Write scope items that are individually defensible", "Avoid language that triggers exclusions", "Distinguish between recoverable damage and maintenance"],
            lessons=[
                Lesson(
                    title="Defensible Line Items",
                    description="Every line must stand on its own",
                    content="""# Defensible Line Items

A defensible line item can be justified with evidence if challenged. An indefensible one cannot — and it damages your credibility on everything else.

## The Test
For every line item ask: "If the carrier challenges this specific item, can I point to a photo, measurement, or code requirement that supports it?"

If yes — include it. If no — remove it or get the evidence first.

## Common Failures
- Including items without photo documentation
- Estimating damage you haven't inspected
- Rounding up quantities beyond actual measurements
- Including repairs unrelated to the covered loss""",
                    duration_minutes=10,
                    order=1,
                    teaching_beats=["Every line item must pass the 'can I prove it?' test", "One indefensible item damages credibility on all items", "Measure first, estimate second — never the reverse"],
                    carrier_move="Find one inflated line item and use it to discredit the entire estimate",
                    our_move="Submit only defensible items. Let scope accuracy build cumulative credibility.",
                    completion_criteria="Can evaluate 5 line items and identify which are defensible"
                ),
                Lesson(
                    title="Avoiding Exclusion Triggers",
                    description="Language and scope choices that protect coverage",
                    content="""# Avoiding Exclusion Triggers

Certain words and scope choices can trigger policy exclusions. Know them and avoid them.

## Dangerous Language
- "Mold" → May trigger exclusion. Use "microbial growth" and note it as resulting from covered water loss
- "Flood" → Specific policy exclusion. If wind-driven rain, document wind as the cause
- "Maintenance" → Never include maintenance items in a claim scope
- "Pre-existing" → If you note something as pre-existing, you've done the carrier's job for them

## The Rule
Describe what you observe accurately. Let the evidence establish causation. Do not volunteer language that triggers exclusions.""",
                    duration_minutes=10,
                    order=2,
                    teaching_beats=["Certain words trigger policy exclusions — know which ones", "Describe observations accurately without volunteering exclusion language", "Let evidence establish causation, not your word choices"],
                    carrier_move="Seize on exclusion-triggering language to deny portions of the claim",
                    our_move="Use precise, neutral language. Document cause and damage separately with evidence.",
                    completion_criteria="Can identify 4+ exclusion-triggering terms and their safe alternatives"
                ),
                Lesson(
                    title="The Scope Review Process",
                    description="Quality control before submission",
                    content="""# The Scope Review Process

Review every scope before submission using this process:

## The Review Checklist
1. **Evidence match** — Every line item has supporting documentation
2. **Language check** — No exclusion-triggering terms
3. **Measurement verification** — All quantities match actual measurements
4. **Pricing accuracy** — All pricing reflects current local market rates
5. **Completeness** — All covered damage is included (nothing left for a supplement that should be in the original)

## The Final Test
Would an independent appraiser reviewing this scope find it fair, accurate, and well-supported? If yes, submit. If not, revise.""",
                    duration_minutes=10,
                    order=3,
                    teaching_beats=["5-point scope review: evidence, language, measurements, pricing, completeness", "Every scope goes through quality control before submission", "Apply the independent appraiser test before submitting"],
                    carrier_move="Exploit sloppy scopes to justify re-inspection, delay, or blanket denial",
                    our_move="Submit reviewed, verified scopes that withstand scrutiny",
                    completion_criteria="Can perform the 5-point scope review on a real estimate"
                )
            ],
            quiz=[
                QuizQuestion(question="A defensible line item is one that:", options=["Is estimated generously", "Can be justified with evidence if challenged", "The carrier already included", "Uses industry-standard pricing only"], correct_answer=1),
                QuizQuestion(question="Using the word 'flood' in your scope can:", options=["Get you paid faster", "Trigger a policy exclusion", "Strengthen your claim", "Has no effect"], correct_answer=1),
                QuizQuestion(question="Before submitting a scope, you should:", options=["Add 20% for negotiation room", "Run the 5-point review checklist", "Wait for the carrier's estimate first", "Remove all photos"], correct_answer=1)
            ]
        ),

        # --- Foundation 8: Communication Standards ---
        Course(
            title="Communication Standards",
            description="Professional, written, deadline-driven communication is how you control the claim timeline and build accountability.",
            category="Communication",
            track="foundation",
            difficulty=1,
            est_minutes=25,
            tags=["communication", "deadlines", "professional", "written"],
            why_this_matters="Phone calls buy time. Written communication creates accountability. Every unwritten conversation is a missed opportunity to build your file.",
            outcomes=["Default to written communication for all claim interactions", "Set effective deadlines that create carrier accountability", "Maintain professional posture that supports escalation if needed"],
            lessons=[
                Lesson(
                    title="Written Over Verbal",
                    description="Why everything must be in writing",
                    content="""# Written Over Verbal

Phone calls are convenient — for the carrier. They leave no record and no accountability.

## The Written Communication Rule
- Follow up every phone call with a written summary
- Make all requests in writing with specific deadlines
- Save all emails in a dedicated claim folder
- Log dates, times, names, and content of all conversations

## Why This Matters
When the claim escalates to appraisal, DOI complaint, or litigation, your written record IS your case. What isn't documented didn't happen.""",
                    duration_minutes=8,
                    order=1,
                    teaching_beats=["Phone calls leave no record — always follow up in writing", "Written requests with deadlines create accountability", "Your written record becomes your case at escalation"],
                    carrier_move="Prefer phone calls to avoid creating a paper trail",
                    our_move="Confirm every conversation in writing. Set deadlines. Create the paper trail.",
                    completion_criteria="Can convert any phone conversation into a documented written follow-up"
                ),
                Lesson(
                    title="Professional Posture",
                    description="Educated, amicable, and firm",
                    content="""# Professional Posture

The doctrine posture: educated, professional, assumes amicable resolution — but sets clear deadlines and next steps.

## What Professional Posture Looks Like
- State facts, not emotions
- Reference policy language, not personal opinions
- Set deadlines with specific dates
- Acknowledge the carrier's position, then present yours with evidence
- Never threaten — document and escalate when warranted

## The Standard
"Per Coverage A, the policy provides coverage for direct physical loss. The attached documentation supports the following additional items. Please respond by [date] with payment or written explanation of denial."

This is not aggressive. It is structured, professional, and accountable.""",
                    duration_minutes=8,
                    order=2,
                    teaching_beats=["Posture: educated, professional, assumes amicable resolution", "Reference policy language, not opinions or emotions", "Set deadlines with specific dates — never open-ended requests"],
                    carrier_move="Use friendly or hostile tactics to keep interactions informal and unaccountable",
                    our_move="Maintain consistent professional posture regardless of carrier demeanor. Facts + deadlines.",
                    completion_criteria="Can draft a professional carrier communication using the doctrine template"
                ),
                Lesson(
                    title="Setting Deadlines and Next Steps",
                    description="Creating accountability with every interaction",
                    content="""# Setting Deadlines and Next Steps

Every communication to the carrier must end with a clear deadline and stated next step.

## Deadline Framework
- "Please respond by [specific date] with [specific action]."
- "If we do not receive [response] by [date], we will [next step]."
- Reference state prompt payment statutes when applicable.

## Next Steps Must Be Real
Never set a deadline you won't enforce. If you say "we will escalate," be prepared to escalate. Empty threats destroy credibility.

## Documentation
Log every deadline set, the carrier's response (or non-response), and the action taken. This builds your escalation file automatically.""",
                    duration_minutes=9,
                    order=3,
                    teaching_beats=["Every communication ends with a deadline and stated next step", "Never set a deadline you won't enforce", "Documented non-responses build the escalation file automatically"],
                    carrier_move="Ignore deadlines, delay responses, hope you stop following up",
                    our_move="Set deadlines, document non-responses, follow through on stated next steps",
                    completion_criteria="Can set appropriate deadlines and next steps for 3 common claim scenarios"
                )
            ],
            quiz=[
                QuizQuestion(question="After a phone call with the carrier, you should:", options=["Wait for their follow-up", "Send a written summary confirming what was discussed", "Call back to clarify", "Do nothing unless they send something"], correct_answer=1),
                QuizQuestion(question="The doctrine posture is:", options=["Aggressive and threatening", "Passive and accommodating", "Educated, professional, assumes amicable resolution", "Emotional and personal"], correct_answer=2),
                QuizQuestion(question="Every carrier communication should end with:", options=["A thank you note", "A specific deadline and next step", "A phone number", "A threat of litigation"], correct_answer=1)
            ]
        )
    ]

    # ========== OPERATOR COURSES ==========

    operator_courses = [
        # --- Operator 1: Negotiation Posture ---
        Course(
            title="Primary Negotiation Posture",
            description="Master the doctrine posture: educated, professional, amicable — with clear deadlines and defined next steps that control the claim.",
            category="Negotiation",
            track="operator",
            difficulty=3,
            est_minutes=40,
            tags=["negotiation", "posture", "deadlines", "professional"],
            why_this_matters="Your posture determines how the carrier treats you. Too aggressive and they lawyer up. Too passive and they walk over you. The doctrine posture commands respect and results.",
            outcomes=["Execute the educated-professional-amicable posture in any claim scenario", "Set deadlines that create real accountability", "Transition from amicable to escalation without losing credibility"],
            lessons=[
                Lesson(
                    title="The Doctrine Posture",
                    description="Educated, professional, assumes amicable resolution",
                    content="""# The Doctrine Posture

The doctrine is clear: assume amicable resolution while building a file that supports escalation if needed.

## The Three Pillars
1. **Educated** — Know the policy, the evidence, and the carrier's obligations
2. **Professional** — Facts over emotion, policy language over opinions
3. **Amicable** — Assume good faith until evidence proves otherwise

## Why This Works
Carriers expect either pushovers or fighters. The educated professional disrupts both scripts. You're pleasant to deal with — but your file is bulletproof.""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["Three pillars: educated, professional, amicable", "Assumes good faith until evidence proves otherwise", "Disrupts the carrier's script for both pushovers and fighters"],
                    carrier_move="Categorize you as either pushover (ignore) or fighter (lawyer up)",
                    our_move="Be the educated professional they can't categorize. Pleasant demeanor, bulletproof file.",
                    completion_criteria="Can demonstrate the three-pillar posture in a role-play scenario"
                ),
                Lesson(
                    title="Setting Deadlines That Work",
                    description="Creating accountability without aggression",
                    content="""# Setting Deadlines That Work

Deadlines without consequence are requests. Deadlines with documented follow-through are leverage.

## The Deadline Formula
"Please provide [specific action] by [specific date]. If we do not receive a response, we will [specific next step]."

## Rules
- Always reference a specific date, never "as soon as possible"
- The next step must be real — never bluff
- Reference state prompt payment statutes when applicable
- Document the deadline, the response (or silence), and your follow-through

## Escalation Timeline
Submission → 14-day response window → Follow-up with new deadline → Management request → DOI/Appraisal""",
                    duration_minutes=14,
                    order=2,
                    teaching_beats=["Deadlines without consequences are just requests", "Always state specific dates and specific next steps", "Document deadline compliance for escalation file"],
                    carrier_move="Ignore vague deadlines, delay indefinitely when no consequences exist",
                    our_move="Set specific deadlines with real next steps. Document compliance or non-compliance.",
                    completion_criteria="Can write 3 deadline-setting communications for different claim stages"
                ),
                Lesson(
                    title="When Amicable Isn't Working",
                    description="Transitioning to escalation without losing credibility",
                    content="""# When Amicable Isn't Working

The doctrine starts amicable but has a clear escalation path. The key: escalation is documented, not emotional.

## Signs Amicable Has Failed
- Deadlines missed without explanation
- Same objections repeated despite evidence
- Non-responsive to written communications
- Moving goalposts on documentation requirements

## The Transition
You don't announce escalation — you execute it. Each level follows naturally from documented failure at the previous level.

## The Escalation Ladder
1. Complete submission with deadline
2. Follow-up with new deadline and documentation of missed deadline
3. Management request with full timeline
4. DOI complaint or appraisal demand with documented failure pattern
5. Mediation/Litigation — only when file is strong""",
                    duration_minutes=14,
                    order=3,
                    teaching_beats=["Escalation is documented, not emotional", "You don't announce escalation, you execute it", "Each level follows naturally from documented failure at the previous level"],
                    carrier_move="Ignore escalation threats that aren't backed by documentation",
                    our_move="Build the escalation file with each interaction. When you escalate, the documentation speaks.",
                    completion_criteria="Can identify when amicable has failed and execute the first escalation step"
                )
            ],
            quiz=[
                QuizQuestion(question="The doctrine posture is:", options=["Aggressive from day one", "Educated, professional, assumes amicable resolution", "Passive until the carrier makes an offer", "Threatening from the start"], correct_answer=1),
                QuizQuestion(question="A deadline must always include:", options=["A threat of lawsuit", "A specific date and specific next step", "The amount you expect", "A reference to your attorney"], correct_answer=1),
                QuizQuestion(question="When amicable isn't working, you should:", options=["Get emotional and confrontational", "Execute documented escalation", "Accept the carrier's position", "Start over with a new adjuster"], correct_answer=1)
            ]
        ),

        # --- Operator 2: Advanced Supplement Strategy ---
        Course(
            title="Advanced Supplement Strategy",
            description="Go beyond basics. Learn structured rebuttals, evidence-aligned estimates, and the tracking system that maximizes recovery.",
            category="Supplement Strategy",
            track="operator",
            difficulty=3,
            est_minutes=45,
            tags=["supplements", "rebuttals", "tracking", "recovery"],
            why_this_matters="Most adjusters leave 30-40% on the table because they don't know how to structure supplement submissions. This course teaches the system that recovers every dollar owed.",
            outcomes=["Write structured rebuttals that address carrier objections point-by-point", "Align evidence to estimate line items for maximum credibility", "Track supplements systematically to expose carrier patterns"],
            lessons=[
                Lesson(
                    title="Structured Rebuttals",
                    description="Answering carrier objections with evidence, not emotion",
                    content="""# Structured Rebuttals

When the carrier denies a supplement, your rebuttal must be structured, not reactive.

## The Rebuttal Framework
1. **Acknowledge** — State the carrier's objection accurately
2. **Evidence** — Present specific evidence that contradicts the objection
3. **Policy** — Reference the coverage provision that applies
4. **Request** — State the specific action and deadline

## Example
"Carrier states damage to south slope is pre-existing. Attached ESRI Wayback imagery from [date] shows intact condition 60 days before loss. NOAA records confirm [wind event] on [loss date]. Per Coverage A, we request payment for line items 47-62 by [date]."

Never argue the carrier's opinion. Override it with evidence.""",
                    duration_minutes=15,
                    order=1,
                    teaching_beats=["Rebuttal framework: Acknowledge → Evidence → Policy → Request", "Never argue opinions — override with evidence", "Every rebuttal must end with specific request and deadline"],
                    carrier_move="Issue vague denials hoping you'll accept without challenge",
                    our_move="Respond with structured rebuttals that force the carrier to address specific evidence",
                    completion_criteria="Can write a structured rebuttal using the 4-step framework"
                ),
                Lesson(
                    title="Evidence-Aligned Estimates",
                    description="Matching every line item to supporting proof",
                    content="""# Evidence-Aligned Estimates

An estimate without aligned evidence is a wishlist. An estimate WITH aligned evidence is a demand.

## The Alignment Process
For each supplement line item:
- Photo reference (specific photo number showing this damage)
- Measurement reference (specific measurement supporting quantity)
- Cause reference (how this damage connects to the loss event)
- Code reference (if applicable — building code requiring this work)

## The Carrier's Test
Carriers review supplements looking for items they can deny. Evidence-aligned estimates eliminate easy targets. When every item has supporting evidence, denial requires the carrier to dispute the evidence itself — a much harder position.""",
                    duration_minutes=15,
                    order=2,
                    teaching_beats=["Every line item needs photo, measurement, cause, and code references", "Evidence-aligned estimates eliminate easy denial targets", "Force the carrier to dispute evidence, not just deny items"],
                    carrier_move="Cherry-pick unsupported line items to justify blanket denial",
                    our_move="Align every line item to specific evidence. Remove easy targets.",
                    completion_criteria="Can align 10 line items to their supporting evidence"
                ),
                Lesson(
                    title="The Supplement Tracking System",
                    description="Systematic tracking that exposes patterns",
                    content="""# The Supplement Tracking System

Track every supplement systematically. The data builds your escalation case.

## Track For Each Supplement
- Date submitted
- Items and amounts requested
- Carrier response date (or non-response)
- Items approved vs. denied
- Reasons given for denial
- Running total: owed vs. paid

## Why Tracking Matters
Tracking exposes patterns: consistent denial of specific categories, repeated non-response, systematic underpayment. These patterns support bad faith claims and strengthen escalation.

## The Running Scorecard
Maintain a running dollar figure: total documented owed minus total paid. This number is your leverage at every stage.""",
                    duration_minutes=15,
                    order=3,
                    teaching_beats=["Track date, items, amounts, response, approval/denial for every supplement", "Tracking exposes carrier patterns that support bad faith claims", "The running owed-vs-paid scorecard is your leverage number"],
                    carrier_move="Deny supplements piecemeal hoping you lose track of cumulative underpayment",
                    our_move="Track everything. The cumulative pattern becomes your escalation evidence.",
                    completion_criteria="Can set up and maintain a supplement tracking system for a live claim"
                )
            ],
            quiz=[
                QuizQuestion(question="The structured rebuttal framework is:", options=["Argue → Threaten → Repeat", "Acknowledge → Evidence → Policy → Request", "Deny → Counter-offer → Accept", "Complain → Wait → Escalate"], correct_answer=1),
                QuizQuestion(question="An evidence-aligned estimate connects each line item to:", options=["The carrier's estimate", "Photo, measurement, cause, and code references", "The policyholder's desired outcome", "Industry average pricing"], correct_answer=1),
                QuizQuestion(question="Supplement tracking exposes:", options=["Your mistakes", "Carrier patterns that support escalation", "How much you overcharged", "Nothing useful"], correct_answer=1)
            ]
        ),

        # --- Operator 3: Carrier Psychology ---
        Course(
            title="Carrier Psychology Decoded",
            description="Understand how carriers think, what they exploit, and how to turn their own tactics against them through documentation.",
            category="Carrier Warfare",
            track="operator",
            difficulty=3,
            est_minutes=40,
            tags=["carrier psychology", "tactics", "documentation", "leverage"],
            why_this_matters="Carriers aren't random. They follow predictable patterns. When you understand the psychology, you can anticipate moves and prepare counters before they happen.",
            outcomes=["Predict carrier behavior based on claim characteristics", "Identify when carriers exploit ambiguity or delay", "Document moving goalposts to build the bad faith file"],
            lessons=[
                Lesson(
                    title="How Carriers Think",
                    description="The business model that drives every decision",
                    content="""# How Carriers Think

Carrier behavior is not personal — it is structural. Understanding the system helps you navigate it.

## The Business Model
- Collect premiums → invest reserves → minimize payouts → maximize shareholder returns
- Every adjuster has authority limits, supervisor oversight, and performance metrics
- Software flags estimates above threshold → triggers additional review

## Decision Calculus
Carriers ask: "What is the cost of paying vs. the cost of fighting?" Your job is to make fighting more expensive than paying — through documentation, deadlines, and escalation readiness.

## The Path of Least Resistance
Make full payment the easiest path. Complete file + professional posture + clear deadlines = less carrier effort to pay than to fight.""",
                    duration_minutes=14,
                    order=1,
                    teaching_beats=["Carrier behavior is structural, not personal", "Their calculus: cost of paying vs. cost of fighting", "Make full payment the path of least resistance"],
                    carrier_move="Minimize payouts through systematic processes, not individual malice",
                    our_move="Understand the system and make your file too strong and too organized to fight",
                    completion_criteria="Can explain the carrier's decision calculus for any given claim"
                ),
                Lesson(
                    title="Exploiting Ambiguity and Delay",
                    description="How carriers use uncertainty against you",
                    content="""# Exploiting Ambiguity and Delay

Carriers thrive in ambiguity. Clear documentation destroys it.

## How They Exploit Ambiguity
- Vague damage descriptions → carrier defines the scope
- Missing measurements → carrier estimates low
- Unclear causation → carrier claims pre-existing
- No deadlines set → carrier delays indefinitely

## How They Use Delay
- Keeps money in reserves earning interest
- Tests your patience and resolve
- Increases chance of reduced settlement
- Exploits financial pressure on policyholder

## Your Counter
Eliminate ambiguity with specific documentation. Counter delay with written deadlines and documented non-response. Every day of carrier delay documented builds your file.""",
                    duration_minutes=13,
                    order=2,
                    teaching_beats=["Carriers thrive in ambiguity — eliminate it with specifics", "Delay is a tactic: tests resolve, earns interest, exploits pressure", "Counter delay with deadlines and documented non-response"],
                    carrier_move="Exploit vague documentation and lack of deadlines to delay and underpay",
                    our_move="Be specific in every document. Set deadlines. Document silence as evidence.",
                    completion_criteria="Can identify 3 ambiguity tactics and their specific counters"
                ),
                Lesson(
                    title="Documenting Moving Goalposts",
                    description="When carriers keep changing the rules",
                    content="""# Documenting Moving Goalposts

Moving goalposts is a classic carrier tactic: first they need more photos, then different photos, then an engineering report, then a different engineer.

## How to Spot It
- Requirements change after you comply
- New objections appear after previous ones are resolved
- Requests escalate in scope without justification
- Response deadlines keep shifting

## How to Document It
Create a chronological log:
- [Date] Carrier requested [X]. We provided [X] on [date].
- [Date] Carrier now requests [Y] — not previously mentioned.
- [Date] We provided [Y]. Carrier now requests [Z].

## Why This Matters
A documented pattern of moving goalposts is powerful evidence of bad faith. It shows the carrier is not investigating — they are obstructing.""",
                    duration_minutes=13,
                    order=3,
                    teaching_beats=["Moving goalposts: changing requirements after compliance", "Document chronologically: request, compliance, new request", "Documented goalpost pattern = strong bad faith evidence"],
                    carrier_move="Keep changing documentation requirements to delay payment indefinitely",
                    our_move="Comply with each request, document the pattern, use it as escalation evidence",
                    completion_criteria="Can create a moving-goalposts chronological log for a real claim"
                )
            ],
            quiz=[
                QuizQuestion(question="Carrier behavior is driven primarily by:", options=["Individual adjuster malice", "Structural business model incentives", "Random decision-making", "Government regulations"], correct_answer=1),
                QuizQuestion(question="The best counter to carrier delay is:", options=["Waiting patiently", "Written deadlines and documented non-response", "Threatening litigation immediately", "Calling daily"], correct_answer=1),
                QuizQuestion(question="Documented moving goalposts are evidence of:", options=["Thorough investigation", "Bad faith obstruction", "Carrier efficiency", "Normal claims process"], correct_answer=1)
            ]
        ),

        # --- Operator 4: The Escalation Ladder ---
        Course(
            title="The Escalation Ladder",
            description="Five levels of escalation, each building on documented failure at the previous level. Know when and how to climb.",
            category="Escalation & Dispute",
            track="operator",
            difficulty=3,
            est_minutes=45,
            tags=["escalation", "DOI", "appraisal", "management", "mediation"],
            why_this_matters="Escalation without documentation is noise. Escalation with a documented pattern of carrier failure is leverage. The ladder gives you the sequence.",
            outcomes=["Execute all 5 levels of the escalation ladder", "Know when to escalate vs. when to continue negotiating", "Build the file at each level that supports the next"],
            lessons=[
                Lesson(
                    title="The Five Levels",
                    description="Complete submission through mediation/appraisal",
                    content="""# The Five Levels

Each level builds on documented failure at the previous level.

## Level 1: Complete Submission
Submit a clean, evidence-aligned package with a response deadline. This is your baseline.

## Level 2: Follow-Up with Deadline
When Level 1 deadline passes without adequate response, follow up in writing. Reference the original deadline and set a new one.

## Level 3: Management Request
Request supervisor review. Include timeline of submission, deadline, and non-response. Escalate in writing.

## Level 4: Documented Failure
File DOI complaint OR demand appraisal. Include the full chronological record of carrier failure. This is where your documentation pays off.

## Level 5: Mediation / Appraisal / Litigation
Only when the file is strong. Never escalate to Level 5 with a weak file — you'll lose and waste resources.""",
                    duration_minutes=15,
                    order=1,
                    teaching_beats=["5 levels: submission → follow-up → management → DOI/appraisal → mediation/litigation", "Each level requires documented failure at the previous level", "Never escalate to Level 5 with a weak file"],
                    carrier_move="Count on you escalating emotionally without documentation, making it easy to dismiss",
                    our_move="Escalate methodically with documentation at every level. Make dismissal impossible.",
                    completion_criteria="Can name all 5 escalation levels and their prerequisites"
                ),
                Lesson(
                    title="Timing Your Escalation",
                    description="When to climb and when to hold",
                    content="""# Timing Your Escalation

## Escalate When:
- Deadlines pass without response or adequate explanation
- Carrier is misrepresenting policy language (documented)
- Undisputed amounts remain unpaid
- Pattern of conduct suggests bad faith (documented)
- Reasonable negotiation has been attempted and failed

## Don't Escalate When:
- You're frustrated but haven't documented properly
- The dispute is minor and resolution is still possible
- You haven't exhausted the current level
- Your file has gaps that weaken your position

## The Rule
Complete each level fully before moving to the next. Skipping levels weakens your position because the carrier can argue you didn't negotiate in good faith.""",
                    duration_minutes=15,
                    order=2,
                    teaching_beats=["Escalate on documented failure, not frustration", "Complete each level before advancing", "Skipping levels weakens your good-faith negotiation position"],
                    carrier_move="Provoke premature escalation to argue you didn't negotiate in good faith",
                    our_move="Methodically complete each level. Let the documentation justify the escalation.",
                    completion_criteria="Can evaluate a claim scenario and determine the correct escalation level"
                ),
                Lesson(
                    title="Building the Escalation File",
                    description="Documentation that supports each level",
                    content="""# Building the Escalation File

The escalation file builds automatically if you've followed the doctrine from day one.

## What the File Contains
- Chronological timeline of all submissions and responses
- Deadlines set and carrier compliance/non-compliance
- Evidence provided at each stage
- Carrier objections and your structured rebuttals
- Running owed-vs-paid scorecard
- Moving goalposts documentation (if applicable)

## At Level 4 (DOI/Appraisal)
Your file should tell a clear story: "We submitted a complete, evidence-supported claim. We set reasonable deadlines. The carrier failed to respond adequately. Here is the documented pattern."

## The Power
A well-built escalation file often resolves the claim before you need to use it. Carriers recognize a strong file and settle to avoid regulatory scrutiny.""",
                    duration_minutes=15,
                    order=3,
                    teaching_beats=["The escalation file builds automatically with doctrine-compliant documentation", "At Level 4, your file must tell a clear chronological story", "A strong escalation file often resolves claims before it's formally used"],
                    carrier_move="Assume your escalation file is weak or incomplete",
                    our_move="Build the file from day one so it's always ready for the next level",
                    completion_criteria="Can assemble an escalation file from claim documentation"
                )
            ],
            quiz=[
                QuizQuestion(question="Level 4 of the escalation ladder is:", options=["Filing a lawsuit", "Sending angry emails", "DOI complaint or appraisal demand with documented failure", "Calling the carrier's CEO"], correct_answer=2),
                QuizQuestion(question="You should escalate when:", options=["You feel frustrated", "Deadlines pass without adequate response (documented)", "The adjuster is unfriendly", "The first estimate seems low"], correct_answer=1),
                QuizQuestion(question="Skipping escalation levels:", options=["Saves time", "Weakens your good-faith negotiation position", "Shows strength", "Is recommended for large claims"], correct_answer=1)
            ]
        ),

        # --- Operator 5: Dispute Resolution Mindset ---
        Course(
            title="Dispute Resolution Mindset",
            description="Mediation, appraisal, and strategic resolution selection. Know which tool fits which dispute.",
            category="Escalation & Dispute",
            track="operator",
            difficulty=3,
            est_minutes=35,
            tags=["dispute resolution", "mediation", "appraisal", "strategy"],
            why_this_matters="Not every dispute needs litigation. Choosing the right resolution mechanism saves time, money, and gets results faster — but only when the file is strong.",
            outcomes=["Distinguish mediation from appraisal and know when each applies", "Evaluate file strength before committing to formal dispute resolution", "Select the optimal resolution path for any claim dispute"],
            lessons=[
                Lesson(
                    title="Mediation vs. Appraisal",
                    description="Different tools for different disputes",
                    content="""# Mediation vs. Appraisal

## Appraisal
- Resolves AMOUNT disputes only (not coverage)
- Each party selects an appraiser; appraisers select an umpire
- Two of three determine the loss amount
- Typically binding on amount
- Faster and cheaper than litigation

## Mediation
- Non-binding facilitated negotiation
- Can address coverage AND amount
- Mediator helps parties reach agreement
- Either party can walk away
- Good for complex disputes with multiple issues

## The Key Distinction
Appraisal: "We agree there's coverage, but disagree on how much."
Mediation: "We disagree on coverage, amount, or both."
Litigation: "We need discovery, enforcement, or bad faith damages." """,
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["Appraisal = amount disputes only, binding, faster than litigation", "Mediation = coverage and amount, non-binding, flexible", "Choose the tool that matches the specific dispute type"],
                    carrier_move="Accept appraisal while reserving coverage issues, creating a two-front war",
                    our_move="Identify the core dispute type first, then select the matching resolution mechanism",
                    completion_criteria="Can correctly categorize 5 disputes as appraisal, mediation, or litigation candidates"
                ),
                Lesson(
                    title="When the File is Strong Enough",
                    description="Evaluating readiness for formal dispute resolution",
                    content="""# When the File is Strong Enough

Never enter formal dispute resolution with a weak file.

## File Strength Checklist
- [ ] Complete evidence aligned to every disputed item
- [ ] Chronological communication log with all deadlines documented
- [ ] Carrier objections with structured rebuttals
- [ ] Running owed-vs-paid scorecard
- [ ] Pre-loss condition established with objective evidence
- [ ] Pattern documentation (if bad faith suspected)

## The Test
If your appraiser or mediator reviewed your file cold, would they clearly understand your position and find it well-supported? If yes, proceed. If not, strengthen the file first.

## The Risk
Entering dispute resolution with a weak file can result in a binding outcome that's worse than continued negotiation.""",
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Never enter formal resolution with a weak file", "Use the file strength checklist before committing", "A weak file in binding appraisal can produce worse results than negotiation"],
                    carrier_move="Push for appraisal when your file is weak, knowing you'll underperform",
                    our_move="Evaluate file strength honestly before committing to any formal process",
                    completion_criteria="Can evaluate a claim file against the strength checklist"
                ),
                Lesson(
                    title="Strategic Resolution Selection",
                    description="Choosing the right path for each dispute",
                    content="""# Strategic Resolution Selection

## Decision Framework

### Choose Appraisal When:
- Coverage is agreed, only amount is disputed
- Your evidence strongly supports a higher amount
- You want binding resolution without litigation costs
- Carrier's estimate is significantly below documented damage

### Choose Mediation When:
- Multiple issues need resolution (coverage + amount)
- Relationship preservation matters
- Creative solutions might benefit both parties
- You want to test the waters without binding commitment

### Choose Litigation When:
- Bad faith evidence is strong and damages are available
- Coverage denial is based on policy misinterpretation
- Appraisal/mediation have failed
- Discovery is needed to prove carrier misconduct""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["Appraisal for amount disputes, mediation for complex disputes, litigation for bad faith", "Match the resolution mechanism to the specific dispute type", "Never litigate without strong file AND documented bad faith"],
                    carrier_move="Push the resolution mechanism that favors their position",
                    our_move="Choose the mechanism that matches our dispute type and file strength",
                    completion_criteria="Can recommend the correct resolution path for 3 different dispute scenarios"
                )
            ],
            quiz=[
                QuizQuestion(question="Appraisal resolves disputes about:", options=["Coverage interpretation", "Amount of loss only", "Bad faith conduct", "All claim issues"], correct_answer=1),
                QuizQuestion(question="Before entering formal dispute resolution, you must:", options=["File a DOI complaint first", "Verify your file is strong enough with the checklist", "Accept the carrier's last offer", "Hire an attorney"], correct_answer=1),
                QuizQuestion(question="Litigation is appropriate when:", options=["You're frustrated with the carrier", "Bad faith evidence is strong and documented", "The claim is under $5,000", "You want a quick resolution"], correct_answer=1)
            ]
        ),

        # --- Operator 6: O&P Mastery ---
        Course(
            title="Overhead & Profit Mastery",
            description="Overhead & Profit is routinely denied and frequently owed. Master the rules, the arguments, and the documentation that recovers it.",
            category="Estimating",
            track="operator",
            difficulty=3,
            est_minutes=35,
            tags=["O&P", "overhead", "profit", "three-trade", "general contractor"],
            why_this_matters="O&P adds 20% to claim value. Carriers deny it by default. Knowing when it's owed and how to claim it is one of the highest-value skills in adjusting.",
            outcomes=["Apply the three-trade rule to determine O&P eligibility", "Counter common carrier objections to O&P", "Document GC necessity for any qualifying claim"],
            lessons=[
                Lesson(
                    title="When O&P Is Owed",
                    description="The three-trade rule and beyond",
                    content="""# When O&P Is Owed

When repairs require a general contractor to coordinate multiple trades, O&P is owed. Industry standard: 10% overhead + 10% profit.

## The Three-Trade Rule
Most carriers internally use this: if 3+ trades are required, GC involvement is warranted. Trades: roofing, siding, drywall, painting, flooring, electrical, plumbing, HVAC, carpentry.

## Beyond Trade Count
Even with fewer trades, O&P may be warranted if work requires sequencing, permits, inspections, or coordination beyond homeowner capability.

## The Math
Repair estimate $50,000 → + $5,000 overhead + $5,000 profit = $60,000. On large claims, this is significant.""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["O&P = 10% overhead + 10% profit when GC involvement is warranted", "Three-trade rule: 3+ trades = GC involvement justified", "Complexity and coordination can justify O&P even with fewer trades"],
                    carrier_move="Deny O&P by default and hope you don't challenge it",
                    our_move="Count the trades, document coordination requirements, claim O&P when warranted",
                    completion_criteria="Can evaluate any claim for O&P eligibility using the three-trade rule"
                ),
                Lesson(
                    title="Countering O&P Objections",
                    description="The carrier's arguments and your responses",
                    content="""# Countering O&P Objections

## "The homeowner can coordinate repairs"
Response: The policy promises to restore the property, not make the homeowner a GC. Coordination is a skilled service with liability implications.

## "We only pay O&P on actual GC invoices"
Response: The policy covers cost to repair. If GC involvement is reasonably necessary, cost includes O&P regardless of who coordinates.

## "Our estimate doesn't include O&P"
Response: Carrier estimates routinely exclude owed items. Exclusion from estimate ≠ exclusion from coverage.

## Documentation
List all trades, describe coordination requirements, reference permits/inspections, include contractor statements on GC necessity.""",
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Three common objections: homeowner can coordinate, need GC invoice, not in estimate", "Each objection has a structured, evidence-based response", "Document trades, coordination, permits, and contractor statements"],
                    carrier_move="Use scripted objections to deny O&P on qualifying claims",
                    our_move="Counter each objection with policy language and documented GC necessity",
                    completion_criteria="Can rebut all 3 common O&P objections with structured responses"
                ),
                Lesson(
                    title="The O&P Claim Package",
                    description="Building the submission that gets paid",
                    content="""# The O&P Claim Package

## Required Elements
1. List of all trades involved (with specific scope items per trade)
2. Description of coordination and sequencing requirements
3. Permit and inspection requirements (if applicable)
4. Contractor statement on GC necessity
5. Reference to policy language on cost to repair

## The Submission
"The following claim requires coordination of [X] trades: [list]. Sequencing requires [details]. Per the policy's obligation to pay cost to repair, O&P is warranted at industry standard 10/10."

## Follow-Up
If denied, request specific written reason. Apply the structured rebuttal framework: Acknowledge → Evidence → Policy → Request.""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["O&P package: trade list, coordination details, permits, contractor statement, policy reference", "Submit with clear request and deadline", "If denied, apply the structured rebuttal framework"],
                    carrier_move="Issue vague denial without addressing specific documentation",
                    our_move="Submit complete O&P package; if denied, demand written explanation and rebut",
                    completion_criteria="Can assemble a complete O&P claim package for a multi-trade repair"
                )
            ],
            quiz=[
                QuizQuestion(question="The industry standard for O&P is:", options=["5% total", "10% overhead + 10% profit", "15% flat rate", "Negotiable only"], correct_answer=1),
                QuizQuestion(question="When a carrier says 'the homeowner can coordinate,' you respond:", options=["Accept the objection", "The policy promises restoration, not making the homeowner a GC", "Reduce the O&P to 5%", "File a complaint immediately"], correct_answer=1),
                QuizQuestion(question="The three-trade rule states:", options=["You can only claim 3 trades", "3+ trades justifies GC involvement and O&P", "O&P is limited to 3 claims", "Only 3 carriers pay O&P"], correct_answer=1)
            ]
        ),

        # --- Operator 7: Depreciation Recovery ---
        Course(
            title="Depreciation Recovery Tactics",
            description="Recoverable depreciation is money the carrier already owes you. Learn to track it, claim it, and fight improper depreciation.",
            category="Policy Mastery",
            track="operator",
            difficulty=3,
            est_minutes=30,
            tags=["depreciation", "RCV", "ACV", "recovery", "labor"],
            why_this_matters="The difference between ACV and RCV is 20-40% of the claim. Most policyholders leave recoverable depreciation on the table. Don't.",
            outcomes=["Calculate and track recoverable depreciation", "Identify improper depreciation (including labor)", "Submit depreciation recovery claims within policy time limits"],
            lessons=[
                Lesson(
                    title="ACV vs. RCV Mechanics",
                    description="How depreciation holdback works",
                    content="""# ACV vs. RCV Mechanics

## The Process
1. Carrier estimates Replacement Cost Value (RCV)
2. Carrier calculates depreciation based on age/condition
3. Initial payment = RCV minus depreciation (this is ACV)
4. After repairs, you submit for depreciation recovery
5. Carrier pays the withheld depreciation

## The Trap
Many policyholders accept the ACV payment and never claim the holdback. This can be 20-40% of the total claim value.

## Time Limits
Most policies set a deadline for depreciation recovery (often 180 days to 2 years). Miss the deadline, lose the money. Know your policy's timeline.""",
                    duration_minutes=10,
                    order=1,
                    teaching_beats=["RCV minus depreciation = ACV (initial payment)", "Depreciation holdback is recoverable after repairs", "Strict time limits apply — know your policy's deadline"],
                    carrier_move="Pay ACV and hope you never claim the holdback",
                    our_move="Track every dollar of depreciation withheld and submit recovery before the deadline",
                    completion_criteria="Can calculate depreciation holdback and identify the recovery deadline"
                ),
                Lesson(
                    title="Improper Depreciation",
                    description="What carriers depreciate that they shouldn't",
                    content="""# Improper Depreciation

## Labor Depreciation
In Florida and many states, depreciating labor costs is prohibited by statute. Labor doesn't "wear out" — only materials do. If the carrier depreciates labor, challenge it.

## Items That Don't Depreciate
- Labor and installation costs (in most jurisdictions)
- Items that don't deteriorate with use
- Recently replaced materials (still within useful life)

## Aggressive Depreciation
Carriers sometimes apply excessive depreciation rates or depreciate materials beyond their actual condition. Compare their depreciation schedule against manufacturer lifespans and actual condition evidence.

## Your Response
"Carrier has applied depreciation to labor costs. Per [state statute], labor is not subject to depreciation. We request revised calculation excluding labor depreciation." """,
                    duration_minutes=10,
                    order=2,
                    teaching_beats=["Labor depreciation is prohibited in Florida and many states", "Challenge excessive depreciation rates with manufacturer data", "Depreciating non-depreciable items is a common carrier error"],
                    carrier_move="Depreciate labor, apply excessive rates, and hope you don't check",
                    our_move="Audit every depreciation calculation. Challenge labor depreciation and excessive rates.",
                    completion_criteria="Can identify 3 types of improper depreciation in a carrier estimate"
                ),
                Lesson(
                    title="The Recovery Process",
                    description="Claiming what's owed after repairs",
                    content="""# The Recovery Process

## When to Submit
After repairs are complete or substantially underway, submit for depreciation recovery.

## Required Documentation
- Proof of repair completion (invoices, receipts, photos)
- Original carrier estimate showing depreciation withheld
- Calculation of amount owed
- Request with deadline for payment

## Track the Numbers
- Total RCV per carrier estimate
- Total depreciation withheld
- Total ACV paid
- Recoverable depreciation owed
- Deadline for recovery submission

## Don't Leave Money on the Table
On a $100,000 claim with 30% depreciation, that's $30,000 sitting unclaimed. This is your money. Claim it.""",
                    duration_minutes=10,
                    order=3,
                    teaching_beats=["Submit recovery after repairs with proof of completion", "Track: RCV, depreciation withheld, ACV paid, amount owed, deadline", "Recoverable depreciation can be 20-40% of the claim — never leave it"],
                    carrier_move="Make the recovery process confusing or slow to discourage claims",
                    our_move="Submit organized recovery package with all documentation and a clear deadline",
                    completion_criteria="Can calculate and submit a depreciation recovery claim"
                )
            ],
            quiz=[
                QuizQuestion(question="Recoverable depreciation is:", options=["Money you can never get back", "The withheld amount you claim after completing repairs", "The carrier's profit", "A tax deduction"], correct_answer=1),
                QuizQuestion(question="In Florida, labor costs:", options=["Should be depreciated at 50%", "Cannot be depreciated per statute", "Are not covered by insurance", "Depreciate at the same rate as materials"], correct_answer=1),
                QuizQuestion(question="On a $100K claim with 30% depreciation, the holdback is:", options=["$3,000", "$10,000", "$30,000", "$50,000"], correct_answer=2)
            ]
        ),

        # --- Operator 8: Code Upgrade Leverage ---
        Course(
            title="Code Upgrade Leverage",
            description="Building codes change. When repairs trigger code upgrades, the carrier may owe the additional cost. Know when and how to claim it.",
            category="Estimating",
            track="operator",
            difficulty=3,
            est_minutes=30,
            tags=["code upgrades", "ordinance", "law", "building codes"],
            why_this_matters="Code upgrades can add 15-25% to a claim. Carriers routinely exclude them unless you specifically claim them with documentation.",
            outcomes=["Identify when code upgrades apply to a repair", "Document code requirements for supplement submission", "Leverage Ordinance & Law coverage endorsements"],
            lessons=[
                Lesson(
                    title="When Codes Apply",
                    description="Triggers for code upgrade claims",
                    content="""# When Codes Apply

Building codes evolve. When a repair triggers compliance with current codes, the difference between old and new may be a covered cost.

## Common Triggers
- Roof replacement that must meet current wind-uplift requirements
- Electrical work requiring updated panel/wiring standards
- Plumbing repairs triggering current code compliance
- Structural repairs requiring hurricane strapping or tie-downs
- Energy code compliance for replacement windows/doors

## The Key Question
"Does this repair require compliance with a building code that is different from what was originally installed?" If yes, the upgrade cost may be covered.""",
                    duration_minutes=10,
                    order=1,
                    teaching_beats=["Code upgrades trigger when repairs must meet current standards", "Common triggers: wind uplift, electrical, plumbing, structural, energy", "Ask: does this repair require compliance with a newer code?"],
                    carrier_move="Estimate to old code standards, ignoring current requirements",
                    our_move="Research current local codes and document upgrade requirements",
                    completion_criteria="Can identify code upgrade triggers for the 5 most common repair types"
                ),
                Lesson(
                    title="Ordinance & Law Coverage",
                    description="Using the O&L endorsement",
                    content="""# Ordinance & Law Coverage

Many policies include Ordinance & Law (O&L) coverage — but you have to invoke it.

## What O&L Covers
- **Coverage A**: Cost to demolish undamaged portions that must be rebuilt to code
- **Coverage B**: Cost of increased construction to meet current codes
- **Coverage C**: Cost of demolition and debris removal due to code requirements

## Important
O&L coverage is usually a separate limit (often 25% of Coverage A). It won't appear in the base estimate — you must specifically claim it.

## Documentation Required
- Current local building code requirements
- Comparison: what was installed vs. what code now requires
- Cost difference between old standard and current code
- Permit requirements showing code compliance is mandatory""",
                    duration_minutes=10,
                    order=2,
                    teaching_beats=["O&L coverage is separate from base coverage — you must invoke it", "Three components: demolition, increased construction, debris removal", "Document: current code, old installation, cost difference, permits"],
                    carrier_move="Ignore O&L coverage unless you specifically claim it",
                    our_move="Review every policy for O&L endorsement and claim it when code upgrades apply",
                    completion_criteria="Can identify O&L coverage in a policy and calculate the available limit"
                ),
                Lesson(
                    title="Building the Code Upgrade Claim",
                    description="Documentation that supports code-related supplements",
                    content="""# Building the Code Upgrade Claim

## The Submission Package
1. Current local building code citation (specific section)
2. Description of what was originally installed
3. What current code requires for this repair
4. Line-item cost difference between old and current standard
5. Permit application or inspector confirmation (if available)

## Example
"Current Florida Building Code [section] requires wind-uplift resistance of [X] for roof replacement in this wind zone. Original installation was to [older standard]. Cost to meet current code exceeds original specification by [amount]. Per O&L endorsement, we request coverage for code upgrade costs."

## The Leverage
Code requirements are not negotiable — they're law. The carrier cannot authorize repairs that violate building codes.""",
                    duration_minutes=10,
                    order=3,
                    teaching_beats=["Code claims need: code citation, old vs new spec, cost difference, permit evidence", "Code requirements are law — carriers cannot authorize non-compliant repairs", "Always reference specific code sections, not general statements"],
                    carrier_move="Argue code upgrades are policyholder responsibility or not covered",
                    our_move="Submit code citation + cost difference + O&L endorsement reference. Codes are law, not optional.",
                    completion_criteria="Can build a code upgrade supplement package with supporting documentation"
                )
            ],
            quiz=[
                QuizQuestion(question="Code upgrades apply when:", options=["The homeowner wants premium materials", "Repairs must comply with current codes different from original installation", "The carrier requests it", "Only for new construction"], correct_answer=1),
                QuizQuestion(question="Ordinance & Law coverage:", options=["Is automatically included in base estimates", "Must be specifically claimed by you", "Only applies to commercial properties", "Covers maintenance items"], correct_answer=1),
                QuizQuestion(question="Building code requirements are:", options=["Negotiable with the carrier", "Suggestions, not requirements", "Law — carriers cannot authorize non-compliant repairs", "Only for total losses"], correct_answer=2)
            ]
        ),

        # --- Operator 9: The Merlin Lens ---
        Course(
            title="The Merlin Lens: Pattern Recognition",
            description="Learn to see what others miss. The Merlin Lens teaches you to recognize damage patterns, carrier behavior patterns, and claim outcome patterns.",
            category="Mentor Lenses",
            track="operator",
            difficulty=3,
            est_minutes=30,
            tags=["pattern recognition", "mentor lens", "analysis", "damage patterns"],
            why_this_matters="The best adjusters don't just see damage — they see patterns. Patterns in how damage presents, how carriers respond, and how claims resolve. This lens trains that skill.",
            outcomes=["Recognize common damage patterns across property types", "Identify carrier behavior patterns that predict outcomes", "Use pattern recognition to anticipate and prepare for claim developments"],
            lessons=[
                Lesson(
                    title="Damage Pattern Recognition",
                    description="Seeing what others miss on the property",
                    content="""# Damage Pattern Recognition

Damage follows patterns. Wind creates directional patterns. Hail creates random impact patterns. Water follows gravity. Understanding patterns helps you document completely.

## Wind Damage Patterns
- Directional — damage concentrated on windward side
- Uplift — soffit, ridge, and edge damage
- Pressure differential — breaches on windward, blowout on leeward

## Hail Damage Patterns
- Random — scattered impacts without directional bias
- Size consistency — impacts match reported hail size
- Collateral indicators — soft metals, AC units, vehicles

## Water Damage Patterns
- Gravity — damage descends from entry point
- Capillary — wicking upward through porous materials
- Continuity — follows connected paths through structure""",
                    duration_minutes=10,
                    order=1,
                    teaching_beats=["Wind = directional, hail = random, water = gravity-driven", "Patterns help you document completely and prove causation", "Collateral indicators (soft metals, vehicles) corroborate damage claims"],
                    carrier_move="Dispute causation when damage pattern isn't clearly documented",
                    our_move="Document the pattern itself as evidence of cause. Show direction, distribution, and collateral.",
                    completion_criteria="Can identify wind, hail, and water damage patterns from photos"
                ),
                Lesson(
                    title="Carrier Behavior Patterns",
                    description="Predicting their next move",
                    content="""# Carrier Behavior Patterns

Carriers are predictable. The same objections appear on the same types of claims.

## Roof Claims
Pattern: Lowball initial → deny supplement → claim pre-existing → delay → partial payment
Counter: Document pre-loss with aerials, submit structured supplement, track deadlines

## Water Claims
Pattern: Accept limited scope → deny "hidden" damage → argue maintenance → exclude mold
Counter: Document moisture readings, establish cause, avoid exclusion-trigger language

## Large Loss Claims
Pattern: Multiple inspections → engineer reports → extended delays → partial payments
Counter: Attend every inspection, get your own experts, document moving goalposts

## The Meta-Pattern
The carrier tests your resolve at each stage. Those who push back with documentation get paid. Those who accept get underpaid.""",
                    duration_minutes=10,
                    order=2,
                    teaching_beats=["Carriers follow predictable patterns by claim type", "Knowing the pattern lets you prepare counters in advance", "The meta-pattern: carriers test resolve at each stage, documentation wins"],
                    carrier_move="Follow the playbook for each claim type, testing resolve at each step",
                    our_move="Anticipate the playbook. Prepare evidence and rebuttals before they're needed.",
                    completion_criteria="Can predict the carrier's likely objection sequence for roof, water, and large loss claims"
                ),
                Lesson(
                    title="Outcome Pattern Recognition",
                    description="What predicts claim success",
                    content="""# Outcome Pattern Recognition

Successful claims share patterns. Failed claims share different ones.

## Winning Claim Patterns
- Documentation started Day 1
- Evidence hierarchy followed (Tier 1 first)
- Deadlines set and enforced
- Professional posture maintained
- Structured supplements with aligned evidence

## Losing Claim Patterns
- Documentation gaps or late start
- Reliance on opinions over objective proof
- No deadlines set or enforced
- Emotional or aggressive communications
- Unstructured supplement submissions

## The Takeaway
Claim outcomes are not random. They follow the patterns established in the first 30 days. Start right, stay disciplined, win.""",
                    duration_minutes=10,
                    order=3,
                    teaching_beats=["Winning claims share specific documentation and discipline patterns", "Losing claims share gaps in evidence, deadlines, and professionalism", "Outcomes are determined by patterns established in the first 30 days"],
                    carrier_move="Exploit early documentation gaps that can never be fully recovered",
                    our_move="Establish winning patterns from Day 1. The first 30 days determine the outcome.",
                    completion_criteria="Can evaluate a claim's trajectory by identifying its pattern indicators"
                )
            ],
            quiz=[
                QuizQuestion(question="Hail damage typically shows:", options=["Directional pattern", "Random scattered pattern", "Gravity pattern", "No pattern"], correct_answer=1),
                QuizQuestion(question="The carrier's meta-pattern is:", options=["Pay everything quickly", "Test resolve at each stage — documentation wins", "Deny everything always", "Random behavior"], correct_answer=1),
                QuizQuestion(question="Claim outcomes are largely determined by:", options=["Luck", "Patterns established in the first 30 days", "Which carrier it is", "The claim amount"], correct_answer=1)
            ]
        ),

        # --- Operator 10: Field Documentation Excellence ---
        Course(
            title="Field Documentation Excellence",
            description="The field inspection is where claims are won or lost. Master the documentation standards that create unassailable files.",
            category="Documentation",
            track="operator",
            difficulty=2,
            est_minutes=35,
            tags=["field inspection", "photos", "moisture", "measurements", "documentation"],
            why_this_matters="Everything starts in the field. Poor field documentation cannot be fixed later. Excellent field documentation makes every subsequent step easier.",
            outcomes=["Execute the complete field documentation protocol", "Take photos that prove causation and extent", "Record moisture readings and measurements to professional standards"],
            lessons=[
                Lesson(
                    title="The Field Documentation Protocol",
                    description="Systematic inspection process",
                    content="""# The Field Documentation Protocol

Every property inspection follows the same systematic process.

## The Protocol
1. **Exterior overview** — 4 corners, all elevations, wide shots
2. **Roof** — All slopes, penetrations, flashings, valleys, ridges, gutters
3. **Interior** — Room by room, ceiling to floor, all six surfaces
4. **Measurements** — Every damaged area with dimensions
5. **Moisture** — Readings at all suspected water intrusion points
6. **Collateral** — Soft metals, AC units, vehicles, fencing, outbuildings

## The Rule
Document EVERYTHING, not just obvious damage. What you don't photograph today becomes "pre-existing" tomorrow.""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["Follow the 6-step protocol: exterior, roof, interior, measurements, moisture, collateral", "Document everything — what you miss today becomes 'pre-existing' tomorrow", "Systematic process prevents gaps that carriers exploit"],
                    carrier_move="Exploit documentation gaps to deny or reduce scope",
                    our_move="Follow the complete protocol every time. Gaps are not recoverable.",
                    completion_criteria="Can execute the 6-step field documentation protocol from memory"
                ),
                Lesson(
                    title="Photos That Prove Causation",
                    description="Beyond documentation — building proof",
                    content="""# Photos That Prove Causation

Documentation photos record what's there. Causation photos prove WHY it's there.

## Causation Photography
- Show wind direction indicators alongside directional damage
- Show hail impact pattern across multiple surfaces
- Show water trail from entry point to damage location
- Show the breach and the resulting interior damage in sequence

## Context Is Everything
A close-up of a damaged shingle proves nothing. A sequence showing: storm data → wind direction → directional roof damage → matching interior leak → moisture readings proves a covered loss.

## The Three-Shot Rule (Enhanced)
1. Wide — property context and damage location
2. Medium — damage extent with surrounding context
3. Close-up — damage detail with measurement reference
PLUS: Causation shot — evidence connecting damage to covered peril""",
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Documentation photos record damage; causation photos prove why it happened", "Build photo sequences that tell the story: event → breach → damage → measurements", "Enhanced three-shot rule adds the causation shot"],
                    carrier_move="Dismiss isolated photos that show damage but not causation",
                    our_move="Build photo sequences that create an undeniable causal chain",
                    completion_criteria="Can create a 4-photo causation sequence for a roof leak scenario"
                ),
                Lesson(
                    title="Moisture Readings & Measurements",
                    description="The numbers that make your case",
                    content="""# Moisture Readings & Measurements

Objective measurements are Tier 1 evidence. They cannot be argued.

## Moisture Reading Standards
- Record: location, date, time, reading value, equipment used
- Compare to dry standard (typically 12% for drywall)
- Map the affected area with readings at gridded intervals
- Document both wet and dry areas to define boundaries

## Measurement Standards
- All dimensions in feet and inches
- Include in photos where possible (tape measure visible)
- Cross-reference with scope line items
- Verify quantities match actual measurements, not estimates

## The Power of Numbers
"Moisture reading 42% at NE corner (dry standard 12%)" is more powerful than any narrative. Numbers are objective. Numbers compel payment.""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["Moisture readings and measurements are Tier 1 objective evidence", "Record: location, date, time, value, equipment, comparison to dry standard", "Numbers are objective and compel payment — narrative cannot substitute"],
                    carrier_move="Dispute subjective damage descriptions and vague observations",
                    our_move="Replace descriptions with measurements. Numbers cannot be argued.",
                    completion_criteria="Can properly document moisture readings with all required data points"
                )
            ],
            quiz=[
                QuizQuestion(question="The field documentation protocol starts with:", options=["Interior room-by-room", "Exterior overview from 4 corners", "Roof inspection only", "Moisture readings"], correct_answer=1),
                QuizQuestion(question="A causation photo shows:", options=["Just the damage", "The connection between the covered event and the damage", "Only close-up details", "The entire property"], correct_answer=1),
                QuizQuestion(question="The dry standard for drywall moisture is typically:", options=["0%", "12%", "25%", "42%"], correct_answer=1)
            ]
        ),
    ]

    # ========== ADVANCED-ELITE COURSES ==========

    advanced_elite_courses = [
        Course(
            title="Bad Faith Recognition & Escalation",
            description="Know when carrier behavior crosses the line—and what to do about it.",
            category="Escalation & Dispute",
            track="advanced-elite",
            difficulty=4,
            est_minutes=70,
            tags=["bad faith", "escalation", "litigation", "appraisal", "DOI"],
            why_this_matters="Bad faith is the ultimate leverage. When the carrier's conduct crosses from hard bargaining into improper behavior, knowing the line — and documenting it — changes the entire dynamic.",
            outcomes=["Distinguish bad faith from ordinary claim disputes", "Execute the 5-level escalation ladder", "Prepare a file that supports legal action if needed"],
            thumbnail="https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=400",
            lessons=[
                Lesson(
                    title="What Constitutes Bad Faith",
                    description="Drawing the line between hard bargaining and improper conduct",
                    content="""# What Constitutes Bad Faith

Bad faith is more than just a low offer. It's a pattern of conduct that violates the carrier's duty of good faith and fair dealing.

## The Duty of Good Faith

Every insurance contract carries an implied covenant of good faith. The carrier must:
- Conduct reasonable investigation
- Make coverage decisions based on facts, not desired outcome
- Pay valid claims promptly
- Communicate honestly with the insured

## Red Flags: Conduct That May Indicate Bad Faith

### Investigation Failures
- Failing to investigate before denying
- Ignoring evidence that supports coverage
- Relying solely on biased "experts"
- Not interviewing key witnesses

### Communication Failures
- Misrepresenting policy provisions
- Not explaining basis for denial
- Failing to respond to communications
- Providing misleading information

### Payment Failures
- Unreasonable delays without justification
- Compelling litigation when liability is clear
- Failing to pay undisputed portions
- Repeatedly undervaluing claims

### Documentation Manipulation
- Altering claim files
- Destroying evidence
- Withholding claim file from insured (in states with access rights)
- Selective use of information

## What Bad Faith Is NOT

- A low estimate (unless it's a pattern or clearly unreasonable)
- A single delayed response
- A disagreement on scope
- Aggressive negotiation tactics

Bad faith requires more than just not getting what you want. It requires conduct that is unreasonable, knowing, or reckless.

## First vs. Third Party Bad Faith

### First Party (Your Claim Against Your Carrier)
You have a contract. They owe you good faith in handling YOUR claim.

### Third Party (Liability Claims)
Different rules apply when the carrier is defending you against someone else's claim. Not our focus here.

## Building the Bad Faith File

From day one, document as if you may need to prove bad faith later:
- Every communication (dated, with names)
- Every request and response time
- Every promise made and kept/broken
- Every document provided and withheld

You may never need it. But if you do, you'll be ready.""",
                    duration_minutes=25,
                    order=1
                ),
                Lesson(
                    title="Escalation Strategies",
                    description="When and how to escalate disputes",
                    content="""# Escalation Strategies

Not every claim needs escalation. But when it does, know your options.

## The Escalation Ladder

### Level 1: Supervisor/Manager
Sometimes the field adjuster is the problem. Request supervisor review. Put it in writing.

### Level 2: Formal Complaint to Carrier
Most carriers have complaint procedures. This creates a paper trail and may trigger internal review.

### Level 3: State Insurance Department
File a complaint. The Department may not resolve your claim, but:
- Creates regulatory record
- May prompt carrier response
- Builds bad faith documentation

### Level 4: Appraisal
If your policy has an appraisal clause and the dispute is about AMOUNT (not coverage), appraisal may be faster than litigation.

### Level 5: Litigation
The nuclear option. Expensive and slow, but sometimes necessary.

## When to Escalate

### Escalate When:
- Carrier is non-responsive despite documented attempts
- Carrier is misrepresenting policy language
- Undisputed amounts remain unpaid
- Pattern of conduct suggests bad faith
- Reasonable negotiations have failed

### Don't Escalate When:
- You're just frustrated (understandable, but not strategic)
- You haven't documented properly
- The dispute is minor and resolution is possible
- You're trying to create leverage you don't actually have

## The Appraisal Process

### What It Is
A contractual dispute resolution for AMOUNT disagreements. Each party appoints an appraiser. Appraisers select an umpire. Two of three determine the loss amount.

### Advantages
- Faster than litigation
- Less expensive than litigation
- Binding (usually) on amount

### Limitations
- Only addresses amount, not coverage
- You pay your appraiser + half the umpire
- Carrier may try to reserve coverage issues

### Strategic Considerations
- Invoke early if amount is the only dispute
- Consider waiting if you need discovery on bad faith
- Document everything for potential later litigation

## Department of Insurance Complaints

### What They Can Do
- Investigate carrier practices
- Require carrier response
- Impose fines for violations
- Provide you documentation for litigation

### What They Can't Do
- Force claim payment
- Interpret your policy
- Act as your attorney

### Filing Effectively
- Be specific and factual
- Include documentation
- Focus on regulatory violations, not just "unfairness"
- Follow up appropriately""",
                    duration_minutes=25,
                    order=2
                ),
                Lesson(
                    title="Working With Attorneys",
                    description="When to engage counsel and how to prepare",
                    content="""# Working With Attorneys

Legal representation isn't always necessary. But when it is, proper preparation maximizes effectiveness.

## When to Consider an Attorney

### Strong Indicators
- Coverage denial on substantial claim
- Bad faith indicators present
- Complex policy interpretation issues

            # Include source details
            playlist_sources = []
            for source_id in playlist["sources"]:
                for source in APPROVED_VIDEO_SOURCES:
                    if source["id"] == source_id:
                        playlist_sources.append(source)
            return {**playlist, "source_details": playlist_sources}
    raise HTTPException(status_code=404, detail="Playlist not found")

- Carrier acting in violation of statute
- Claim value justifies legal costs

### Weaker Indicators
- Simple scope disputes
- Minor delays
- Personality conflicts with adjuster
- Claims that can be resolved through appraisal

## Types of Attorneys

### Policyholder Attorneys
Specialize in representing insureds against carriers. Know the tactics. Understand policy language. Often work on contingency.

### Bad Faith Specialists
Subset focused specifically on carrier misconduct. Relevant when the issue is conduct, not just coverage.

### General Litigators
May take insurance cases but lack specialized knowledge. Be cautious.

## Finding the Right Attorney

### Look For
- Specific experience with your type of claim
- Track record against your carrier
- Clear fee structure
- Willingness to explain strategy
- References from other policyholders

### Avoid
- "We handle everything" generalists
- High-pressure sales tactics
- Promises of specific outcomes
- Unclear or shifting fee arrangements

## Preparing for Legal Consultation

### Bring
- Complete policy (all pages, all endorsements)
- Claim documentation (your file)
- Correspondence chronology
- Carrier estimates and denial letters
- Your damage documentation
- List of specific questions

### Know
- Your claim timeline
- Key dates and deadlines
- What you've requested and received
- What specifically you want the attorney to achieve

## Fee Arrangements

### Contingency
Attorney takes percentage of recovery. You pay nothing upfront. Common in bad faith cases.

### Hourly
You pay for time spent. More predictable costs but ongoing expense.

### Hybrid
Reduced hourly rate plus smaller contingency. Aligns interests while managing costs.

## Working Together

### Your Role
- Provide complete information
- Respond promptly to requests
- Don't negotiate directly once represented
- Document ongoing carrier conduct
- Ask questions when unclear

### Attorney's Role
- Strategy development
- Carrier communication
- Legal filing and court appearances
- Settlement negotiation
- Keeping you informed

Remember: The attorney works FOR you. Stay engaged. Ask questions. Understand the strategy.""",
                    duration_minutes=20,
                    order=3
                )
            ],
            quiz=[
                QuizQuestion(
                    question="Bad faith requires:",
                    options=["Any disagreement with the carrier", "Unreasonable, knowing, or reckless conduct violating good faith duties", "A low estimate", "Delayed response"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="The appraisal process can resolve disputes about:",
                    options=["Whether coverage exists", "The AMOUNT of loss only", "Bad faith conduct", "All claim issues"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="Before consulting an attorney, you should:",
                    options=["Delete all your documentation", "Have your complete policy, claim file, and correspondence organized", "Accept the carrier's offer", "Stop communicating with the carrier"],
                    correct_answer=1
                )
            ]
        ),

        # --- Advanced-Elite 2: Advanced Carrier Warfare ---
        Course(
            title="Advanced Carrier Warfare",
            description="Deep study of carrier systems, authority structures, and internal processes. Use this knowledge to navigate complex claims strategically.",
            category="Carrier Warfare",
            track="advanced-elite",
            difficulty=4,
            est_minutes=40,
            tags=["carrier systems", "authority", "reserves", "internal process"],
            why_this_matters="Understanding how the carrier operates internally gives you an information advantage. You stop reacting and start anticipating.",
            outcomes=["Understand carrier authority structures and escalation triggers", "Recognize how reserves drive adjuster behavior", "Navigate carrier internal processes to your advantage"],
            lessons=[
                Lesson(
                    title="Carrier Authority Structures",
                    description="Who can approve what, and how to navigate it",
                    content="""# Carrier Authority Structures

Every carrier adjuster has a payment authority limit. Understanding this changes how you negotiate.

## The Authority Chain
- Field adjuster: typically $10K-$50K authority
- Supervisor/team lead: $50K-$150K
- Manager: $150K-$500K
- Complex claims unit: $500K+

## What This Means
When an adjuster says "I can't approve that amount," they may be telling the truth. Your response: "Please escalate to someone with appropriate authority. I'll follow up in writing."

## Reserve Impact
Carrier adjusters set reserves (estimated total cost) early. Exceeding reserves triggers supervisor review and additional scrutiny. This is why first impressions and early documentation matter — they influence the initial reserve.""",
                    duration_minutes=14,
                    order=1,
                    teaching_beats=["Adjusters have specific payment authority limits", "Request escalation to appropriate authority when limits are exceeded", "Initial reserves influence the entire claim trajectory"],
                    carrier_move="Use authority limits as an excuse to delay or underpay",
                    our_move="Request escalation in writing. Document who has authority and whether they've reviewed.",
                    completion_criteria="Can identify when authority limits are the real issue vs. a delay tactic"
                ),
                Lesson(
                    title="How Reserves Drive Behavior",
                    description="The number that controls the claim",
                    content="""# How Reserves Drive Behavior

The reserve is the carrier's internal estimate of total claim cost. It drives everything.

## Reserve Psychology
- Low initial reserve → adjuster faces pressure to keep costs within it
- Exceeding reserve → triggers supervisor review, additional scrutiny
- Significantly exceeding reserve → may trigger reinsurance notification

## Your Leverage
Strong early documentation forces a higher initial reserve. A higher reserve gives the adjuster more room to pay fairly.

## How to Influence Reserves
- Submit complete documentation early (before reserve is set)
- Include Tier 1 evidence that demonstrates the full scope
- Don't hide damage or supplements — present the full picture upfront
- Make the initial estimate realistic, not a lowball you plan to supplement""",
                    duration_minutes=13,
                    order=2,
                    teaching_beats=["Reserves are the carrier's internal cost estimate — they drive adjuster behavior", "Strong early documentation forces higher initial reserves", "Higher reserves = more room for the adjuster to pay fairly"],
                    carrier_move="Set low initial reserves and pressure adjusters to stay within them",
                    our_move="Present complete, strong documentation early to influence the initial reserve upward",
                    completion_criteria="Can explain how reserves influence adjuster behavior and claim outcomes"
                ),
                Lesson(
                    title="Navigating Internal Processes",
                    description="Working the system, not against it",
                    content="""# Navigating Internal Processes

Carriers have internal processes. Understanding them lets you work the system strategically.

## Key Processes
- **SIU referral** — Special Investigations Unit. Triggered by red flags. Know what triggers referral and avoid them.
- **Desk review** — Remote adjuster reviews file. Often misses damage. Request field inspection when desk review is inadequate.
- **Engineer referral** — Carrier hires an engineer. Get your own engineer. Don't accept their expert as the final word.
- **Claim transfer** — Claim moves to new adjuster. Opportunity: re-submit with fresh eyes. Risk: timeline resets.

## The Strategic Approach
Don't fight the process — navigate it. Know what triggers each internal step, prepare for it, and use each touchpoint as an opportunity to strengthen your position.""",
                    duration_minutes=13,
                    order=3,
                    teaching_beats=["Know what triggers SIU, desk review, engineer referral, and claim transfer", "Each internal process step is an opportunity to strengthen your position", "Navigate the system strategically — don't fight it"],
                    carrier_move="Use internal processes (SIU, engineers, transfers) to delay and complicate",
                    our_move="Anticipate internal processes, prepare documentation, use each as an opportunity",
                    completion_criteria="Can identify and navigate 4 common carrier internal processes"
                )
            ],
            quiz=[
                QuizQuestion(question="When an adjuster says 'I can't approve that amount,' you should:", options=["Accept it as final", "Request written escalation to someone with appropriate authority", "File a lawsuit", "Reduce your scope to fit"], correct_answer=1),
                QuizQuestion(question="Strong early documentation influences:", options=["Nothing — carriers ignore it", "The initial reserve, which drives the entire claim", "Only the adjuster's mood", "The policy language"], correct_answer=1),
                QuizQuestion(question="When a claim is transferred to a new adjuster:", options=["You've lost all progress", "It's an opportunity to re-submit with fresh eyes", "You must start over", "You should withdraw the claim"], correct_answer=1)
            ]
        ),

        # --- Advanced-Elite 3: Total Loss Strategy ---
        Course(
            title="Total Loss & Valued Policy Strategy",
            description="Total losses have unique rules. Valued policy laws, demolition costs, and debris removal create recovery opportunities most adjusters miss.",
            category="Policy Mastery",
            track="advanced-elite",
            difficulty=4,
            est_minutes=35,
            tags=["total loss", "valued policy", "demolition", "debris removal"],
            why_this_matters="A total loss in a valued policy state means the carrier must pay the full Coverage A limit — period. Missing this can cost the policyholder hundreds of thousands.",
            outcomes=["Identify when valued policy law applies", "Calculate total loss recovery including demolition and debris", "Navigate the total loss claim from declaration through settlement"],
            lessons=[
                Lesson(
                    title="Valued Policy Law",
                    description="When the carrier owes the full limit",
                    content="""# Valued Policy Law

In valued policy states (FL, LA, MS, TX, others), a total loss from a covered peril means the carrier must pay the full Coverage A limit — regardless of actual property value.

## Requirements
- Must be a total loss (not partial)
- Must be a covered peril
- Applies to the dwelling (Coverage A)

## The Carrier's Game
Carriers may argue the loss is partial (not total) to avoid valued policy obligations. They may also argue the property was worth less than the insured amount.

## Your Response
If the cost to repair exceeds the Coverage A limit OR the property is deemed structurally unsound, it's a total loss. Document everything supporting the total loss determination.""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["Valued policy states: total loss = full Coverage A limit payment", "Carriers will argue partial loss to avoid valued policy obligations", "Document everything supporting total loss determination"],
                    carrier_move="Argue the loss is partial to avoid paying the full Coverage A limit",
                    our_move="Document total loss with structural assessments, repair cost analysis, and code compliance",
                    completion_criteria="Can identify valued policy states and explain when the law applies"
                ),
                Lesson(
                    title="Additional Total Loss Recovery",
                    description="Demolition, debris, and beyond",
                    content="""# Additional Total Loss Recovery

Total loss recovery goes beyond the dwelling value.

## Additional Coverages
- **Debris removal** — Cost to remove damaged structure (often 5% of Coverage A or separate limit)
- **Demolition** — Cost to demolish remaining structure (under O&L coverage)
- **Code compliance** — Additional cost to rebuild to current codes (O&L)
- **Coverage B** — Other structures (detached garage, fence, shed — usually 10% of A)
- **Coverage D** — Additional living expenses while displaced
- **Coverage C** — Personal property at ACV or RCV depending on policy

## The Calculation
Coverage A + debris removal + demolition + code upgrade + Coverage B + C + D = total recovery. On a valued policy total loss, this can significantly exceed the dwelling value.""",
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Total loss recovery includes 6+ coverage categories beyond the dwelling", "O&L coverage adds demolition and code upgrade costs", "Total recovery can significantly exceed the Coverage A limit alone"],
                    carrier_move="Pay only Coverage A and ignore additional coverages you don't claim",
                    our_move="Claim every applicable coverage: debris, demolition, code, B, C, and D",
                    completion_criteria="Can calculate total recovery across all coverage categories for a total loss"
                ),
                Lesson(
                    title="Managing the Total Loss Claim",
                    description="From determination through settlement",
                    content="""# Managing the Total Loss Claim

## Step 1: Establish Total Loss
- Engineering report showing structural failure or unsafe condition
- Repair estimate exceeding Coverage A limit
- Code official determination (if available)

## Step 2: Invoke All Coverages
- Reference valued policy law (in applicable states)
- Claim O&L for demolition and code upgrades
- Submit Coverage B, C, and D claims simultaneously

## Step 3: Document Living Expenses
- Receipts for temporary housing, meals, storage
- Maintain ongoing documentation throughout displacement

## Step 4: Negotiate Settlement
- Present total calculation across all coverages
- Reference valued policy law for Coverage A (no negotiation on amount)
- Negotiate additional coverages with supporting documentation""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["4-step process: establish total loss, invoke all coverages, document expenses, negotiate", "Valued policy law makes Coverage A non-negotiable on total loss", "Additional coverages still require documentation and structured submission"],
                    carrier_move="Delay total loss determination to limit exposure",
                    our_move="Present engineering evidence + repair costs + code requirements to force determination",
                    completion_criteria="Can manage a total loss claim through all 4 steps"
                )
            ],
            quiz=[
                QuizQuestion(question="In a valued policy state with total loss:", options=["Carrier pays actual value", "Carrier pays full Coverage A limit", "Carrier negotiates", "Coverage is voided"], correct_answer=1),
                QuizQuestion(question="Total loss recovery includes:", options=["Only Coverage A", "Coverage A plus debris, demolition, code, B, C, and D", "Only what the carrier offers", "Only the deductible"], correct_answer=1),
                QuizQuestion(question="To establish total loss, you need:", options=["The homeowner's opinion", "Engineering report, repair estimate exceeding Coverage A, or code determination", "Just photos of damage", "Only the adjuster's agreement"], correct_answer=1)
            ]
        ),

        # --- Advanced-Elite 4: Multi-Peril Navigation ---
        Course(
            title="Multi-Peril Claim Navigation",
            description="When wind meets water meets pre-existing conditions. Navigate complex multi-peril claims where causation and coverage intersect.",
            category="Claims Fundamentals",
            track="advanced-elite",
            difficulty=5,
            est_minutes=40,
            tags=["multi-peril", "causation", "concurrent cause", "anti-concurrent"],
            why_this_matters="Most complex claims involve multiple perils. Carriers use causation confusion to deny coverage. Understanding multi-peril analysis is what separates operators from elite adjusters.",
            outcomes=["Analyze claims with multiple contributing causes", "Navigate anti-concurrent causation clauses", "Document each peril's independent contribution to the loss"],
            lessons=[
                Lesson(
                    title="Multiple Causes of Loss",
                    description="When more than one peril contributes",
                    content="""# Multiple Causes of Loss

Real claims rarely have a single, clean cause. Wind opens a roof → water enters → mold develops. Which is covered?

## Causation Analysis
- **Independent cause** — Each peril caused separate damage (wind damaged roof, water damaged interior)
- **Concurrent cause** — Multiple perils combined to cause damage
- **Chain causation** — One peril led to another (wind → water → mold)

## The Key
Document each peril's INDEPENDENT contribution. Even if one cause is excluded, the covered cause's damage should be paid separately.

## Evidence Approach
Photograph and document each type of damage separately. Show which damage is attributable to which cause. Don't blend them — separate them.""",
                    duration_minutes=14,
                    order=1,
                    teaching_beats=["Three causation types: independent, concurrent, and chain", "Document each peril's independent contribution separately", "Blending causes helps the carrier — separating them helps you"],
                    carrier_move="Blend causes to apply exclusions broadly across all damage",
                    our_move="Separate and document each cause independently with specific evidence",
                    completion_criteria="Can categorize a multi-peril loss into causation types"
                ),
                Lesson(
                    title="Anti-Concurrent Causation Clauses",
                    description="The carrier's strongest weapon in multi-peril claims",
                    content="""# Anti-Concurrent Causation Clauses

Some policies state: if a covered AND excluded peril combine to cause loss, there is NO coverage. This is the anti-concurrent causation (ACC) clause.

## How Carriers Use It
Wind (covered) + flood (excluded) both contribute to damage → carrier invokes ACC → denies entire claim.

## Your Counter-Arguments
1. Document the covered peril's INDEPENDENT contribution
2. Show damage that is solely attributable to the covered peril
3. Research your jurisdiction — some courts enforce ACC narrowly or find it unconscionable
4. Argue that the covered peril created a separate and distinct loss

## Documentation Strategy
Separate wind damage from water damage. Separate storm damage from pre-existing. Never blend causes in your documentation — always isolate each.""",
                    duration_minutes=13,
                    order=2,
                    teaching_beats=["ACC clauses deny all coverage when covered and excluded perils combine", "Counter: document the covered peril's independent, separate contribution", "Some courts enforce ACC narrowly — know your jurisdiction"],
                    carrier_move="Invoke ACC to deny entire claim when any excluded peril contributed",
                    our_move="Isolate and document the covered peril's independent damage separately",
                    completion_criteria="Can explain ACC and present counter-arguments with supporting documentation"
                ),
                Lesson(
                    title="The Multi-Peril Documentation Method",
                    description="Separating, documenting, and claiming each cause",
                    content="""# The Multi-Peril Documentation Method

## Step 1: Identify All Contributing Causes
List every peril that contributed: wind, water, hail, pre-existing, maintenance, etc.

## Step 2: Document Each Separately
For each cause, create a separate evidence package:
- Photos showing damage attributable to THIS cause specifically
- Expert opinion on causation (if needed)
- Timeline showing when this damage occurred

## Step 3: Categorize Coverage
- Covered peril damage → claim in full
- Excluded peril damage → note but don't claim
- Ambiguous → document for the covered interpretation with evidence

## Step 4: Submit Structured Claim
Present: "The covered peril (wind) caused [X] damage valued at [$]. This damage is independent of and separable from any excluded-peril damage."

Never give the carrier a reason to blend causes.""",
                    duration_minutes=13,
                    order=3,
                    teaching_beats=["4-step method: identify causes, document separately, categorize coverage, submit structured", "Create separate evidence packages for each contributing peril", "Present covered peril damage as independent and separable"],
                    carrier_move="Blend all damage together and apply the broadest exclusion",
                    our_move="Separate, document, and present each cause independently with its own evidence",
                    completion_criteria="Can execute the 4-step multi-peril documentation method"
                )
            ],
            quiz=[
                QuizQuestion(question="In multi-peril claims, you should:", options=["Blend all causes together", "Document each peril's independent contribution separately", "Only mention the covered peril", "Let the carrier determine causation"], correct_answer=1),
                QuizQuestion(question="Anti-concurrent causation clauses:", options=["Always benefit the policyholder", "Deny coverage when covered and excluded perils combine", "Are in every policy", "Can never be challenged"], correct_answer=1),
                QuizQuestion(question="The multi-peril documentation method starts with:", options=["Filing a lawsuit", "Identifying all contributing causes", "Accepting the carrier's causation analysis", "Ignoring excluded perils"], correct_answer=1)
            ]
        ),

        # --- Advanced-Elite 5: The Bill Wilson Lens ---
        Course(
            title="The Bill Wilson Lens: Coverage Archaeology",
            description="Dig beneath the surface of policy language. Find coverage others miss by reading like the carrier reads — but better.",
            category="Mentor Lenses",
            track="advanced-elite",
            difficulty=5,
            est_minutes=35,
            tags=["coverage", "policy analysis", "mentor lens", "endorsements", "exclusions"],
            why_this_matters="The policy is a layered document. Most adjusters read the surface. Elite adjusters dig through definitions, endorsements, exceptions to exclusions, and ensuing loss provisions to find coverage the carrier hopes you'll miss.",
            outcomes=["Analyze policy language at the endorsement and definition level", "Find exceptions to exclusions that restore coverage", "Apply the ensuing loss doctrine to complex claims"],
            lessons=[
                Lesson(
                    title="Reading Below the Surface",
                    description="Definitions, endorsements, and hidden coverage",
                    content="""# Reading Below the Surface

The insuring agreement is broad. Exclusions narrow it. But exceptions, definitions, and endorsements can widen it again.

## Where Coverage Hides
- **Definitions** — Policy-defined terms may be broader (or narrower) than expected
- **Exceptions to exclusions** — "We exclude X, BUT we cover Y" — the exception can restore substantial coverage
- **Endorsements** — Added coverages that modify the base policy. Always read every endorsement.
- **Ensuing loss provisions** — Even when a cause is excluded, resulting damage may be covered

## The Archaeology Method
1. Read the insuring agreement (broad coverage)
2. Read exclusions (what's carved out)
3. Read exceptions to exclusions (what's given back)
4. Read definitions (what terms actually mean)
5. Read every endorsement (modifications)
6. Read conditions (duties and procedures)""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["Coverage hides in definitions, exceptions, endorsements, and ensuing loss provisions", "Exceptions to exclusions can restore substantial coverage", "The 6-step archaeology method reads the full policy systematically"],
                    carrier_move="Cite exclusions without mentioning their exceptions",
                    our_move="Read the full exclusion including exceptions. Quote the exception back to the carrier.",
                    completion_criteria="Can execute the 6-step policy archaeology method"
                ),
                Lesson(
                    title="Exceptions to Exclusions",
                    description="Finding coverage the carrier hopes you'll miss",
                    content="""# Exceptions to Exclusions

The exclusion section follows a pattern: "We do not cover [X]. But we DO cover [Y]."

## Common Exceptions That Restore Coverage
- Water exclusion → Exception for "sudden and accidental discharge from plumbing"
- Earth movement → Exception for "ensuing fire or explosion"
- Wear and tear → Exception for "resulting damage from a covered peril"
- Faulty workmanship → Exception for "ensuing loss from covered peril"

## The Strategy
When the carrier cites an exclusion, your immediate response: "What are the exceptions to that exclusion?" Read the full section — not just the exclusion, but the exception that follows.

## Ambiguity Doctrine
If policy language is genuinely ambiguous, courts interpret against the drafter (carrier). This is "contra proferentem." But don't overplay it — the ambiguity must be real.""",
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Every exclusion has exceptions — always read the full section", "Common exceptions: sudden discharge, ensuing fire, resulting damage, ensuing loss", "Contra proferentem: ambiguity is interpreted against the carrier (but must be genuine)"],
                    carrier_move="Quote exclusions selectively, omitting the exceptions that restore coverage",
                    our_move="Quote the full exclusion section including exceptions. Ask: which exception applies here?",
                    completion_criteria="Can identify exceptions to 4 common exclusions from policy language"
                ),
                Lesson(
                    title="The Ensuing Loss Doctrine",
                    description="When excluded causes lead to covered damage",
                    content="""# The Ensuing Loss Doctrine

Many policies exclude certain causes but cover "ensuing loss" — damage that RESULTS from the excluded cause.

## How It Works
- Excluded cause: faulty construction (not covered)
- Ensuing loss: water damage resulting from the faulty construction (covered)
- The faulty construction isn't paid for, but the water damage it caused IS.

## Application
1. Identify the excluded cause
2. Identify the resulting damage (ensuing loss)
3. Demonstrate the causal chain with evidence
4. Claim the ensuing loss under the applicable coverage

## The Power
Ensuing loss doctrine means that even when the ROOT cause is excluded, the RESULTING damage may be fully covered. This is one of the most powerful coverage arguments available.

## Carrier Counter
Carriers may invoke anti-concurrent causation. Your response: ensuing loss is sequential (cause → result), not concurrent. Document the chain.""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["Ensuing loss: excluded root cause, but resulting damage is covered", "Document the causal chain: excluded cause → resulting covered damage", "Ensuing loss is sequential causation, not concurrent — document the chain"],
                    carrier_move="Deny entire claim based on excluded root cause, ignoring ensuing loss",
                    our_move="Acknowledge excluded cause, then claim ensuing loss with documented causal chain",
                    completion_criteria="Can identify and claim ensuing loss in a complex coverage scenario"
                )
            ],
            quiz=[
                QuizQuestion(question="The policy archaeology method has:", options=["2 steps", "4 steps", "6 steps reading from insuring agreement through conditions", "No specific steps"], correct_answer=2),
                QuizQuestion(question="Ensuing loss doctrine means:", options=["All losses are covered", "Resulting damage from an excluded cause may still be covered", "Nothing is excluded", "Only the first loss is covered"], correct_answer=1),
                QuizQuestion(question="When a carrier cites an exclusion, you should:", options=["Accept the denial", "Read the full exclusion section including exceptions", "File a lawsuit", "Ignore the exclusion"], correct_answer=1)
            ]
        ),

        # --- Advanced-Elite 6: The Voelpel Lens ---
        Course(
            title="The Voelpel Lens: Xactimate Mastery",
            description="The industry prices in Xactimate. Master the platform, challenge carrier pricing, and ensure every estimate reflects true repair costs.",
            category="Mentor Lenses",
            track="advanced-elite",
            difficulty=4,
            est_minutes=35,
            tags=["Xactimate", "estimating", "pricing", "mentor lens", "line items"],
            why_this_matters="Carriers use Xactimate pricing that may lag behind market reality. If you don't understand the platform, you can't challenge their numbers. Mastering Xactimate is mastering the financial language of claims.",
            outcomes=["Navigate Xactimate pricing and identify below-market rates", "Challenge carrier estimates with industry-standard line items", "Build supplements using proper Xactimate methodology"],
            lessons=[
                Lesson(
                    title="Understanding Xactimate Pricing",
                    description="How the industry-standard platform works",
                    content="""# Understanding Xactimate Pricing

Xactimate is the industry-standard estimating platform. Both carriers and adjusters use it. Understanding it is non-negotiable.

## How Pricing Works
- Prices are regional (by zip code)
- Updated monthly based on market data
- Include labor, material, and equipment components
- Carriers may use custom price lists that differ from standard

## The Critical Issue
Carrier-modified price lists often lag behind actual market costs. Standard Xactimate pricing reflects surveyed market rates. If the carrier uses modified pricing, document the discrepancy.

## Your Advantage
Know what standard Xactimate pricing says. If the carrier's numbers are below standard, you have a clear, objective basis for challenge.""",
                    duration_minutes=12,
                    order=1,
                    teaching_beats=["Xactimate is regional, monthly updated, with labor/material/equipment components", "Carriers may use custom price lists below standard market rates", "Standard Xactimate pricing is your objective basis for pricing challenges"],
                    carrier_move="Use carrier-modified price lists below standard Xactimate rates",
                    our_move="Compare carrier pricing to standard Xactimate. Document discrepancies.",
                    completion_criteria="Can explain Xactimate pricing structure and identify carrier modifications"
                ),
                Lesson(
                    title="Challenging Carrier Estimates",
                    description="Line-by-line analysis and response",
                    content="""# Challenging Carrier Estimates

Don't challenge the total — challenge specific line items.

## The Review Process
1. Compare carrier's line items to your scope (what's missing?)
2. Compare quantities (do their measurements match yours?)
3. Compare pricing (standard vs. carrier-modified?)
4. Check methodology (correct repair method specified?)
5. Verify O&P inclusion (if warranted)

## Common Issues
- Missing line items (carrier scope is incomplete)
- Reduced quantities (their measurements are wrong or understated)
- Below-market pricing (carrier-modified price list)
- Wrong repair method (patch vs. replace, spot vs. full)
- Missing O&P on qualifying claims

## Submission
"The following line items are missing, understated, or incorrectly priced in the carrier's estimate. Attached is our line-item comparison with supporting documentation for each discrepancy." """,
                    duration_minutes=12,
                    order=2,
                    teaching_beats=["Challenge specific line items, not the total", "5-point review: items, quantities, pricing, methodology, O&P", "Submit line-item comparison with evidence for each discrepancy"],
                    carrier_move="Submit low estimates hoping you challenge the total instead of specific items",
                    our_move="Analyze line by line. Challenge specific items with specific evidence.",
                    completion_criteria="Can perform a 5-point line-item comparison between two estimates"
                ),
                Lesson(
                    title="Building Supplements in Xactimate",
                    description="Proper methodology for supplement estimates",
                    content="""# Building Supplements in Xactimate

## Supplement Best Practices
- Reference the original estimate — show what was included vs. what's missing
- Use the same line-item format for easy comparison
- Include only new items discovered or items that need correction
- Price at standard regional rates (not inflated, not discounted)
- Attach evidence for every new line item

## Common Supplement Categories
1. Hidden damage discovered during demolition
2. Scope items missed in original estimate
3. Code upgrades required by jurisdiction
4. O&P when GC involvement is warranted
5. Price corrections for below-market carrier pricing

## The Standard
Every supplement line item must be defensible. If you can't prove it, don't include it. Accuracy builds credibility across all your claims.""",
                    duration_minutes=11,
                    order=3,
                    teaching_beats=["Reference original estimate, use same format, include only new/corrected items", "5 supplement categories: hidden damage, missed scope, codes, O&P, pricing", "Accuracy builds cumulative credibility — never include indefensible items"],
                    carrier_move="Deny supplements citing 'insufficient documentation' or 'not in original scope'",
                    our_move="Align every supplement item to evidence and reference the original estimate gap",
                    completion_criteria="Can build a properly formatted supplement with aligned evidence"
                )
            ],
            quiz=[
                QuizQuestion(question="Carrier-modified Xactimate price lists:", options=["Are always fair", "May lag behind standard market rates", "Are set by law", "Cannot be challenged"], correct_answer=1),
                QuizQuestion(question="When reviewing a carrier estimate, you should:", options=["Only look at the total", "Challenge specific line items with evidence", "Accept it if it's in Xactimate", "Ignore pricing discrepancies"], correct_answer=1),
                QuizQuestion(question="Supplement line items must be:", options=["Generously estimated for negotiation room", "Defensible with evidence for each item", "Higher than the carrier's items", "Based on your best guess"], correct_answer=1)
            ]
        ),

        # --- Advanced-Elite 7: Elite Negotiation ---
        Course(
            title="Elite Negotiation: Closing Complex Claims",
            description="When standard processes fail, elite negotiation skills close complex claims. Strategy, timing, and leverage mastery.",
            category="Negotiation",
            track="advanced-elite",
            difficulty=5,
            est_minutes=40,
            tags=["negotiation", "complex claims", "strategy", "leverage", "closing"],
            why_this_matters="Complex claims require more than good documentation. They require strategic negotiation that understands leverage, timing, and the carrier's decision calculus.",
            outcomes=["Assess leverage position before entering negotiation", "Time negotiation moves for maximum impact", "Close complex claims using the carrier's own decision calculus"],
            lessons=[
                Lesson(
                    title="Leverage Assessment",
                    description="Understanding your position before you negotiate",
                    content="""# Leverage Assessment

Never negotiate without knowing your leverage position.

## Leverage Factors (Yours)
- File strength (evidence quality and completeness)
- Policy language (coverage clarity)
- Escalation readiness (DOI complaint, appraisal, litigation)
- Time investment (the carrier has already spent resources)
- Pattern documentation (bad faith indicators)

## Leverage Factors (Theirs)
- Authority to pay (or need for escalation)
- Reserve pressure (budget constraints)
- Regulatory exposure (DOI complaint potential)
- Litigation risk (cost of fighting vs. paying)
- Case law position (how courts rule on this issue)

## The Assessment
Before negotiating, honestly assess: Is my file strong enough? Is my position supported by policy language? What are my alternatives if negotiation fails?""",
                    duration_minutes=14,
                    order=1,
                    teaching_beats=["Assess leverage before negotiating — never negotiate blind", "Your leverage: file strength, policy language, escalation readiness, pattern documentation", "Their pressure: authority limits, reserves, regulatory exposure, litigation risk"],
                    carrier_move="Negotiate when your file is weak and your leverage is low",
                    our_move="Assess leverage first. Strengthen the file if leverage is insufficient before negotiating.",
                    completion_criteria="Can perform a leverage assessment for both sides of a complex claim"
                ),
                Lesson(
                    title="Timing and Sequencing",
                    description="When to push, when to wait, when to escalate",
                    content="""# Timing and Sequencing

Negotiation timing is as important as negotiation content.

## When to Push
- File is complete and strong
- Deadline is approaching (regulatory or policy)
- Carrier has made a concession (momentum)
- New evidence strengthens your position

## When to Wait
- File has gaps that need filling
- Carrier is reviewing new evidence (let them process)
- Emotional temperature is high (cool down first)
- Better timing is predictable (end of quarter, before regulatory review)

## When to Escalate
- Negotiation has stalled despite strong file
- Carrier is negotiating in bad faith (documented)
- Deadlines have passed without adequate response
- The cost of continued negotiation exceeds escalation cost

## The Sequence
Present → Deadline → Follow-up → Management → DOI/Appraisal. Never skip steps.""",
                    duration_minutes=13,
                    order=2,
                    teaching_beats=["Push when the file is strong, wait when it has gaps, escalate when negotiation fails", "Timing factors: deadlines, momentum, evidence, emotional temperature", "Follow the sequence — never skip escalation steps"],
                    carrier_move="Negotiate when your timing is wrong (file incomplete, emotions high)",
                    our_move="Control timing. Negotiate from strength. Wait strategically when needed.",
                    completion_criteria="Can evaluate timing and recommend push/wait/escalate for 3 scenarios"
                ),
                Lesson(
                    title="Closing the Complex Claim",
                    description="Using the carrier's decision calculus against them",
                    content="""# Closing the Complex Claim

The carrier's decision calculus: cost of paying vs. cost of fighting. Make paying the obvious choice.

## The Closing Framework
1. **Present the total** — Full documented claim with every line item supported
2. **Show the alternative** — If not resolved: appraisal, DOI complaint, litigation
3. **Make it easy** — Clear settlement amount, single decision required
4. **Set the deadline** — Specific date for response

## The Psychology
Carriers want to close files. Open claims cost money to manage. When you present a well-documented, reasonable demand with a clear deadline and stated alternative, you align with their desire to close — but on your terms.

## The Rule
Never bluff. Every stated alternative must be real. Your credibility is your most valuable asset across all claims, not just this one.""",
                    duration_minutes=13,
                    order=3,
                    teaching_beats=["Closing framework: present total, show alternative, make it easy, set deadline", "Align with the carrier's desire to close files — but on your terms", "Never bluff. Credibility is your most valuable long-term asset."],
                    carrier_move="Delay final decision hoping you'll accept a lower amount out of fatigue",
                    our_move="Present a clear, documented demand with a deadline and a real alternative",
                    completion_criteria="Can execute the 4-step closing framework on a complex claim"
                )
            ],
            quiz=[
                QuizQuestion(question="Before negotiating, you must:", options=["Accept the carrier's first offer", "Assess your leverage position honestly", "Threaten litigation immediately", "Wait for the carrier to initiate"], correct_answer=1),
                QuizQuestion(question="You should escalate when:", options=["You feel frustrated", "Negotiation has stalled despite a strong, documented file", "The first offer is low", "Always — skip negotiation entirely"], correct_answer=1),
                QuizQuestion(question="The closing framework includes:", options=["Threats and ultimatums", "Present total, show alternative, make it easy, set deadline", "Accept whatever is offered", "Bluffing about litigation"], correct_answer=1)
            ]
        ),

        # --- Advanced-Elite 8: Training Outcomes ---
        Course(
            title="Training Outcomes Mastery",
            description="The final course. Integrate everything you've learned into a unified operating framework. Leave knowing HOW to win claims, not just what to know.",
            category="Claims Fundamentals",
            track="advanced-elite",
            difficulty=5,
            est_minutes=40,
            tags=["integration", "training outcomes", "mastery", "operating framework"],
            why_this_matters="Knowledge without application is academic. This course integrates every doctrine principle into a unified framework you can execute on any claim, any carrier, any situation.",
            outcomes=["Execute the complete doctrine framework on any claim", "Self-assess performance against doctrine standards", "Train and mentor others using the doctrine methodology"],
            lessons=[
                Lesson(
                    title="The Unified Framework",
                    description="Integrating all doctrine principles",
                    content="""# The Unified Framework

Every doctrine principle connects. Here's how they work together.

## The Claim Lifecycle (Doctrine Applied)
1. **Day 1**: Core Promise → Document pre-loss condition → Begin evidence hierarchy (Tier 1 first)
2. **Week 1**: Structure the file → Scope with discipline → Set communication standards
3. **Ongoing**: Supplement strategy → Track everything → Maintain professional posture
4. **If needed**: Escalation ladder → Dispute resolution → Negotiation
5. **Always**: Pattern recognition → Evidence-based decisions → Deadline accountability

## The Integration
No principle stands alone. Documentation supports supplements. Communication standards enable escalation. Evidence hierarchy drives negotiation leverage. It's one system.""",
                    duration_minutes=14,
                    order=1,
                    teaching_beats=["The doctrine is one integrated system, not separate topics", "Claim lifecycle: document → structure → supplement → escalate → resolve", "Every principle supports every other principle"],
                    carrier_move="Exploit adjusters who know individual tactics but can't execute the full system",
                    our_move="Execute the complete integrated framework from Day 1 through resolution",
                    completion_criteria="Can map the complete doctrine framework to a claim lifecycle"
                ),
                Lesson(
                    title="Self-Assessment Standards",
                    description="Measuring your own performance",
                    content="""# Self-Assessment Standards

After every claim, evaluate your performance against doctrine standards.

## The Review Questions
1. Did I establish pre-loss condition with Tier 1 evidence?
2. Was my scope defensible — every line item supported?
3. Did I maintain written communication with deadlines?
4. Did I follow the escalation ladder (not skip levels)?
5. Did I track supplements and maintain the running scorecard?
6. Did I maintain professional posture throughout?
7. Was my file strong enough to win at appraisal without me present?

## Honest Assessment
If any answer is "no," identify what to do differently next time. The doctrine is a discipline — it requires honest self-evaluation and continuous improvement.

## The Standard
A doctrine-compliant claim file should be transferable: any competent adjuster should be able to pick up your file and understand the claim, the position, and the next steps.""",
                    duration_minutes=13,
                    order=2,
                    teaching_beats=["7 self-assessment questions after every claim", "Honest self-evaluation drives continuous improvement", "The transferability standard: any adjuster should be able to pick up your file"],
                    carrier_move="Depend on adjusters who don't self-assess and repeat the same mistakes",
                    our_move="Self-assess after every claim. Improve continuously. Raise the standard.",
                    completion_criteria="Can perform a 7-point self-assessment on a completed claim"
                ),
                Lesson(
                    title="Teaching the Doctrine",
                    description="Becoming a force multiplier",
                    content="""# Teaching the Doctrine

The final outcome: you don't just execute the doctrine — you teach it.

## The Multiplier Effect
One adjuster executing the doctrine wins their claims. One adjuster TEACHING the doctrine wins the team's claims.

## How to Teach
- Lead by example — let your files demonstrate the standard
- Share the frameworks — evidence hierarchy, escalation ladder, rebuttal framework
- Debrief claims — what worked, what didn't, what to improve
- Hold the standard — don't accept sloppy work from yourself or your team

## The Doctrine Promise
Every member of the team should be able to:
1. Build a file that wins at appraisal
2. Write a supplement that gets paid
3. Set deadlines that create accountability
4. Escalate with documentation, not emotion
5. Close claims using leverage and structure

When you can teach all five, you have mastered the doctrine.""",
                    duration_minutes=13,
                    order=3,
                    teaching_beats=["Mastery = ability to teach the doctrine to others", "Lead by example, share frameworks, debrief claims, hold the standard", "Five capabilities every team member should have"],
                    carrier_move="Count on untrained, inconsistent adjusters who make easy targets",
                    our_move="Build a team where every member executes the doctrine. Eliminate easy targets.",
                    completion_criteria="Can teach the 5 core doctrine capabilities to a new adjuster"
                )
            ],
            quiz=[
                QuizQuestion(question="The doctrine is:", options=["A collection of separate tactics", "One integrated system where every principle supports every other", "Only for experienced adjusters", "Optional for simple claims"], correct_answer=1),
                QuizQuestion(question="The transferability standard means:", options=["You transfer claims to other adjusters", "Any competent adjuster can pick up your file and understand it", "You transfer to a different company", "Files should be deleted after claims close"], correct_answer=1),
                QuizQuestion(question="Doctrine mastery is demonstrated by:", options=["Passing this quiz", "Ability to teach the 5 core capabilities to others", "10 years of experience", "Memorizing statute numbers"], correct_answer=1)
            ]
        )
    ]

    # Insert all courses
    all_courses = foundation_courses + operator_courses + advanced_elite_courses
    for course in all_courses:
        await db.courses.insert_one(course.dict())
    
    # ========== ARTICLES ==========
    
    articles = [
        Article(
            title="The Myth of the 'Fair' Adjuster",
            description="Understanding the structural reality of carrier claims handling.",
            category="industry",
            tags=["carrier behavior", "strategy", "fundamentals"],
            content="""# The Myth of the 'Fair' Adjuster

Many policyholders believe that if they just get a "good" adjuster, they'll receive fair treatment. This misunderstands the system.

## The Structural Reality

Carrier adjusters are employees. They have:
- Performance metrics tied to loss ratios
- Supervisors reviewing their indemnity payments
- Software that flags "high" estimates
- Training focused on finding coverage limitations

This isn't a conspiracy. It's a business model.

## The "Fair" Adjuster Problem

Even well-intentioned adjusters work within constraints:
- They can't pay more than their authority allows
- They face internal pushback on large claims
- Their job security depends on managing loss costs
- They use carrier-provided pricing that may be below market

## What This Means For You

### Don't Rely on the Adjuster's Goodwill
- Document as if they're adversarial
- Verify every statement against policy language
- Get independent estimates
- Follow up in writing

### Don't Take It Personally
The adjuster's behavior reflects their position, not necessarily their character. Understanding this keeps you focused on strategy, not emotion.

### Do Build Your Own Case
- Your file should support your position independently
- Expert opinions from YOUR experts, not just theirs
- Documentation that would persuade a neutral third party

## The Bottom Line

The carrier will pay what the evidence compels and leverage requires—not what's "fair" in some abstract sense. Build your case accordingly.

The best adjusters still work for the carrier. Never forget that."""
        ),
        Article(
            title="Why Carriers Delay (And What To Do About It)",
            description="Time is money—usually the carrier's. Understanding delay tactics.",
            category="industry",
            tags=["delay tactics", "strategy", "timeline"],
            content="""# Why Carriers Delay (And What To Do About It)

Delay is a tactic, not an accident. Understanding why carriers delay helps you counter it.

## The Economics of Delay

### For the Carrier
- Keeps money in reserve (earning interest)
- Tests policyholder's resolve
- Increases chance of reduced settlement
- Exploits financial pressure on policyholder

### For You
- Continued temporary repairs
- Ongoing additional damage risk
- Lost use of property
- Financial and emotional stress

## Common Delay Tactics

### The Documentation Loop
"We need more documentation." You provide it. "We need different documentation." Repeat.

**Counter:** Ask specifically what's needed in writing. Provide it with delivery confirmation. Set deadlines. Document the loop.

### The Re-Inspection Carousel
Multiple inspections, each with new adjusters, each requiring scheduling and time.

**Counter:** Attend every inspection. Get commitment in writing on what this inspection will resolve. Follow up in writing afterward.

### The Expert Review Black Hole
"Our engineer is reviewing." Weeks pass. "Our engineer needs more time."

**Counter:** Request timeline commitments. Ask for copy of expert report. Consider getting your own expert.

### The Authority Excuse
"I need to get authorization for that amount." Then silence.

**Counter:** Get name and contact for supervisor. Follow up directly. Document the chain.

## Your Countermeasures

### Know Your State's Laws
Many states have prompt payment statutes. Know the timelines. Reference them in correspondence.

### Create Written Records
Phone calls buy time. Written communication creates accountability.

### Set Deadlines
"Please respond by [date] with payment or written explanation."

### Document the Pattern
Every delay becomes evidence of bad faith if a pattern emerges.

### Consider Escalation
Department of Insurance complaints, appraisal demands, or legal consultation may be warranted.

## The Meta-Strategy

Delay works when policyholders exhaust or accept less out of frustration. Your job is to make delay costly for the carrier—through documentation, escalation, and persistence.

Make them understand: this claim isn't going away."""
        ),
        Article(
            title="Understanding the Appraisal Clause",
            description="A powerful tool for resolving amount disputes—if used correctly.",
            category="industry",
            tags=["appraisal", "dispute resolution", "strategy"],
            content="""# Understanding the Appraisal Clause

Most property policies contain an appraisal clause. It's a contractual mechanism for resolving disputes about the AMOUNT of loss—not whether coverage exists.

## How Appraisal Works

### The Process
1. Either party demands appraisal in writing
2. Each party selects their appraiser (within specified timeframe)
3. Appraisers attempt to agree on loss amount
4. If they can't agree, they select an umpire
5. Agreement of any two (appraiser + appraiser, or appraiser + umpire) sets the loss amount

### The Result
The appraisal award is typically binding on the question of amount. The carrier then applies coverage and deductible.

## When to Invoke Appraisal

### Good Candidates
- Clear coverage, disputed amount
- Significant difference between your estimate and carrier's
- Negotiations have stalled
- Carrier is using lowball pricing
- You have strong documentation supporting your figures

### Poor Candidates
- Coverage is disputed (appraisal usually can't address this)
- Difference is minor (may not justify costs)
- You lack documentation to support your position
- Bad faith issues exist that require litigation discovery

## Appraisal Strategy

### Selecting Your Appraiser
- Experience with your claim type
- Knowledge of local repair costs
- Understanding of proper methodology
- Not just an advocate—someone who will be credible to the umpire

### The Umpire Selection
This is critical. The umpire often decides the outcome.
- Review candidates carefully
- Look for neutral parties without carrier bias
- Consider retired adjusters, contractors, or engineers

### Documentation for Appraisal
Your appraiser needs:
- Complete damage documentation
- Detailed estimate with methodology
- Expert reports supporting your position
- Response to carrier's objections

## Costs and Considerations

### You Pay
- Your appraiser's fee
- Half the umpire's fee
- Any experts you engage

### Potential Recovery
Appraisal awards often significantly exceed carrier estimates. On substantial claims, the recovery typically far exceeds costs.

## Limitations

### What Appraisal Can't Do
- Determine if coverage exists
- Award bad faith damages
- Interpret policy language
- Force carrier to act in good faith going forward

### Reserving Rights
Carriers sometimes accept appraisal while "reserving" coverage issues. Understand what you're agreeing to.

## The Bottom Line

Appraisal is a powerful tool when used appropriately. It's faster and cheaper than litigation for amount disputes. But it's not a magic solution—it requires preparation and the right circumstances."""
        )
    ]
    
    for article in articles:
        await db.articles.insert_one(article.dict())
    
    logger.info("Care Claims University data seeded successfully")


