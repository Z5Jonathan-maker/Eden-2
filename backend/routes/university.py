from fastapi import APIRouter, HTTPException, Depends, Query
from dependencies import db, get_current_active_user
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/university", tags=["university"])

# Models
class QuizQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    options: List[str]
    correct_answer: int

class Lesson(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    content: str
    video_url: Optional[str] = None
    duration_minutes: int = 10
    order: int = 0

class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    thumbnail: Optional[str] = None
    lessons: List[Lesson] = []
    quiz: List[QuizQuestion] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_published: bool = True

class Article(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    content: str
    category: str
    tags: List[str] = []
    author: str = "Care Claims University"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_published: bool = True

class UserProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    course_id: str
    completed_lessons: List[str] = []
    quiz_score: Optional[int] = None
    quiz_passed: bool = False
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class Certificate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    course_id: str
    course_title: str
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuizSubmission(BaseModel):
    course_id: str
    answers: List[int]

class LessonComplete(BaseModel):
    course_id: str
    lesson_id: str


async def seed_university_data():
    """Seed Care Claims University courses - homeowner-focused, leverage-based claims education"""
    
    # Clear existing data to refresh with new content
    await db.courses.delete_many({})
    await db.articles.delete_many({})
    
    # ========== CORE TRAINING COURSES ==========
    
    training_courses = [
        Course(
            title="Understanding Carrier Tactics",
            description="Learn to identify and counter the common tactics carriers use to underpay or deny legitimate claims. Knowledge is leverage.",
            category="training",
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
            category="training",
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
            category="training",
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
        )
    ]
    
    # ========== ADVANCED COURSES ==========
    
    advanced_courses = [
        Course(
            title="Bad Faith Recognition & Escalation",
            description="Know when carrier behavior crosses the line—and what to do about it.",
            category="advanced",
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
        )
    ]
    
    # Insert all courses
    all_courses = training_courses + advanced_courses
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


# ========== ROUTES ==========

@router.get("/courses")
async def get_courses(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    query = {"is_published": True}
    if category:
        query["category"] = category
    
    courses = await db.courses.find(query, {"_id": 0}).to_list(100)
    
    for course in courses:
        progress = await db.user_progress.find_one(
            {"user_id": current_user["id"], "course_id": course["id"]},
            {"_id": 0}
        )
        course["user_progress"] = progress
    
    return courses

@router.get("/courses/{course_id}")
async def get_course(course_id: str, current_user: dict = Depends(get_current_active_user)):
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    progress = await db.user_progress.find_one(
        {"user_id": current_user["id"], "course_id": course_id},
        {"_id": 0}
    )
    course["user_progress"] = progress
    return course

@router.get("/articles")
async def get_articles(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    query = {"is_published": True}
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    
    articles = await db.articles.find(query, {"_id": 0}).to_list(100)
    return articles

@router.get("/articles/{article_id}")
async def get_article(article_id: str, current_user: dict = Depends(get_current_active_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article

@router.get("/search")
async def search_content(q: str = Query(..., min_length=2), current_user: dict = Depends(get_current_active_user)):
    search_regex = {"$regex": q, "$options": "i"}
    
    courses = await db.courses.find(
        {"$or": [{"title": search_regex}, {"description": search_regex}], "is_published": True},
        {"_id": 0, "lessons": 0, "quiz": 0}
    ).to_list(20)
    
    articles = await db.articles.find(
        {"$or": [{"title": search_regex}, {"description": search_regex}, {"content": search_regex}, {"tags": search_regex}], "is_published": True},
        {"_id": 0, "content": 0}
    ).to_list(20)
    
    return {"courses": courses, "articles": articles, "total": len(courses) + len(articles)}

@router.post("/progress/lesson")
async def complete_lesson(data: LessonComplete, current_user: dict = Depends(get_current_active_user)):
    progress = await db.user_progress.find_one({"user_id": current_user["id"], "course_id": data.course_id})
    
    if not progress:
        progress = UserProgress(user_id=current_user["id"], course_id=data.course_id, completed_lessons=[data.lesson_id]).dict()
        await db.user_progress.insert_one(progress)
    else:
        if data.lesson_id not in progress.get("completed_lessons", []):
            await db.user_progress.update_one(
                {"user_id": current_user["id"], "course_id": data.course_id},
                {"$push": {"completed_lessons": data.lesson_id}}
            )
    
    course = await db.courses.find_one({"id": data.course_id})
    if course:
        total_lessons = len(course.get("lessons", []))
        updated_progress = await db.user_progress.find_one({"user_id": current_user["id"], "course_id": data.course_id})
        completed_count = len(updated_progress.get("completed_lessons", []))
        return {"success": True, "completed_lessons": completed_count, "total_lessons": total_lessons, "course_complete": completed_count >= total_lessons}
    
    return {"success": True}

@router.post("/quiz/submit")
async def submit_quiz(submission: QuizSubmission, current_user: dict = Depends(get_current_active_user)):
    from incentives_engine.events import emit_university_event
    
    course = await db.courses.find_one({"id": submission.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    quiz = course.get("quiz", [])
    if not quiz:
        raise HTTPException(status_code=400, detail="This course has no quiz")
    
    correct = 0
    total = len(quiz)
    
    for i, question in enumerate(quiz):
        if i < len(submission.answers) and submission.answers[i] == question["correct_answer"]:
            correct += 1
    
    score = int((correct / total) * 100)
    passed = score >= 70
    
    await db.user_progress.update_one(
        {"user_id": current_user["id"], "course_id": submission.course_id},
        {"$set": {"quiz_score": score, "quiz_passed": passed, "completed_at": datetime.now(timezone.utc).isoformat() if passed else None}},
        upsert=True
    )
    
    certificate = None
    if passed:
        existing_cert = await db.certificates.find_one({"user_id": current_user["id"], "course_id": submission.course_id})
        if not existing_cert:
            certificate = Certificate(
                user_id=current_user["id"],
                user_name=current_user.get("full_name", "User"),
                course_id=submission.course_id,
                course_title=course["title"]
            )
            await db.certificates.insert_one(certificate.dict())
            certificate = certificate.dict()
            
            # Emit game event for course completion
            try:
                await emit_university_event(
                    db=db,
                    user_id=current_user["id"],
                    event_type="university.course_completed",
                    course_id=submission.course_id,
                    progress_percent=100
                )
                logger.info(f"University course completion event emitted for user {current_user['id']}, course {submission.course_id}")
            except Exception as e:
                logger.error(f"Failed to emit university course completion event: {e}")
                # Don't fail the request if event emission fails
    
    return {"score": score, "correct": correct, "total": total, "passed": passed, "certificate": certificate}

@router.get("/progress")
async def get_user_progress(current_user: dict = Depends(get_current_active_user)):
    progress = await db.user_progress.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return progress

@router.get("/certificates")
async def get_certificates(current_user: dict = Depends(get_current_active_user)):
    certificates = await db.certificates.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return certificates

@router.get("/certificates/{certificate_id}")
async def get_certificate(certificate_id: str, current_user: dict = Depends(get_current_active_user)):
    certificate = await db.certificates.find_one({"id": certificate_id, "user_id": current_user["id"]}, {"_id": 0})
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return certificate

@router.get("/stats")
async def get_university_stats(current_user: dict = Depends(get_current_active_user)):
    completed_courses = await db.user_progress.count_documents({"user_id": current_user["id"], "quiz_passed": True})
    certificates = await db.certificates.count_documents({"user_id": current_user["id"]})
    in_progress = await db.user_progress.count_documents({"user_id": current_user["id"], "quiz_passed": {"$ne": True}})
    total_courses = await db.courses.count_documents({"is_published": True})
    
    return {"completed_courses": completed_courses, "in_progress": in_progress, "certificates": certificates, "total_courses": total_courses}

# Approved YouTube Content Sources
APPROVED_VIDEO_SOURCES = [
    {
        "id": "john_senac",
        "name": "John Senac",
        "category": "primary",
        "description": "Carrier behavior analysis, delay tactics, leverage strategy, real-world claim psychology.",
        "search_terms": ["John Senac insurance claims", "John Senac public adjuster", "John Senac moving goalposts", "John Senac carrier tactics"],
        "topics": ["carrier_tactics", "leverage", "psychology"],
        "trust_level": "high"
    },
    {
        "id": "listen_to_this_bull",
        "name": "Matthew Mullohand - Listen To This Bull",
        "category": "primary",
        "description": "No fluff, practical claim handling, straight talk that matches homeowner advocacy.",
        "search_terms": ["Listen To This Bull insurance", "Matthew Mullohand insurance claims", "Listen To This Bull public adjuster", "Mullohand insurance podcast clips"],
        "topics": ["practical", "field_tested", "no_nonsense"],
        "trust_level": "high"
    },
    {
        "id": "vince_perri",
        "name": "Vince Perri",
        "category": "primary",
        "description": "Concise, execution-focused, zero hype. Great for tactical learning.",
        "search_terms": ["Vince Perri public adjuster", "Vince Perri insurance claims", "Vince Perri adjusting tips", "Vince Perri claims handling"],
        "topics": ["execution", "tactical", "concise"],
        "trust_level": "high"
    },
    {
        "id": "merlin_law",
        "name": "Merlin Law Group / Chip Merlin",
        "category": "primary",
        "description": "Policy interpretation, bad faith principles, legal grounding without carrier spin.",
        "search_terms": ["Merlin Law Group insurance claims", "Chip Merlin insurance law", "Merlin Law bad faith insurance", "Merlin Law property insurance"],
        "topics": ["policy", "bad_faith", "legal"],
        "trust_level": "high"
    },
    {
        "id": "parrot_key",
        "name": "Parrot Key",
        "category": "secondary",
        "description": "Good supplemental education - useful when filtered through Care Claims doctrine.",
        "search_terms": ["Parrot Key insurance claims", "Parrot Key public adjuster", "Parrot Key insurance education"],
        "topics": ["education", "supplemental"],
        "trust_level": "medium"
    }
]

VIDEO_PLAYLISTS = [
    {"id": "carrier_tactics", "name": "Understanding Carrier Tactics", "description": "Learn to recognize and counter carrier delay tactics.", "sources": ["john_senac", "listen_to_this_bull"], "search_query": "insurance carrier tactics delay deny"},
    {"id": "supplements", "name": "Supplement Strategy", "description": "Master the supplement process.", "sources": ["vince_perri", "listen_to_this_bull"], "search_query": "insurance supplement claim"},
    {"id": "bad_faith", "name": "Bad Faith Recognition", "description": "Identify bad faith indicators.", "sources": ["merlin_law", "john_senac"], "search_query": "insurance bad faith"},
    {"id": "policy_interpretation", "name": "Policy Language", "description": "Understand coverage triggers and exclusions.", "sources": ["merlin_law"], "search_query": "insurance policy interpretation"},
    {"id": "florida_specific", "name": "Florida Claims", "description": "Florida-specific regulations and hurricane claims.", "sources": ["merlin_law", "vince_perri"], "search_query": "Florida insurance claims"}
]

@router.get("/video-sources")
async def get_approved_video_sources(current_user: dict = Depends(get_current_active_user)):
    return {"sources": APPROVED_VIDEO_SOURCES, "playlists": VIDEO_PLAYLISTS}

@router.get("/video-sources/{source_id}")
async def get_video_source(source_id: str, current_user: dict = Depends(get_current_active_user)):
    for source in APPROVED_VIDEO_SOURCES:
        if source["id"] == source_id:
            return source
    raise HTTPException(status_code=404, detail="Source not found")

@router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: str, current_user: dict = Depends(get_current_active_user)):
    for playlist in VIDEO_PLAYLISTS:
        if playlist["id"] == playlist_id:
            return playlist
    raise HTTPException(status_code=404, detail="Playlist not found")



# ========== CUSTOM CONTENT MANAGEMENT (Firm-Specific) ==========

class CustomCourseCreate(BaseModel):
    title: str
    description: str
    category: str = "custom"
    thumbnail: Optional[str] = None
    lessons: List[Lesson] = []
    is_published: bool = False

class CustomArticleCreate(BaseModel):
    title: str
    description: str
    content: str
    category: str = "custom"
    tags: List[str] = []
    is_published: bool = False

class CustomDocumentCreate(BaseModel):
    title: str
    description: str
    doc_type: str  # "sop", "strategy", "template", "policy", "other"
    content: str
    tags: List[str] = []
    is_published: bool = False

class CustomDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    doc_type: str
    content: str
    tags: List[str] = []
    author_id: str = ""
    author_name: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_published: bool = False
    is_custom: bool = True


@router.post("/custom/courses")
async def create_custom_course(
    course_data: CustomCourseCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a custom firm-specific course (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can create custom content")
    
    course = Course(
        title=course_data.title,
        description=course_data.description,
        category=course_data.category,
        thumbnail=course_data.thumbnail,
        lessons=course_data.lessons,
        is_published=course_data.is_published
    )
    
    course_dict = course.model_dump()
    course_dict["is_custom"] = True
    course_dict["created_by"] = current_user.get("email", "unknown")
    course_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.courses.insert_one(course_dict)
    
    return {"id": course.id, "message": "Custom course created successfully"}


@router.put("/custom/courses/{course_id}")
async def update_custom_course(
    course_id: str,
    course_data: CustomCourseCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a custom course (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can edit custom content")
    
    existing = await db.courses.find_one({"id": course_id, "is_custom": True})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom course not found")
    
    update_data = course_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")
    
    await db.courses.update_one({"id": course_id}, {"$set": update_data})
    return {"message": "Course updated successfully"}


@router.delete("/custom/courses/{course_id}")
async def delete_custom_course(
    course_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a custom course (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete custom content")
    
    result = await db.courses.delete_one({"id": course_id, "is_custom": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom course not found")
    
    return {"message": "Course deleted successfully"}


@router.post("/custom/articles")
async def create_custom_article(
    article_data: CustomArticleCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a custom firm-specific article (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can create custom content")
    
    article = Article(
        title=article_data.title,
        description=article_data.description,
        content=article_data.content,
        category=article_data.category,
        tags=article_data.tags,
        author=current_user.get("name", current_user.get("email", "Unknown")),
        is_published=article_data.is_published
    )
    
    article_dict = article.model_dump()
    article_dict["is_custom"] = True
    article_dict["created_by"] = current_user.get("email", "unknown")
    article_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.articles.insert_one(article_dict)
    
    return {"id": article.id, "message": "Custom article created successfully"}


@router.put("/custom/articles/{article_id}")
async def update_custom_article(
    article_id: str,
    article_data: CustomArticleCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a custom article (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can edit custom content")
    
    existing = await db.articles.find_one({"id": article_id, "is_custom": True})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom article not found")
    
    update_data = article_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")
    
    await db.articles.update_one({"id": article_id}, {"$set": update_data})
    return {"message": "Article updated successfully"}


@router.delete("/custom/articles/{article_id}")
async def delete_custom_article(
    article_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a custom article (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete custom content")
    
    result = await db.articles.delete_one({"id": article_id, "is_custom": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom article not found")
    
    return {"message": "Article deleted successfully"}


@router.post("/custom/documents")
async def create_custom_document(
    doc_data: CustomDocumentCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a custom document (SOP, strategy, template, etc.)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can create custom content")
    
    doc = CustomDocument(
        title=doc_data.title,
        description=doc_data.description,
        doc_type=doc_data.doc_type,
        content=doc_data.content,
        tags=doc_data.tags,
        author_id=current_user.get("id", ""),
        author_name=current_user.get("name", current_user.get("email", "Unknown")),
        is_published=doc_data.is_published
    )
    
    doc_dict = doc.model_dump()
    doc_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.custom_documents.insert_one(doc_dict)
    
    return {"id": doc.id, "message": "Document created successfully"}


@router.get("/custom/documents")
async def get_custom_documents(
    doc_type: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all custom documents"""
    query = {}
    if doc_type:
        query["doc_type"] = doc_type
    
    # Non-admin users only see published documents
    if current_user.get("role") not in ["admin", "manager"]:
        query["is_published"] = True
    
    docs = await db.custom_documents.find(query, {"_id": 0}).to_list(100)
    return docs


@router.get("/custom/documents/{doc_id}")
async def get_custom_document(
    doc_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific custom document"""
    doc = await db.custom_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Non-admin users can only see published documents
    if current_user.get("role") not in ["admin", "manager"] and not doc.get("is_published"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return doc


@router.put("/custom/documents/{doc_id}")
async def update_custom_document(
    doc_id: str,
    doc_data: CustomDocumentCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a custom document"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can edit custom content")
    
    existing = await db.custom_documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = doc_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")
    
    await db.custom_documents.update_one({"id": doc_id}, {"$set": update_data})
    return {"message": "Document updated successfully"}


@router.delete("/custom/documents/{doc_id}")
async def delete_custom_document(
    doc_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a custom document (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
    
    result = await db.custom_documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}


@router.get("/custom/all")
async def get_all_custom_content(current_user: dict = Depends(get_current_active_user)):
    """Get all custom content for the firm"""
    is_admin = current_user.get("role") in ["admin", "manager"]
    
    # Build query based on role
    published_query = {} if is_admin else {"is_published": True}
    custom_query = {"is_custom": True, **published_query}
    
    courses = await db.courses.find(custom_query, {"_id": 0}).to_list(100)
    articles = await db.articles.find(custom_query, {"_id": 0}).to_list(100)
    documents = await db.custom_documents.find(published_query, {"_id": 0}).to_list(100)
    
    return {
        "courses": courses,
        "articles": articles,
        "documents": documents,
        "totals": {
            "courses": len(courses),
            "articles": len(articles),
            "documents": len(documents)
        }
    }
