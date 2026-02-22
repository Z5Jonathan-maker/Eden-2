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
    correct_answer: int  # index into options for multiple_choice / true_false
    question_type: str = "multiple_choice"  # multiple_choice | true_false | scenario
    explanation: Optional[str] = None  # shown after answering
    scenario_context: Optional[str] = None  # background context for scenario questions

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
                    correct_answer=1,
                    explanation="Initial carrier estimates are routinely 30-60% below actual costs. Always get independent estimates and document everything before responding."
                ),
                QuizQuestion(
                    question="Why do carriers request repeated re-inspections?",
                    options=["They genuinely want to help", "Each inspection resets timelines and tests your resolve", "It's required by law", "To provide better service"],
                    correct_answer=1,
                    explanation="Re-inspections are a delay tactic. Each one resets the clock, giving the carrier more time while testing whether you'll give up."
                ),
                QuizQuestion(
                    question="The carrier's adjuster works for:",
                    options=["You, the policyholder", "The state insurance department", "The carrier—period", "Both parties equally"],
                    correct_answer=2,
                    explanation="No matter how friendly, the adjuster is employed by the carrier. Their performance metrics are tied to controlling payouts."
                ),
                QuizQuestion(
                    question="True or False: A carrier's 'friendly' adjuster means you will receive fair payment.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Charm is a tactic. Judge adjusters by their numbers and actions, not their personality. They work within carrier constraints regardless of demeanor."
                ),
                QuizQuestion(
                    question="A carrier adjuster tells your client 'We're still reviewing your claim' after 45 days with no action. What does this likely indicate?",
                    options=["They are conducting a thorough review", "This is a delay tactic—hoping the policyholder gives up or accepts less", "The claim is unusually complex", "The adjuster is new and needs more time"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="Your client filed a roof damage claim 45 days ago. The carrier acknowledged receipt within 14 days but has provided no estimate or inspection date. When your client calls, they're told 'We're still reviewing.'",
                    explanation="Extended 'review' periods with no concrete action are classic delay tactics. Reference your state's prompt payment statutes and send written requests with deadlines."
                ),
                QuizQuestion(
                    question="True or False: If a carrier offers a partial payment, you should always accept it immediately.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Accepting partial payment can complicate your ability to dispute the remainder in some jurisdictions. Review the release language carefully before accepting."
                ),
                QuizQuestion(
                    question="What is the BEST way to document a phone conversation with a carrier adjuster?",
                    options=["Don't bother—phone calls aren't important", "Send a follow-up email summarizing the call with date, time, and key points", "Record the call without telling them", "Just remember the key points"],
                    correct_answer=1,
                    explanation="Always follow up phone calls with written confirmation. This creates an accountable paper trail and prevents 'I never said that' disputes."
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
                    correct_answer=1,
                    explanation="Submit supplements when you can prove the damage exists, it's loss-related, and it wasn't in the original scope. Document during demolition for maximum credibility."
                ),
                QuizQuestion(
                    question="The 'three-trade rule' for O&P means:",
                    options=["You can only claim O&P three times per year", "O&P is only for three-story buildings", "If three or more trades are needed, GC involvement and O&P is typically warranted", "You need three estimates to claim O&P"],
                    correct_answer=2,
                    explanation="When three or more trades (roofing, drywall, painting, etc.) are required, a general contractor's coordination is warranted, justifying the industry-standard 10% overhead + 10% profit."
                ),
                QuizQuestion(
                    question="When a carrier denies a supplement without explanation, you should:",
                    options=["Accept the denial and move on", "Get the denial in writing with specific reasons", "Immediately sue them", "Never submit supplements again"],
                    correct_answer=1,
                    explanation="A written denial with specific reasons becomes your roadmap for disputing. Without specifics, the carrier has no defensible position."
                ),
                QuizQuestion(
                    question="True or False: A supplement is only valid if the carrier's adjuster agrees damage exists.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="False. Supplements are based on documented damage, not carrier agreement. Your photos, expert reports, and contractor statements are the evidence—not the adjuster's opinion."
                ),
                QuizQuestion(
                    question="During a roof tear-off, your contractor discovers rotted decking under 3 squares of shingles. The carrier's original estimate only included shingle replacement. What is the correct supplement approach?",
                    options=["Wait until all repairs are done, then submit everything at once", "Document the decking damage immediately with photos and measurements, then submit a supplement with line-item costs", "Call the adjuster and ask them to come back for another inspection", "Include the decking cost in the original estimate retroactively"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="A residential roof replacement is in progress. The carrier approved shingle replacement for the entire roof. During tear-off, the crew finds 3 squares of badly deteriorated decking that wasn't visible before removal. This is clearly storm-related water intrusion damage.",
                    explanation="Document progressively during demolition. Photos with measurements, explanation of how the damage relates to the covered loss, and line-item costs create a supplement package that's hard to deny."
                ),
                QuizQuestion(
                    question="What does O&P stand for in property claims?",
                    options=["Operations & Planning", "Overhead & Profit", "Owner's & Policyholder's costs", "Original & Present value"],
                    correct_answer=1,
                    explanation="Overhead & Profit represents the general contractor's business costs (overhead) and margin (profit), industry-standard at 10/10 (10% each)."
                ),
                QuizQuestion(
                    question="A carrier says 'The homeowner can coordinate the repairs themselves, so O&P isn't owed.' What is the best response?",
                    options=["Accept their position—they're probably right", "The policy promises to restore the property, not to make the homeowner a general contractor. Coordination is a skilled service with liability implications.", "Threaten to sue immediately", "Ask the homeowner to try coordinating first"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="A claim involves roofing, siding, drywall, painting, and electrical work (5 trades). The carrier has excluded O&P from their estimate, stating the homeowner can coordinate the sub-contractors themselves.",
                    explanation="With 5 trades involved, GC coordination is clearly warranted. The policy covers the cost to repair—which includes professional coordination when multiple trades are needed."
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
                    correct_answer=1,
                    explanation="In most jurisdictions, the policyholder must prove the loss occurred; then the burden shifts to the carrier to prove an exclusion applies."
                ),
                QuizQuestion(
                    question="What is 'recoverable depreciation'?",
                    options=["Depreciation you can never get back", "The withheld amount you can claim after completing repairs", "A tax deduction", "The carrier's profit margin"],
                    correct_answer=1,
                    explanation="On RCV policies, the carrier withholds depreciation initially (paying ACV). After you complete repairs and incur the cost, you can claim the withheld depreciation—but there's usually a time limit."
                ),
                QuizQuestion(
                    question="In a valued policy state with a total loss:",
                    options=["You get whatever the carrier decides", "The carrier must pay the full Coverage A limit", "Depreciation is doubled", "The claim is automatically denied"],
                    correct_answer=1,
                    explanation="Valued policy laws (FL, LA, MS, TX, others) require the carrier to pay the full Coverage A limit on a total loss from a covered peril, regardless of actual value."
                ),
                QuizQuestion(
                    question="True or False: Coverage D (Loss of Use) pays for your hotel, meals, and additional living expenses when your home is uninhabitable.",
                    options=["True", "False"],
                    correct_answer=0,
                    question_type="true_false",
                    explanation="Coverage D covers additional living expenses when the home is uninhabitable due to a covered loss. This includes hotel stays, restaurant meals (above your normal food costs), and other necessary expenses."
                ),
                QuizQuestion(
                    question="What does the doctrine of 'contra proferentem' mean for insurance policies?",
                    options=["The policyholder always wins", "Ambiguous policy language is interpreted against the drafter (the carrier)", "The carrier can rewrite the policy at any time", "Courts cannot interpret policy language"],
                    correct_answer=1,
                    explanation="When policy language is genuinely ambiguous, courts interpret it against the party that drafted it (the carrier). However, judges are skeptical of manufactured ambiguity."
                ),
                QuizQuestion(
                    question="A homeowner's roof was damaged by wind, but the carrier says the damage is 'wear and tear' (excluded). Water is now entering through the damaged area. Which statement is most accurate?",
                    options=["If any part is wear and tear, nothing is covered", "The wind damage and resulting water damage may both be covered even if some aging is present—the key is whether the covered peril caused distinct damage", "Wear and tear always overrides storm damage", "The homeowner should just fix it and not file a claim"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="A 12-year-old roof was hit by a windstorm. The carrier's adjuster notes some granule loss from aging but also clear wind creases and lifted shingles. Water is entering at the lifted shingle locations. The carrier denies the claim citing the 'wear and tear' exclusion.",
                    explanation="Carriers often conflate normal aging with storm damage. The key question is whether the covered peril (wind) caused distinct, identifiable damage separate from normal wear. If so, the exclusion doesn't apply to the storm damage."
                ),
                QuizQuestion(
                    question="True or False: In Florida, carriers are allowed to depreciate labor costs when calculating ACV.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Florida statute specifically prohibits the depreciation of labor costs. Know your state's rules—this can significantly impact claim payments."
                )
            ]
        ),
        Course(
            title="Door-to-Door: Authority-Led Field Canvassing",
            description="The complete field manual for Care Claims door-to-door canvassing. Learn the mindset, scripts, objection handling, and daily rhythm required to knock 75-100 doors per day and sign 3+ claims per week.",
            category="training",
            thumbnail="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400",
            lessons=[
                Lesson(
                    title="The Door Knock Mindset",
                    description="Why authority beats hope at the door",
                    content="""# The Door Knock Mindset

## You Are Not Selling. You Are Notifying.

You are a licensed public adjuster arriving to inform a homeowner that they have storm damage, a filing deadline, and a right to professional representation that costs them nothing out of pocket.

## Authority vs. Hope

Hope: "Hi, sorry to bother you, I was just wondering if maybe you had any damage?"

Authority: "Good afternoon. I'm a licensed public adjuster with Care Claims. The storm on [date] caused significant damage in this neighborhood. I'm doing free inspections today — 15 minutes. Let me take a look at your roof."

## The Three Truths at Every Door

1. **There was a storm.** NOAA data confirms it.
2. **There is a deadline.** Florida statute limits the filing window.
3. **You only get paid if they get paid.** Zero risk to the homeowner.

## Daily Affirmation

> "I am here because the storm was here. I am qualified. I am legally authorized. I knock with certainty."
""",
                    duration_minutes=10,
                    order=1
                ),
                Lesson(
                    title="Pre-Knock Preparation",
                    description="Route planning, storm data, and the 30 minutes that determine your day",
                    content="""# Pre-Knock Preparation

## Your Field Kit

- Company ID badge (visible at all times)
- Storm report printout
- Authorization forms (minimum 10 copies)
- Leave-behind flyers
- Tablet or phone with CRM loaded
- Ladder (in vehicle)

## Time Blocks

- **9:00-11:30 AM** — Block 1 (retirees, WFH)
- **12:30-3:00 PM** — Block 2
- **3:30-6:00 PM** — Block 3 (highest contact rate)

This puts you at 75-100 doors per day.
""",
                    duration_minutes=12,
                    order=2
                ),
                Lesson(
                    title="The Opening 15 Seconds",
                    description="The exact words when the door opens",
                    content="""# The Opening 15 Seconds

## The Primary Script

> "Good afternoon. My name is [First Name], I'm a licensed public adjuster with Care Claims. The storm that came through on [date] caused damage across this neighborhood — a lot of homeowners have roof damage they can't see from the ground. We're doing free inspections today before your filing deadline passes. Takes about 15 minutes. Mind if I take a look?"

What it does:
- **"Licensed public adjuster"** — credential stated
- **"Can't see from the ground"** — education
- **"Filing deadline passes"** — real urgency
- **"Mind if I take a look?"** — transitions to inspection

## Delivery: Stand 4-5 feet from door. Badge visible. No apology in your voice.
""",
                    duration_minutes=10,
                    order=3
                ),
                Lesson(
                    title="The Inspection-First Ask",
                    description="The inspection is the close — everything else is paperwork",
                    content="""# The Inspection-First Ask

## The Inspection IS the Close

When a homeowner lets you inspect, the claim is 80% signed. You are not closing at the kitchen table. You are closing on the roof.

## The Reveal

> "Here's what I found. You've got [X] shingles with wind damage, your ridge cap is lifted in two spots, and there's impact damage on three soffit panels. This is absolutely a claimable event. What I'd like to do is get the paperwork started today."

"What I'd like to do" — not "would you like to file." You are leading.

## If the Roof Is Clean

> "Good news — your roof looks solid. Here's my card."

Integrity is a long-term canvassing strategy.
""",
                    duration_minutes=15,
                    order=4
                ),
                Lesson(
                    title="Handling Objections",
                    description="Word-for-word responses to the five most common objections",
                    content="""# Handling Objections

## "I already have someone handling it."
> "A roofer works for himself. I'm a licensed public adjuster — I work for you. Let me do a free inspection so you have a second set of eyes."

## "My insurance will handle it."
> "Their adjuster works for the carrier, not for you. Their job is to minimize the payout. Mine is to maximize it."

## "I'm not interested."
> "Totally understand. The storm has a filing deadline and most damage isn't visible from the ground. I'll leave my card."

Hand them the card. Move on.

## "Let me think about it."
> "Let me do the inspection now while I'm here. It's free and takes 15 minutes. Right now you're thinking about it with no data — let me get you the data."

## The Three-Second Rule: After your reframe, stop talking. Count to three. Two objections maximum.
""",
                    duration_minutes=15,
                    order=5
                ),
                Lesson(
                    title="The Close and Paperwork",
                    description="Moving from inspection to signed authorization",
                    content="""# The Close and Paperwork

## Assume the Close

> "What I need from you is about five minutes to get the paperwork done. I'll need your full name as it appears on your homeowner's insurance, your policy number if you have it, and a signature."

That is an instruction, not a question.

## Information You Need

1. Full legal name (as on the policy)
2. Property address
3. Insurance carrier name
4. Policy number
5. Date of loss
6. Phone number and email
7. Signature and date

## Setting Expectations

> "I'm filing this claim within 24-48 hours. You don't negotiate with anyone. That's my job."

## Never: Talk past the close, apologize for the fee, leave without complete info.
""",
                    duration_minutes=12,
                    order=6
                ),
                Lesson(
                    title="Reading the Homeowner",
                    description="Body language, interest signals, and when to move on",
                    content="""# Reading the Homeowner

## Green Light (invest up to 20 min)
- They step outside or open the screen door
- They ask questions or look at their roof
- They mention a leak or prior issue

## Yellow Light (3 min max at door)
- Stay behind screen door but keep talking
- "How much does it cost?"
- They look back into the house

## Red Light (10 seconds — card and leave)
- "Not interested" with door closing
- Arms crossed, no eye contact
- "We're renters" / "No soliciting" sign

If you spend 15 min at every red light door, you knock 30 instead of 90.
""",
                    duration_minutes=10,
                    order=7
                ),
                Lesson(
                    title="Daily Rhythm and Route Management",
                    description="How to hit 75-100 doors consistently",
                    content="""# Daily Rhythm and Route Management

## The Math

- 75-100 doors/day → 30-40% contact rate → 20-25% inspection conversion → 60-70% sign rate
- Result: 4-7 inspections/day, 2-5 signs/day → **3 minimum per week**

## Daily Schedule

| Time | Activity |
|------|----------|
| 8:00 AM | Load kit, review route |
| 9:00 AM | First knock — non-negotiable |
| 9:00-11:30 | Block 1 — 30-35 doors |
| 11:30-12:30 | Lunch, log data |
| 12:30-3:00 | Block 2 — 25-30 doors |
| 3:30-6:00 | Block 3 — 20-25 doors + callbacks |
| 6:00-6:30 | Log data, submit daily report |

## CRM Tags: SIGNED / CALLBACK / NO ANSWER / NOT INTERESTED / RENTER

## Non-Negotiables: First knock by 9 AM. 75 doors minimum — the floor, not the ceiling.
""",
                    duration_minutes=12,
                    order=8
                ),
                Lesson(
                    title="Follow-Up and Callback Strategy",
                    description="Converting the 'not yet' into a signed claim",
                    content="""# Follow-Up and Callback Strategy

## The Callback Script

> "Hi [Name], it's [Your Name] with Care Claims — I was out here [day] and took a look at your roof. You've definitely got enough damage to support a claim. Do you have five minutes?"

## Timing Rules

- "Let me talk to my spouse" — revisit within 24 hours
- "Call me next week" — call the exact day they said
- No answer on callback — leave handwritten note on flyer

## Text Template

> "Hi [Name], this is [Name] with Care Claims. Your property has storm damage that qualifies for a claim. The filing deadline is approaching. No cost unless your claim pays."

No emojis. No exclamation points.

## Follow-Up Cadence: Day 0 → Day 1 in person → Day 3 call → Day 5 final text → Day 7+ dormant

Three contacts maximum after the initial knock.
""",
                    duration_minutes=10,
                    order=9
                ),
                Lesson(
                    title="Team Standards and Accountability",
                    description="What Care Claims expects from every field adjuster",
                    content="""# Team Standards and Accountability

## Weekly Minimums

| Metric | Minimum | Strong | Elite |
|--------|---------|--------|-------|
| Doors/day | 75 | 90 | 100+ |
| Signs/week | 3 | 5 | 7+ |
| CRM compliance | 100% | 100% | 100% |

## Professional Conduct

- Company shirt tucked in. Badge visible.
- No profanity. No bashing competitors or carriers.
- No promises about claim amounts.

## Daily Report (by 7 PM): Total doors, contacts, inspections, authorizations, callbacks.

## When You Miss the Standard
- Week 1: coaching conversation
- Week 2: performance plan
- Week 3: the field is not for you

You are a licensed professional. Act like it. Knock like it.
""",
                    duration_minutes=10,
                    order=10
                )
            ],
            quiz=[
                QuizQuestion(
                    question="A homeowner says 'We already had a roofer come out.' Best response?",
                    options=["Tell the homeowner the roofer was probably wrong", "Say 'That's good to hear' and leave", "Explain that a roofer evaluates for repair, but you evaluate for insurance claim eligibility, and offer a free second opinion", "Ask for the roofer's name"],
                    correct_answer=2
                ),
                QuizQuestion(
                    question="It is 10:45 AM and you have knocked 18 doors with zero contacts. What should you do?",
                    options=["Drive to a different area", "Take an early lunch", "Keep knocking — log every no-answer for callback", "Start calling your callback list"],
                    correct_answer=2
                ),
                QuizQuestion(
                    question="A homeowner says 'I'm not interested' before you finish. What do you do?",
                    options=["Restart your script", "Say the storm has a filing deadline, leave your card, and move on", "Ask why they're not interested", "Tell them their neighbors are filing claims"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="You inspect a roof and find zero storm damage. Correct action?",
                    options=["Find minor issues and file anyway", "Tell them the roof is clean, hand your card, and move on", "Suggest they file for interior damage", "Tell them their roof is old"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="During your opening script, what three things must you communicate in 15 seconds?",
                    options=["Name, founding year, phone number", "Storm date, claim estimate, fee structure", "Who you are, why you're here (storm + deadline), what you're offering (free inspection)", "License number, success rate, neighbor count"],
                    correct_answer=2
                ),
                QuizQuestion(
                    question="At 3 minutes per door, how many doors can you knock in a 2.5-hour block?",
                    options=["25 doors", "50 doors", "75 doors", "100 doors"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="A homeowner asks 'How much do you charge?' Correct response?",
                    options=["Avoid the question and redirect", "Tell them the fee is negotiable", "State the contingency fee directly — you only get paid if they get paid", "Tell them it's free"],
                    correct_answer=2
                ),
                QuizQuestion(
                    question="You see a 'No Soliciting' sign. What do you do?",
                    options=["Knock anyway", "Knock but acknowledge the sign", "Respect the sign, leave a flyer without knocking, move on", "Skip entirely with no materials"],
                    correct_answer=2
                ),
                QuizQuestion(
                    question="It is 6:15 PM and you have knocked 72 doors. You're tired. What do you do?",
                    options=["Log 72 and call it a day", "Knock 3 more to hit 75 minimum before ending", "Make up for it tomorrow", "Text your team lead explaining why 72 is acceptable"],
                    correct_answer=1
                ),
                QuizQuestion(
                    question="A homeowner: outside, asking questions, looks at roof, mentions a ceiling stain. Signal?",
                    options=["Yellow light — offer to come back", "Green light — slow down, listen, transition to inspection", "Red light — they're just being polite", "Green light — start paperwork immediately"],
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
                    correct_answer=1,
                    explanation="Bad faith is more than a disagreement. It requires a pattern of conduct that is unreasonable, knowing, or reckless in violating the carrier's duty of good faith and fair dealing."
                ),
                QuizQuestion(
                    question="The appraisal process can resolve disputes about:",
                    options=["Whether coverage exists", "The AMOUNT of loss only", "Bad faith conduct", "All claim issues"],
                    correct_answer=1,
                    explanation="Appraisal is a contractual mechanism for resolving disputes about the AMOUNT of loss only. It cannot determine coverage questions or award bad faith damages."
                ),
                QuizQuestion(
                    question="Before consulting an attorney, you should:",
                    options=["Delete all your documentation", "Have your complete policy, claim file, and correspondence organized", "Accept the carrier's offer", "Stop communicating with the carrier"],
                    correct_answer=1,
                    explanation="An organized file with your complete policy, claim documentation, and correspondence chronology helps the attorney evaluate your case efficiently and develop strategy."
                ),
                QuizQuestion(
                    question="True or False: A single low estimate from the carrier automatically constitutes bad faith.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="A low estimate alone is not bad faith. Bad faith requires a pattern of unreasonable conduct—not just a disagreement on numbers. However, a pattern of systematic undervaluation may indicate bad faith."
                ),
                QuizQuestion(
                    question="A carrier has ignored your client's claim for 60 days. They've sent 3 written follow-ups with no response. The state statute requires acknowledgment within 14 days. What is the BEST next step?",
                    options=["Wait another 30 days", "File a complaint with the state Department of Insurance while continuing to document the delay", "Post about it on social media", "Just hire an attorney immediately without documenting anything"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="Your client filed a water damage claim 60 days ago. The carrier has not acknowledged the claim despite 3 written follow-ups sent via certified mail. Your state requires claim acknowledgment within 14 days of receipt (F.S. 627.70131 in Florida).",
                    explanation="A Department of Insurance complaint creates a regulatory record, may prompt carrier action, and builds your bad faith documentation. Continue documenting while escalating—don't choose only one approach."
                ),
                QuizQuestion(
                    question="Which type of attorney is BEST suited for a bad faith insurance claim?",
                    options=["A general litigator who handles all case types", "A policyholder attorney who specializes in bad faith against carriers", "A criminal defense attorney", "Any attorney with the lowest fees"],
                    correct_answer=1,
                    explanation="Policyholder attorneys who specialize in bad faith understand carrier tactics, policy language, and have track records against specific carriers. Generalists may lack this specialized knowledge."
                ),
                QuizQuestion(
                    question="True or False: Once you hire an attorney, you should continue negotiating directly with the carrier yourself.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Once represented, all communication should go through your attorney. Direct negotiation can undermine your legal strategy and create complications."
                )
            ]
        )
    ]

    # ========== ADDITIONAL COURSES ==========

    additional_courses = [
        Course(
            title="Water Damage Claims Mastery",
            description="From first notice of loss to final payment—master the complexities of water damage claims including categorization, mitigation, and carrier disputes.",
            category="training",
            thumbnail="https://images.unsplash.com/photo-1525438160292-a4a860951216?w=400",
            lessons=[
                Lesson(
                    title="Water Damage Categories & Standards",
                    description="IICRC classifications and why they matter for your claim",
                    content="""# Water Damage Categories & Standards

Understanding water damage classification is critical. The category and class of water damage directly affects the scope of work, required remediation, and claim value.

## IICRC Water Damage Categories

The Institute of Inspection, Cleaning and Restoration Certification (IICRC) S500 standard defines three categories:

### Category 1: Clean Water
Water from a sanitary source that poses no substantial risk.

**Sources:**
- Broken supply lines
- Tub or sink overflow (clean water)
- Appliance malfunction (supply line)
- Rainwater (initial entry)

**Key:** Category 1 water can degrade to Category 2 or 3 if left untreated for more than 48 hours.

### Category 2: Gray Water
Contains significant contamination that could cause illness if ingested.

**Sources:**
- Dishwasher or washing machine overflow
- Toilet overflow (urine only, no feces)
- Aquarium leaks
- Sump pump failures

### Category 3: Black Water
Grossly contaminated—may contain pathogens, toxins, or other harmful agents.

**Sources:**
- Sewage backup
- Toilet overflow with feces
- Flooding from rivers/streams
- Standing water with microbial growth

**Critical:** Category 3 requires specialized remediation. Porous materials exposed to Category 3 water typically must be removed and replaced.

## IICRC Water Damage Classes

Classes describe the rate of evaporation based on the extent of water absorption.

### Class 1: Least Amount
- Small area affected
- Minimal absorption into materials
- Example: Leak contained to small section of floor

### Class 2: Significant Amount
- Large area affected
- Water wicked up walls 12-24 inches
- Carpet and cushion wet
- Structural materials retain moisture

### Class 3: Greatest Amount
- Water from overhead
- Ceilings, walls, insulation, carpet all saturated
- Requires maximum drying equipment

### Class 4: Specialty
- Deep pockets of saturation
- Hardwood floors, concrete, crawlspaces
- Requires special drying methods and extended time

## Why Classification Matters for Claims

- **Higher categories = more extensive (and expensive) remediation**
- **Carriers often try to downgrade categories to reduce scope**
- **Proper moisture readings and testing support correct classification**
- **IICRC standards are the industry benchmark—reference them in disputes**

Document the water source, affected materials, and moisture readings immediately. This evidence supports proper classification when the carrier's adjuster tries to minimize.""",
                    duration_minutes=25,
                    order=1
                ),
                Lesson(
                    title="Mitigation & Documentation",
                    description="Protecting the property while building your claim file",
                    content="""# Mitigation & Documentation

You have a duty to mitigate—but how you mitigate and document determines your claim's outcome.

## The Duty to Mitigate

Your policy requires reasonable steps to prevent further damage. This is NOT optional—failure to mitigate can be used against you.

### What's Required
- Stop the water source if possible
- Extract standing water
- Begin drying within 24-48 hours
- Protect undamaged property
- Emergency tarping/boarding if needed

### What's NOT Required
- Permanent repairs before claim is assessed
- Hiring the carrier's "preferred" vendor
- Spending your own money on full restoration

## Documentation Protocol

### Before Any Work Begins
1. **Photograph everything** before touching it
2. **Video walkthrough** showing water levels, affected areas
3. **Moisture readings** at multiple points (record location, reading, time)
4. **Note the water source** and category assessment

### During Mitigation
1. **Daily moisture readings** with documentation
2. **Equipment placement log** (what equipment, where, how long)
3. **Photos of what's removed** (drywall, flooring, cabinets)
4. **Material samples** if mold suspected (for testing)
5. **Drying logs** from the mitigation company

### Critical Measurements
- **Moisture content** of affected materials (use pin and pinless meters)
- **Relative humidity** of affected rooms
- **Temperature** readings
- **GPP (Grains Per Pound)** calculations for drying goals
- **Comparison readings** in unaffected areas (your "dry standard")

## Carrier Disputes on Mitigation

### "You didn't mitigate quickly enough"
**Response:** Document when you discovered the damage and what steps you took. Show the timeline proves reasonable response.

### "The mitigation company did too much"
**Response:** IICRC S500 standards dictate minimum scope. If the work follows S500, it's defensible.

### "We have a preferred vendor who can do it cheaper"
**Response:** You are not required to use the carrier's preferred vendor. You are entitled to choose your own qualified contractor.

### "The drying took too long"
**Response:** Drying goals are reached when moisture content returns to dry standard. This is measurable, not arbitrary. Share the drying logs.

## The Mold Question

### When to Test
- Visible microbial growth
- Category 2 or 3 water present > 48 hours
- Musty odor
- Occupant health complaints

### IICRC S520 Standard
Mold remediation follows IICRC S520. Key requirements:
- Air sampling before and after
- Containment during remediation
- HEPA filtration
- Post-remediation verification

### Claim Impact
Mold findings can significantly increase claim value. Carriers will resist—but documented mold requiring S520 remediation is a covered consequence of the water loss in most policies.""",
                    duration_minutes=30,
                    order=2
                ),
                Lesson(
                    title="Water Damage Estimate Strategy",
                    description="Building a complete and defensible estimate",
                    content="""# Water Damage Estimate Strategy

Water damage estimates are often the most complex in property claims. Getting them right means understanding what belongs in the scope and how to price it.

## Scope Components Most Often Missed

### 1. Contents
- Furniture affected by water (swelling, staining, odor)
- Electronics exposed to moisture
- Personal items requiring cleaning or replacement
- Soft goods (clothing, linens, pillows)

### 2. Hidden Damage
- Damage behind cabinets and vanities
- Insulation contamination in walls/attics
- Subfloor damage beneath finished flooring
- Mold growth in concealed spaces

### 3. Code Upgrades
- Electrical code changes since original construction
- Plumbing code requirements
- HVAC modifications
- Building envelope requirements

### 4. Matching
- If you replace 30% of a hardwood floor, matching the remaining 70% may require replacing the entire floor
- Same principle applies to cabinets, tile, and other finishes
- "Like kind and quality" means a reasonable match—not a patchwork

### 5. Loss of Use
- Hotel stays, meals, storage costs
- Additional transportation costs
- Pet boarding
- Often undervalued or ignored by carriers

## Pricing Strategy

### Use Industry Standards
- Xactimate pricing databases
- RS Means for commercial work
- Actual contractor bids for specialty work

### Line-Item Everything
- Don't lump items together
- Separate labor and materials where possible
- Include all required steps (demo, haul, install, finish)

### Account for Realistic Conditions
- Access difficulties (tight spaces, multi-story)
- After-hours or emergency rates if applicable
- Specialty equipment requirements
- Minimum charges for small areas

## Common Carrier Objections

### "We can dry the carpet, no need to replace it"
**Response (Category 2/3):** IICRC S500 requires removal of carpet and pad exposed to Category 2/3 water. Cleaning cannot restore contaminated materials to safe condition.

### "The subfloor just needs to dry"
**Response:** Check moisture content. If the subfloor shows swelling, delamination, or persistent elevated moisture, replacement is required. Document with moisture readings and photos.

### "We're not paying for matching"
**Response:** "Like kind and quality" restoration requires reasonable matching. A patched floor or mismatched cabinets do not restore the property. Most state courts support matching requirements.

### "Mold remediation isn't covered"
**Response:** Review your policy. Mold that results from a covered water loss is typically covered as a consequence of the loss. Carriers cannot exclude consequences of covered perils through blanket mold exclusions in most jurisdictions.

## The Complete Water Damage Estimate Checklist

- [ ] Emergency services (extraction, board-up, tarping)
- [ ] Drying equipment (daily rates × days to dry standard)
- [ ] Demolition (affected materials)
- [ ] Haul-off and disposal
- [ ] Mold testing (if warranted)
- [ ] Mold remediation (if positive)
- [ ] Structural drying of framing/subfloor
- [ ] Reconstruction (drywall, texture, paint)
- [ ] Flooring replacement (with matching)
- [ ] Cabinet/vanity replacement or refinishing
- [ ] Electrical/plumbing if exposed
- [ ] Contents cleaning or replacement
- [ ] Code upgrades
- [ ] Overhead & Profit (if warranted)
- [ ] Loss of use (ALE)""",
                    duration_minutes=30,
                    order=3
                )
            ],
            quiz=[
                QuizQuestion(
                    question="IICRC Category 3 (black water) comes from sources such as:",
                    options=["A broken kitchen supply line", "A dishwasher overflow", "Sewage backup or river flooding", "A leaking water heater"],
                    correct_answer=2,
                    explanation="Category 3 water is grossly contaminated and includes sewage, flooding from natural water bodies, and any standing water with microbial growth."
                ),
                QuizQuestion(
                    question="True or False: Category 1 (clean) water can never become Category 3 (black) water.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Category 1 water degrades over time. After 48+ hours untreated, clean water can become Category 2 or 3 due to microbial growth and contamination from materials it contacts."
                ),
                QuizQuestion(
                    question="What does IICRC S500 govern?",
                    options=["Roofing standards", "Water damage restoration standards", "Electrical code requirements", "Carrier claim procedures"],
                    correct_answer=1,
                    explanation="IICRC S500 is the industry standard for professional water damage restoration. It defines categories, classes, and proper remediation procedures."
                ),
                QuizQuestion(
                    question="Your client's kitchen had a dishwasher overflow 3 days ago. Water reached the adjacent living room. The carrier says 'just dry the carpet.' The carpet has been wet for 72+ hours with gray water. What should you do?",
                    options=["Accept the carrier's recommendation to dry the carpet", "Document that IICRC S500 requires removal of carpet exposed to Category 2 water for 72+ hours, and supplement for replacement", "Let the homeowner decide", "Wait and see if the carpet develops mold first"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="A dishwasher overflow (Category 2 - gray water) affected the kitchen and living room. The mitigation company arrived 3 days later. Carpet and pad in the living room are saturated. Moisture readings show elevated levels in the walls 18 inches up.",
                    explanation="IICRC S500 is clear: carpet and pad exposed to Category 2 water for extended periods must be removed. Drying cannot restore contaminated porous materials to safe condition."
                ),
                QuizQuestion(
                    question="True or False: You are required to use the carrier's preferred mitigation vendor.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="You have the right to choose your own qualified contractor. The carrier may recommend vendors, but you are not obligated to use them."
                ),
                QuizQuestion(
                    question="When documenting water damage, moisture readings should include:",
                    options=["Just the wet areas", "Wet areas plus unaffected areas for 'dry standard' comparison", "Only the carrier's readings", "No readings needed—photos are enough"],
                    correct_answer=1,
                    explanation="Moisture readings in both affected AND unaffected areas establish a baseline ('dry standard'). This proves what's abnormal and defines when drying is complete."
                )
            ]
        ),
        Course(
            title="Xactimate Fundamentals",
            description="Learn to read, analyze, and dispute carrier estimates written in Xactimate—the industry-standard estimating software.",
            category="training",
            thumbnail="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400",
            lessons=[
                Lesson(
                    title="Reading an Xactimate Estimate",
                    description="Understanding line items, categories, and pricing",
                    content="""# Reading an Xactimate Estimate

Xactimate is the industry-standard estimating software used by carriers, contractors, and public adjusters. If you can't read it, you can't dispute it.

## Estimate Structure

### Header Information
- **Claim number and date**
- **Insured name and property address**
- **Type of loss** (wind, water, fire, etc.)
- **Price list** (geographic pricing database used)
- **Date of loss**

### Room-by-Room Layout
Xactimate organizes estimates by room/area. Each room contains line items for the work required in that space.

### Line Item Components
Each line item has:
- **Category code** (e.g., RFG = Roofing, DRY = Drywall)
- **Selector code** (specific item within category)
- **Description** (what the item is)
- **Quantity** (amount needed)
- **Unit** (SF, LF, EA, SQ, etc.)
- **Unit price** (cost per unit)
- **Total** (quantity × unit price)
- **O&P** indicator (whether overhead & profit is included)

## Key Category Codes

| Code | Category |
|------|----------|
| RFG | Roofing |
| DRY | Drywall |
| PNT | Painting |
| FLR | Flooring |
| PLM | Plumbing |
| ELC | Electrical |
| CLN | Cleaning |
| WTR | Water extraction/mitigation |
| DEM | Demolition |
| GNL | General items |
| CNT | Contents |

## Units of Measurement

- **SF** = Square Feet
- **LF** = Linear Feet
- **SQ** = Square (100 SF, used for roofing)
- **EA** = Each (per unit)
- **HR** = Hour (labor)
- **DA** = Day (equipment rental)

## What to Look For

### Missing Items
Compare the estimate against the actual damage. Common omissions:
- Demolition/removal of damaged materials
- Haul-off and dump fees
- Protection of surrounding areas
- Detach and reset items (light fixtures, outlets, etc.)
- Texture matching for drywall
- Primer before paint

### Incorrect Quantities
- Measure the actual area—don't assume the carrier measured correctly
- Check waste factors (roofing should include waste)
- Verify room dimensions match reality

### Wrong Pricing
- Xactimate prices update monthly by region
- Ensure the correct price list is being used
- Check for manual price overrides (the carrier may have manually lowered prices)

### Depreciation Issues
- Check what's being depreciated and at what rate
- Labor depreciation may be improper in your state
- Verify depreciation percentages are reasonable for material age""",
                    duration_minutes=30,
                    order=1
                ),
                Lesson(
                    title="Common Carrier Estimate Tricks",
                    description="How carriers manipulate Xactimate to underpay",
                    content="""# Common Carrier Estimate Tricks

Carriers use Xactimate too—but they configure it to minimize payouts. Knowing their tricks lets you catch them.

## Pricing Manipulation

### Manual Price Overrides
Carriers sometimes manually override Xactimate's market-based pricing with lower figures. Look for:
- Prices significantly below current Xactimate rates
- Flat rates instead of line-item pricing
- "Preferred vendor" rates substituted for market rates

**Your move:** Request the Xactimate printout showing price list version and any manual overrides. Compare against current market rates.

### Outdated Price Lists
Using last year's price list when materials have increased 10-15%.

**Your move:** Check the price list date on the estimate. Current Xactimate pricing updates monthly.

### Wrong Geographic Price List
Using pricing from a cheaper market for your area.

**Your move:** Verify the price list matches your property's zip code.

## Scope Manipulation

### "Repair" vs. "Replace"
Carriers estimate repair when replacement is required. Example: patching 3 shingles when 3 squares need replacement.

**Your move:** Document why replacement is necessary. Photos showing extent of damage, manufacturer specs on repair limits.

### Ignoring Related Items
Replacing drywall but not estimating texture matching, primer, or paint. Replacing flooring but not including baseboards.

**Your move:** Walk through the logical repair sequence. Every trade action has related items.

### Combining Rooms
Treating multiple rooms as one to reduce minimum charges and setup costs.

**Your move:** Each room is a separate work area requiring individual setup, protection, and finishing.

### Excluding Demolition
Estimating installation without removal of damaged materials.

**Your move:** You can't install new over damaged. Demo, haul-off, and disposal are required scope items.

## Depreciation Tricks

### Aggressive Depreciation Rates
Depreciating a 5-year-old roof at 50% when its expected life is 30 years.

**Your move:** Research expected lifespan of the material. Calculate reasonable depreciation. A 5-year-old, 30-year shingle = 16.7% depreciation, not 50%.

### Depreciating Non-Depreciable Items
- Labor (improper in FL, TX, and other states)
- Overhead & Profit
- Removal/haul-off (these are new costs, not replacing aged items)

**Your move:** Know your state's depreciation rules. Cite statute if labor depreciation is prohibited.

## The Line-Item Comparison Method

For every supplement dispute, create a side-by-side comparison:

| Line Item | Carrier's Estimate | Your Estimate | Difference | Justification |
|-----------|-------------------|---------------|------------|---------------|
| Shingle removal | $0 (not included) | $85/SQ | $850 | Required before install |
| Drip edge | $0 | $3.50/LF | $560 | Code requirement |
| Ice & water shield | $0 | $95/SQ | $285 | Building code in valleys |

This format makes it easy for the carrier to approve—or forces them to explain line-by-line denials.""",
                    duration_minutes=25,
                    order=2
                ),
                Lesson(
                    title="Building Your Counter-Estimate",
                    description="Creating a complete, defensible Xactimate estimate",
                    content="""# Building Your Counter-Estimate

A professional counter-estimate isn't just "more money"—it's a documented, defensible scope of work priced at industry standards.

## The Complete Scope Approach

### Step 1: Field Documentation
Before opening Xactimate, complete your field inspection:
- Measurements (don't rely on carrier's)
- Photos tied to specific damage
- Moisture readings (water claims)
- Material identification (shingle type, flooring brand, etc.)
- Code requirements for the jurisdiction

### Step 2: Scope Development
Build your estimate room-by-room:
1. **What needs to be removed** (demo line items)
2. **What needs to be disposed of** (haul-off)
3. **What needs to be protected** (adjacent areas)
4. **What needs to be installed** (replacement items)
5. **What finishing is required** (paint, texture, trim)
6. **What related trades are triggered** (electrical, plumbing)

### Step 3: Pricing
- Use current Xactimate price lists for your region
- Don't manually override prices without justification
- Include waste factors where appropriate
- Add minimum charges for small areas

### Step 4: O&P Determination
Include overhead & profit when warranted:
- Three or more trades involved
- Complexity requires coordination
- Permits and inspections needed

## Estimate Quality Checklist

### Completeness
- [ ] All affected areas included
- [ ] Demo AND replacement for each damaged item
- [ ] Related items included (detach/reset, protection, cleanup)
- [ ] Code upgrades where applicable
- [ ] Contents affected by the loss

### Accuracy
- [ ] Measurements verified in the field
- [ ] Correct materials specified (match existing)
- [ ] Appropriate waste factors
- [ ] Current price list used
- [ ] Reasonable depreciation (if ACV)

### Defensibility
- [ ] Every line item ties to documented damage
- [ ] Photos support scope claims
- [ ] Methodology follows industry standards
- [ ] Pricing is market-standard (not inflated)
- [ ] Notes explain non-obvious items

## Presenting Your Estimate

### Format
- Professional Xactimate printout (not handwritten)
- Cover letter summarizing differences from carrier's estimate
- Photo documentation referenced to line items
- Supporting documents (code requirements, manufacturer specs)

### Language
- Factual and specific
- Reference policy language for coverage basis
- Cite IICRC, building code, or manufacturer standards
- Request written response with specific objections

### Follow-Up
- Set a response deadline (14-21 days is reasonable)
- Document submission method (email with read receipt, certified mail)
- Track response and follow up if no response received

## The Supplement Workflow

1. Submit counter-estimate with documentation
2. Carrier reviews and responds (or doesn't)
3. If partial approval → submit supplement for remaining items
4. If denial → request written basis for each denied item
5. If no response → escalate (supervisor, DOI, appraisal)

The goal is to make your estimate so well-documented that approval is easier than denial.""",
                    duration_minutes=30,
                    order=3
                )
            ],
            quiz=[
                QuizQuestion(
                    question="In Xactimate, what does the unit 'SQ' stand for?",
                    options=["Square inch", "Square foot", "Square (100 square feet)", "Square yard"],
                    correct_answer=2,
                    explanation="In roofing, a 'square' (SQ) equals 100 square feet. This is the standard unit for measuring and pricing roof work in Xactimate."
                ),
                QuizQuestion(
                    question="True or False: If the carrier's Xactimate estimate uses last month's price list, the pricing is automatically correct.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Price lists update monthly to reflect market conditions. An outdated list may undervalue materials and labor that have increased. Always check the price list date and version."
                ),
                QuizQuestion(
                    question="A carrier's estimate includes shingle replacement but NOT shingle removal, haul-off, or disposal. What should you do?",
                    options=["Accept it—removal is included in the install price", "Submit a supplement adding demo, haul-off, and disposal as separate line items", "Remove the old shingles yourself to save money", "Wait for the contractor to figure it out"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="You receive a carrier estimate for roof repair. It includes 15 squares of shingle installation but has no line items for tear-off, removal, or disposal of the existing damaged shingles. The current shingles must be removed before new ones can be installed.",
                    explanation="Removal, haul-off, and disposal are separate scope items in Xactimate. You cannot install new shingles over damaged ones. These are standard line items that should be included."
                ),
                QuizQuestion(
                    question="What is the most effective way to dispute a carrier's Xactimate estimate?",
                    options=["Just tell them the number is too low", "Create a line-by-line comparison showing each missing or underpriced item with documentation", "Hire a lawyer immediately", "Accept the estimate and negotiate later"],
                    correct_answer=1,
                    explanation="A line-by-line comparison makes it easy for the carrier to approve specific items—or forces them to justify denials for each one. Vague objections are easy to dismiss."
                ),
                QuizQuestion(
                    question="True or False: The carrier can require you to use their 'preferred vendor' pricing in the estimate.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="You are entitled to market-rate pricing. The carrier's preferred vendor rates may be below market and do not obligate you to accept below-standard compensation."
                ),
                QuizQuestion(
                    question="When should O&P (Overhead & Profit) be included in your Xactimate estimate?",
                    options=["Always, on every estimate", "Only when the claim exceeds $50,000", "When three or more trades are involved, requiring GC coordination", "Never—O&P is the contractor's problem"],
                    correct_answer=2,
                    explanation="The industry 'three-trade rule' applies: when three or more trades require coordination, GC involvement is warranted, and the standard 10/10 O&P should be included."
                )
            ]
        ),
        Course(
            title="Florida Insurance Law Essentials",
            description="Master the Florida-specific statutes, regulations, and legal frameworks that govern property insurance claims in the Sunshine State.",
            category="advanced",
            thumbnail="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400",
            lessons=[
                Lesson(
                    title="Key Florida Statutes for Claims",
                    description="The laws that protect policyholders in Florida",
                    content="""# Key Florida Statutes for Claims

Florida has some of the strongest policyholder protections in the country. Knowing these statutes gives you leverage in every negotiation.

## F.S. 627.70131 — Insurer's Duty to Acknowledge & Act

This is the most important statute for claims handling timelines.

### Requirements
- **14 days** — Carrier must acknowledge receipt of claim
- **90 days** — Carrier must pay or deny the claim with written explanation
- **Penalty** — Interest accrues on late payments

### How to Use It
Reference this statute in every correspondence where timelines are at issue. "Per F.S. 627.70131, payment or written denial was due by [date]. We have received neither."

## F.S. 626.854 — Public Adjuster Regulations

### Key Provisions
- PA must be licensed and bonded ($50,000 surety bond)
- Maximum fee: 10% of claim proceeds (standard)
- Maximum fee in declared emergency areas: 20%
- 3 business day rescission period for PA contracts
- PA cannot have financial interest in repair work

### Why It Matters
If you're working with a PA, these rules protect you. If the carrier questions your PA's authority, these statutes establish the framework.

## F.S. 626.8796 — Contract Requirements

### Mandatory Contract Elements
- Written contract required
- Clear statement of fees
- Rescission notice (3 business days)
- Fraud penalties disclosure
- Description of services

## F.S. 627.7015 — Alternative Dispute Resolution

### Appraisal
- Either party can invoke appraisal for amount disputes
- Each party selects an appraiser
- Appraisers select an umpire
- Two of three decide the loss amount

### Mediation
- Available through the Department of Financial Services
- Non-binding (unlike appraisal)
- Low cost compared to litigation

## F.S. 627.702 — Valued Policy Law

### The Rule
If a covered peril causes **total loss** to a building insured under a valued policy, the carrier must pay the **full policy limit** regardless of actual value.

### Requirements
- Must be a total loss (constructive or actual)
- Must be a covered peril
- Applies to dwelling (Coverage A)

### Practical Impact
In total loss scenarios, don't let the carrier depreciate or argue the building is worth less than the limit. The law is clear.

## Florida Labor Depreciation Prohibition

### The Rule
Florida prohibits carriers from depreciating labor costs when calculating ACV.

### Why This Matters
Labor can represent 40-60% of a claim's value. If the carrier depreciates labor, they're underpaying by a significant amount.

### How to Enforce
"Per Florida law, labor costs may not be depreciated in calculating actual cash value. Please revise your estimate to remove labor depreciation from lines [X, Y, Z]."

## Assignment of Benefits (AOB) — Current Status

### Historical Context
AOBs allowed contractors and providers to file claims directly against carriers. This was common but controversial.

### Current Law
Florida significantly restricted AOBs in recent legislation. Understand the current framework before relying on AOB strategies.

## Practical Application

For every Florida claim:
1. Calculate statutory deadlines from date of loss
2. Track carrier compliance with 14/90 day requirements
3. Document any labor depreciation for dispute
4. Know your appraisal rights
5. Understand valued policy law for total losses""",
                    duration_minutes=35,
                    order=1
                ),
                Lesson(
                    title="Department of Financial Services",
                    description="How to use Florida's insurance regulator effectively",
                    content="""# Department of Financial Services

The Florida Department of Financial Services (DFS) oversees insurance regulation. It can be a powerful tool—but you need to use it correctly.

## What the DFS Can Do

### Investigate Carrier Practices
- Review claim handling procedures
- Examine whether carriers follow statutory requirements
- Identify patterns of violations

### Require Carrier Response
- When you file a complaint, the carrier MUST respond
- This creates documented evidence
- Response timeline creates accountability

### Impose Penalties
- Fines for statutory violations
- Market conduct examinations
- License actions for repeat offenders

### Provide Documentation
- Complaint records are public
- Pattern evidence supports litigation
- Regulatory findings carry weight

## What the DFS Cannot Do

### They Cannot
- Force payment of your specific claim
- Interpret your policy for you
- Practice law or give legal advice
- Override a legitimate coverage determination
- Speed up the claims process (directly)

### But Indirectly
A DFS complaint often triggers:
- Senior-level review at the carrier
- Re-evaluation of the claim
- Faster resolution to avoid regulatory scrutiny

## Filing an Effective Complaint

### Be Specific
Bad: "State Farm isn't paying my claim."
Good: "State Farm received my roof damage claim on [date], acknowledged receipt on [date], but has failed to provide payment or written denial within the 90-day period required by F.S. 627.70131."

### Include Documentation
- Copies of all correspondence
- Claim number and policy number
- Timeline of events
- Specific statutes you believe were violated

### Focus on Regulatory Violations
The DFS responds to statutory violations, not unfairness complaints.

Effective triggers:
- Failure to acknowledge within 14 days
- Failure to pay or deny within 90 days
- Failure to provide written basis for denial
- Labor depreciation (prohibited in FL)
- Misrepresentation of policy provisions

### Follow Up
- Check complaint status regularly
- Respond to any DFS requests promptly
- Keep records of all DFS communications

## Strategic Timing

### File Early When
- Carrier is clearly violating statutory timelines
- You have documented evidence of violations
- Pattern of non-responsiveness

### Wait When
- Negotiations are productive
- Carrier is acting within timelines
- You want to preserve the relationship for ongoing claims

## Building Bad Faith Through Regulatory Records

Each DFS complaint creates a regulatory record. Multiple complaints against the same carrier on the same claim demonstrate:
- Pattern of behavior
- Notice to the carrier of problems
- Failure to correct despite notice

This is valuable if the claim later moves to litigation for bad faith.""",
                    duration_minutes=25,
                    order=2
                ),
                Lesson(
                    title="Hurricane & Catastrophe Claims in Florida",
                    description="Special rules and strategies for catastrophe claims",
                    content="""# Hurricane & Catastrophe Claims in Florida

Hurricane claims in Florida have unique characteristics that require specialized knowledge and strategy.

## Separate Hurricane Deductibles

### How They Work
Most Florida policies have a **separate hurricane deductible** that's typically 2-5% of Coverage A.

**Example:** $300,000 dwelling limit × 2% hurricane deductible = **$6,000 deductible** (vs. perhaps $1,000 for a non-hurricane claim).

### Impact
- Smaller claims may not exceed the deductible
- This is by design—carriers structure deductibles to minimize hurricane payouts
- Document ALL damage to ensure you exceed the deductible threshold

### Multiple Events
If multiple hurricanes affect the property in one season, each may trigger a separate deductible. Know your policy's language on "hurricane season" deductibles.

## Wind vs. Water Disputes

### The Core Issue
Wind damage is covered by your homeowner's policy. Flood damage requires separate flood insurance (NFIP or private).

### The Carrier Tactic
After a hurricane, carriers routinely argue that damage was caused by "storm surge" or "flood" (excluded) rather than "wind" (covered).

### Your Strategy
- **Document wind damage before water recedes** if possible
- **Elevation matters:** Damage above storm surge height is wind
- **Direction of damage:** Wind damage has directional patterns
- **Timeline:** Wind precedes surge—damage from the eyewall may precede flooding
- **Engineering reports** can distinguish wind from water damage

## Emergency Measures After a Hurricane

### Immediate Steps
1. Secure the property (emergency tarping, board-up)
2. Document everything with photos/video
3. Report the claim immediately
4. Keep all receipts for emergency expenses
5. Do NOT make permanent repairs yet

### Emergency Services Coverage
Your policy covers reasonable emergency services. This includes:
- Temporary tarping
- Board-up
- Water extraction
- Generator rental (if needed to prevent further damage)
- Tree removal from structures

## Post-Catastrophe Carrier Behavior

### What to Expect
- Overwhelmed adjusters making quick assessments
- "Desk adjusters" estimating from satellite imagery
- Pressure to accept fast settlements
- Preferred vendor referrals (often at below-market rates)
- Extended timelines due to volume

### Your Response
- Don't accept desk estimates without field inspection
- Don't rush to settle—document thoroughly first
- Get independent estimates from your own contractor
- Insist on complete scoping (not just visible damage)
- Track statutory deadlines despite "catastrophe" excuses

## Public Adjuster Fee Caps (Emergency Areas)

When a state of emergency is declared:
- PA fees are capped at **20%** (vs. 10% normal)
- This cap applies to the declared area
- Duration: typically 12-24 months from declaration

## The Long Game: Supplements After Catastrophe

### Hidden Damage Timeline
Hurricane damage reveals itself over time:
- **Week 1-4:** Obvious structural damage, roof damage
- **Month 1-3:** Water intrusion from compromised envelope
- **Month 3-12:** Mold growth, settling, secondary damage
- **Year 1-2:** Structural issues from prolonged moisture exposure

### Supplementing Strategy
- Initial claim for immediate damage
- Supplement 1: Hidden damage found during repairs
- Supplement 2: Consequential damage (mold, structure)
- Keep the claim open until all damage is identified

## Documentation Standards for Hurricane Claims

### Minimum Documentation
- Date-stamped photos of all damage
- Wide, medium, and close-up shots
- Aerial/drone imagery if available
- Moisture readings throughout the property
- Contractor assessments for each trade affected
- Weather data for your specific location
- Neighboring property damage (establishes pattern)""",
                    duration_minutes=35,
                    order=3
                )
            ],
            quiz=[
                QuizQuestion(
                    question="Under F.S. 627.70131, a carrier must pay or deny a claim within:",
                    options=["30 days", "60 days", "90 days", "120 days"],
                    correct_answer=2,
                    explanation="Florida statute requires carriers to pay or deny claims with written explanation within 90 days. They must acknowledge receipt within 14 days."
                ),
                QuizQuestion(
                    question="True or False: In Florida, carriers are allowed to depreciate labor costs when calculating ACV.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Florida law prohibits the depreciation of labor costs. Since labor can represent 40-60% of a claim, this significantly impacts payment amounts."
                ),
                QuizQuestion(
                    question="A Florida homeowner has a $300,000 dwelling policy with a 2% hurricane deductible. What is their hurricane deductible?",
                    options=["$2,000", "$3,000", "$6,000", "$30,000"],
                    correct_answer=2,
                    question_type="scenario",
                    scenario_context="A Florida homeowner with a $300,000 Coverage A limit has a 2% hurricane deductible. A Category 3 hurricane has damaged their roof, siding, and interior from water intrusion.",
                    explanation="$300,000 × 2% = $6,000. Florida hurricane deductibles are percentage-based and much higher than standard deductibles, by design."
                ),
                QuizQuestion(
                    question="The Florida Valued Policy Law applies when:",
                    options=["Any claim is filed", "The carrier agrees to pay", "A covered peril causes total loss to the building", "The policyholder requests it"],
                    correct_answer=2,
                    explanation="The Valued Policy Law requires full policy limit payment only for TOTAL losses from covered perils. Partial losses are paid based on actual damage."
                ),
                QuizQuestion(
                    question="After a hurricane, a carrier sends a 'desk adjuster' estimate based on satellite imagery without visiting the property. What is the best response?",
                    options=["Accept it—satellite imagery is accurate", "Insist on a field inspection and document damage thoroughly with your own estimates before accepting anything", "File a lawsuit immediately", "Wait for the carrier to schedule their own inspection"],
                    correct_answer=1,
                    question_type="scenario",
                    scenario_context="Hurricane winds damaged your client's roof, soffit, and caused interior water damage. The carrier sent an estimate based on satellite/aerial imagery without sending an adjuster. The estimate covers only partial roof damage and excludes interior damage entirely.",
                    explanation="Desk estimates are incomplete by nature. They cannot assess interior damage, hidden damage, or proper scope. Insist on a field inspection while documenting everything independently."
                ),
                QuizQuestion(
                    question="True or False: PA fees in Florida are always capped at 10% regardless of circumstances.",
                    options=["True", "False"],
                    correct_answer=1,
                    question_type="true_false",
                    explanation="Standard PA fees are capped at 10%, but in declared emergency areas, the cap increases to 20% for a specified period (typically 12-24 months)."
                ),
                QuizQuestion(
                    question="What is the maximum time a Florida carrier has to ACKNOWLEDGE receipt of a claim?",
                    options=["7 days", "14 days", "30 days", "90 days"],
                    correct_answer=1,
                    explanation="F.S. 627.70131 requires carriers to acknowledge claim receipt within 14 days. The 90-day period is for paying or denying the claim."
                )
            ]
        )
    ]

    # Insert all courses
    all_courses = training_courses + advanced_courses + additional_courses
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

    # Seed companion workbooks
    try:
        from routes.workbooks import seed_workbooks
        await seed_workbooks()
    except Exception as e:
        logger.error(f"Failed to seed workbooks: {e}")


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
    details = []

    for i, question in enumerate(quiz):
        user_answer = submission.answers[i] if i < len(submission.answers) else -1
        is_correct = user_answer == question["correct_answer"]
        if is_correct:
            correct += 1
        details.append({
            "question": question["question"],
            "user_answer": user_answer,
            "correct_answer": question["correct_answer"],
            "is_correct": is_correct,
            "explanation": question.get("explanation"),
            "question_type": question.get("question_type", "multiple_choice"),
            "options": question.get("options", []),
        })

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
    
    return {"score": score, "correct": correct, "total": total, "passed": passed, "certificate": certificate, "details": details}

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


# ══════════════════════════════════════════════════════════════════════
# E-Book Library
# ══════════════════════════════════════════════════════════════════════

@router.post("/library/books")
async def add_library_book(body: dict, current_user: dict = Depends(get_current_active_user)):
    """Add a book to the shared library (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or manager role required")

    book = {
        "id": str(uuid.uuid4()),
        "title": body.get("title", "Untitled"),
        "author": body.get("author", "Unknown"),
        "description": body.get("description", ""),
        "category": body.get("category", "other"),
        "file_id": body["file_id"],
        "file_type": body.get("file_type", "epub"),
        "cover_file_id": body.get("cover_file_id"),
        "tags": body.get("tags", []),
        "added_by": current_user.get("email"),
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.library_books.insert_one(book)
    book.pop("_id", None)
    return book


@router.get("/library/books")
async def list_library_books(
    category: str = None,
    search: str = None,
    current_user: dict = Depends(get_current_active_user),
):
    """List all books in the shared library, with per-user progress"""
    query = {}
    if category and category != "all":
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"author": {"$regex": search, "$options": "i"}},
        ]

    books = await db.library_books.find(query, {"_id": 0}).sort("added_at", -1).to_list(200)

    # Attach per-user progress
    email = current_user.get("email")
    book_ids = [b["id"] for b in books]
    progress_docs = await db.library_progress.find(
        {"book_id": {"$in": book_ids}, "user_email": email}, {"_id": 0}
    ).to_list(200)
    progress_map = {p["book_id"]: p for p in progress_docs}

    for b in books:
        prog = progress_map.get(b["id"])
        b["progress"] = {
            "percentage": prog.get("percentage", 0) if prog else 0,
            "last_read": prog.get("last_read") if prog else None,
        }

    return books


@router.get("/library/books/{book_id}")
async def get_library_book(book_id: str, current_user: dict = Depends(get_current_active_user)):
    """Get a single book's details"""
    book = await db.library_books.find_one({"id": book_id}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    prog = await db.library_progress.find_one(
        {"book_id": book_id, "user_email": current_user.get("email")}, {"_id": 0}
    )
    book["progress"] = prog or {}
    return book


@router.put("/library/books/{book_id}")
async def update_library_book(book_id: str, body: dict, current_user: dict = Depends(get_current_active_user)):
    """Update book metadata (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or manager role required")

    updates = {}
    for field in ["title", "author", "description", "category", "tags", "cover_file_id"]:
        if field in body:
            updates[field] = body[field]

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.library_books.update_one({"id": book_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")

    book = await db.library_books.find_one({"id": book_id}, {"_id": 0})
    return book


@router.delete("/library/books/{book_id}")
async def delete_library_book(book_id: str, current_user: dict = Depends(get_current_active_user)):
    """Remove a book from the library (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or manager role required")

    result = await db.library_books.delete_one({"id": book_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")

    await db.library_progress.delete_many({"book_id": book_id})
    return {"message": "Book deleted"}


@router.put("/library/books/{book_id}/progress")
async def save_reading_progress(book_id: str, body: dict, current_user: dict = Depends(get_current_active_user)):
    """Save reading position for the current user"""
    email = current_user.get("email")
    update = {
        "book_id": book_id,
        "user_email": email,
        "position": body.get("position"),
        "percentage": body.get("percentage", 0),
        "last_read": datetime.now(timezone.utc).isoformat(),
    }

    await db.library_progress.update_one(
        {"book_id": book_id, "user_email": email},
        {"$set": update},
        upsert=True,
    )
    return {"ok": True}


@router.get("/library/books/{book_id}/progress")
async def get_reading_progress(book_id: str, current_user: dict = Depends(get_current_active_user)):
    """Get current user's reading progress for a book"""
    prog = await db.library_progress.find_one(
        {"book_id": book_id, "user_email": current_user.get("email")}, {"_id": 0}
    )
    return prog or {"book_id": book_id, "position": None, "percentage": 0}
