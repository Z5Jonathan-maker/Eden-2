"""
Knowledge Base Routes - Industry Experts & Resources
Stores and serves expert profiles for Eve AI and Doctrine browsing
"""

from fastapi import APIRouter, HTTPException, Depends
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge-base"])


# Industry experts data - compiled from web research
INDUSTRY_EXPERTS = {
    "figures": [
        {
            "id": "john-senac",
            "name": "John Senac",
            "alias": "John the Roof Pro",
            "category": "Roofing & Claims",
            "bio": "John Senac, aka 'John the Roof Pro,' is a roofing expert specializing in insurance claims for hail and storm damage. Founder of NTS Identification Services and JohnTheRoofPro.com, he provides consulting on roofing systems, product identification, repair methods, and compatibility. With expertise in discontinued materials and the 'Innovative C.A.R. Approach' (Compatibility, Availability, Repairability), he educates on documentation to prevent claim denials.",
            "expertise": [
                "Hail and storm damage assessment",
                "Roofing product identification",
                "C.A.R. Approach (Compatibility, Availability, Repairability)",
                "Documentation for claim success",
                "Discontinued shingle identification"
            ],
            "books": [],
            "articles": [
                {
                    "title": "10 Essential Steps for Mastering Roofing Insurance Claims",
                    "url": "https://www.supplementclass.com/blog/john-senac-roofing-claims",
                    "excerpt": "Navigating the world of roofing insurance claims can be tricky, but with the right knowledge and guidance, you can master the process."
                },
                {
                    "title": "You're Processing Roofing Claims Wrong",
                    "url": "https://www.youtube.com/watch?v=7PXq3w-rRXs",
                    "type": "video",
                    "excerpt": "Discusses how roofers can process insurance claims better, emphasizing documentation and avoiding common mistakes."
                },
                {
                    "title": "Roofing Business Conditions Are the Toughest in 10+ Years",
                    "url": "https://www.youtube.com/watch?v=5mu5r2gWvZQ",
                    "type": "video",
                    "excerpt": "Insights on tough market conditions, claims motivation, and industry 'truth bombs'."
                },
                {
                    "title": "Manufactured Roofing Damage | Big Mistakes Roofers Make",
                    "url": "https://www.youtube.com/watch?v=zN5m0REYJW4",
                    "type": "video",
                    "excerpt": "Manufactured damage is a terrible aspect of our industry - your time is better spent bettering your craft."
                }
            ],
            "resources": [
                {"type": "Website", "url": "https://www.johntheroofpro.com/", "description": "Consulting, education, 15+ hours of online classes"},
                {"type": "Podcast", "url": "https://www.youtube.com/channel/UCnL7u1fPYx6FNCkCRFtlvFw", "description": "Roofing Business Secrets podcast"},
                {"type": "Facebook", "url": "https://www.facebook.com/groups/1254084998288842", "description": "Roofing community and claims discussions"}
            ],
            "key_insights": [
                "Focus on fact-based documentation, not salesmanship",
                "C.A.R. approach provides objective evaluations for disputes",
                "Public adjusters take 25% vs lawyers at 10% - know when each is appropriate",
                "Claims under $40K may not be worth pursuing through litigation"
            ]
        },
        {
            "id": "matthew-mulholland",
            "name": "Matthew Mulholland",
            "alias": None,
            "category": "Public Adjusting",
            "bio": "Matthew Mulholland is a public adjuster and educator, president of Allgood Adjustments Inc., and founder of the National Claims Institute. An Aerospace Engineering graduate from Embry-Riddle, he specializes in hail damage, policy exclusions, and claims optimization with the 'Prove It Method.' He serves as Dean of Building Experts Institute and advises organizations like the American Policyholder Association and GAPIA.",
            "expertise": [
                "Hail damage assessment",
                "Policy exclusions interpretation",
                "Prove It Method for claims validation",
                "Burden of proof in property claims",
                "Policy language interpretation"
            ],
            "books": [],
            "articles": [
                {
                    "title": "Mastering Insurance Claims with Prove It Method",
                    "url": "https://www.facebook.com/groups/roofingsales/posts/4387768308130218",
                    "excerpt": "Mathew Mulholland talks about how public adjusters can learn one new thing to win insurance claims."
                },
                {
                    "title": "The Real Reason Insurance Claims Get Denied",
                    "url": "https://www.instagram.com/reel/DSvAxqVGNt6",
                    "type": "video",
                    "excerpt": "Burden of Proof - conditions of the policy always start with proving..."
                },
                {
                    "title": "Understanding Proof of Loss Forms for Property Claims",
                    "url": "https://www.tiktok.com/@mulhollandmathew/video/7503587649576308014",
                    "type": "video",
                    "excerpt": "Learn about proof of loss forms and the role of contractors in preparing evidence for property claims."
                }
            ],
            "resources": [
                {"type": "LinkedIn", "url": "https://www.linkedin.com/in/mathew-mulholland", "description": "Posts on hail damage and carrier strategies"},
                {"type": "Facebook", "url": "https://www.facebook.com/Mathew.Mulholland.Bull", "description": "Mindset shifts and claims strategies"},
                {"type": "Institute", "url": "https://www.buildingexperts.institute/experts-matt-mulholland", "description": "Training on policy interpretation"}
            ],
            "key_insights": [
                "Burden of proof lies with the policyholder - document everything",
                "20+ years chasing hail storms (half-million miles traveled)",
                "Strategy over volume: don't send excessive photos without a plan",
                "Understand policy language before arguing exclusions"
            ]
        },
        {
            "id": "vince-perri",
            "name": "Vince Perri",
            "alias": None,
            "category": "Public Adjusting",
            "location": "Florida",
            "bio": "Vince Perri is a Florida-based public adjuster, educator, and owner of Commercial Claims Advocate and Elite Resolutions. With 14+ years in the field, he transitioned from tennis instruction to adjusting after reading The 4-Hour Workweek. He emphasizes metrics for success and treating claims personally. Hosts podcasts and offers masterminds for adjusters.",
            "expertise": [
                "Commercial claims handling",
                "Public adjuster business growth",
                "Claims metrics and KPIs",
                "Client communication",
                "Claims lifecycle management"
            ],
            "books": [
                {
                    "title": "Public Adjuster Handbook: A Comprehensive Approach to Learning Public Adjusting",
                    "url": "https://university.commercialclaimsadvocate.com/ebook",
                    "excerpt": "A broken down process that I have taken almost 14 years now to put together - everything you need to know about an insurance claim."
                }
            ],
            "articles": [
                {
                    "title": "How I Became A Public Adjuster",
                    "url": "https://www.commercialclaimsadvocate.com/how-i-became-public-adjuster",
                    "excerpt": "FREE ACCESS to Vince's Original Public Adjuster's Guide - lessons Vince wished he knew 15 years ago."
                },
                {
                    "title": "Mastering the Public Adjuster Game: Tips from the Pros",
                    "url": "https://www.youtube.com/watch?v=iI5R5cHM3ws",
                    "type": "video",
                    "excerpt": "Networking, building relationships, strategies for finding new claims and expanding client base."
                },
                {
                    "title": "Mastering Efficient Communication: Tools and Techniques",
                    "url": "https://www.youtube.com/watch?v=G4hySbDnm3w",
                    "type": "video",
                    "excerpt": "Top communication tools for public adjusters - FREE Efficiency Hacks Guide."
                }
            ],
            "resources": [
                {"type": "Website", "url": "https://www.commercialclaimsadvocate.com/", "description": "Courses, masterminds, consulting, podcasts"},
                {"type": "YouTube", "url": "https://www.youtube.com/channel/UCnL7u1fPYx6FNCkCRFtlvFw", "description": "100+ videos on claims tips"},
                {"type": "Podcast", "url": "https://www.commercialclaimsadvocate.com/claims-game-podcast", "description": "Claims Game Podcast"}
            ],
            "key_insights": [
                "Top 5 metrics: claims volume, average settlement, close rate, time to close, client satisfaction",
                "Treat every claim like your own",
                "From broke tennis pro to $500K year in adjusting",
                "Difference between public vs independent adjusters is critical knowledge"
            ]
        },
        {
            "id": "chip-merlin",
            "name": "Chip Merlin",
            "alias": "Master of Disaster",
            "category": "Insurance Law",
            "location": "Tampa, Florida",
            "bio": "Chip Merlin is a national insurance attorney and policyholder advocate, founder of Merlin Law Group (1985). Known as the 'Master of Disaster' for catastrophe work (Katrina, Sandy, etc.). Lifetime Achievement Award from Florida Association of Public Adjusters. Board member of United Policyholders, expert on bad faith, claims delays, and underpayments.",
            "expertise": [
                "Insurance bad faith claims",
                "Catastrophe claims (hurricanes, floods)",
                "Policy interpretation",
                "Policyholder advocacy",
                "Claims delay litigation"
            ],
            "books": [
                {
                    "title": "Pay Up! Preventing a Disaster with Your Own Insurance Company",
                    "url": "https://www.amazon.com/Pay-Up-Preventing-Disaster-Insurance/dp/1946633828",
                    "excerpt": "History and claims processes - essential reading for understanding insurance disputes."
                },
                {
                    "title": "Claim Your Success: The Ultimate Guide to Starting and Running a Public Insurance Adjusting Business",
                    "url": "https://www.amazon.com/Claim-Your-Success-Insurance-Adjusting-ebook/dp/B0DPGJTQ71",
                    "coauthor": "Lynette Young",
                    "excerpt": "Blends legal mastery with operational expertise - strategies for mastering claims processes and developing marketing."
                },
                {
                    "title": "Mavericks and Merlins",
                    "url": "https://www.amazon.com/Mavericks-Merlins-Chip-Merlin/dp/1946633836",
                    "excerpt": "Personal memoir from sailing trip."
                }
            ],
            "articles": [
                {
                    "title": "The Mythical National Flood Claim Memo and Sandy Flood Claims",
                    "url": "https://www.propertyinsurancecoveragelaw.com/blog/the-mythical-national-flood-claim-memo-and-sandy-flood-claims",
                    "excerpt": "National Flood Insurance claims are different..."
                },
                {
                    "title": "Bad Faith by Delay: What About Timelines and the Duty to Move the Money?",
                    "url": "https://www.propertyinsurancecoveragelaw.com/blog/bad-faith-by-delay-mississippi/",
                    "excerpt": "Discusses bad faith claims related to delays in insurance payments."
                },
                {
                    "title": "The Hidden 'Wind-Driven Rain' Trap in Water Damage Claims",
                    "url": "https://www.propertyinsurancecoveragelaw.com/blog/wind-driven-rain-trap/",
                    "excerpt": "Addresses disputes in water damage claims involving 'wind-driven rain' exclusions."
                }
            ],
            "resources": [
                {"type": "Law Firm", "url": "https://www.merlinlawgroup.com/", "description": "Hurricane, water, hail, wildfire, wind damage claims"},
                {"type": "Blog", "url": "https://www.propertyinsurancecoveragelaw.com/", "description": "1000+ posts on coverage issues, state-specific guides"},
                {"type": "eBook", "url": "https://page.merlinlawgroup.com/hubfs/Ebook/Why_Merlin_Ebook.pdf%20FINAL.pdf", "description": "Why Merlin? firm guide"}
            ],
            "key_insights": [
                "Bad faith occurs when carriers unreasonably delay or deny claims",
                "Wind-driven rain exclusions are often misapplied by carriers",
                "Document everything - the carrier certainly is",
                "Katrina and Sandy showed systemic carrier failures"
            ]
        },
        {
            "id": "lynette-young",
            "name": "Lynette Young",
            "alias": None,
            "category": "Public Adjusting Business",
            "bio": "Lynette Young is a public adjusting consultant, co-founder of ClaimWizard software, with 28+ years optimizing firms across 5 countries. Co-author with Chip Merlin on business guides, focuses on growth strategies, AI in claims, and franchising.",
            "expertise": [
                "Public adjusting firm operations",
                "Claims workflow automation",
                "AI in public adjusting",
                "Business franchising",
                "Client acquisition strategies"
            ],
            "books": [
                {
                    "title": "Claim Your Success",
                    "url": "https://www.amazon.com/Claim-Your-Success-Insurance-Adjusting-ebook/dp/B0DPGJTQ71",
                    "coauthor": "Chip Merlin",
                    "excerpt": "A comprehensive guide equipping first-party insurance entrepreneurs with knowledge and strategies for successful public adjusting business."
                },
                {
                    "title": "The AI-Powered Public Adjuster",
                    "url": "https://www.amazon.com/dp/B0FMKKNCZ1",
                    "coauthor": "Dave Young",
                    "excerpt": "ADJUSTER Framework™ - a playbook to streamline work, protect clients, and scale your firm using AI."
                },
                {
                    "title": "How to Franchise Your Public Adjusting Company",
                    "url": "https://a.co/d/aeORwZb",
                    "excerpt": "Guide to franchising in public adjusting."
                }
            ],
            "articles": [
                {
                    "title": "Creating a Client Acquisition Playbook for Public Adjusters",
                    "url": "https://lynetteyoung.com/creating-a-client-acquisition-playbook-for-public-adjusters",
                    "excerpt": "Build a playbook that attracts the right clients, nurtures them smart, and helps close deals."
                },
                {
                    "title": "Beyond the To-Do List: The Public Adjuster's Guide to Time Management",
                    "url": "https://claimwizard.com/beyond-the-to-do-list-the-public-adjusters-guide-to-time-management",
                    "excerpt": "Transform your public adjusting firm into a thriving, profitable operation."
                }
            ],
            "resources": [
                {"type": "Website", "url": "https://lynetteyoung.com/", "description": "Content on business growth, AI in claims, 7Seas Coaching Program"},
                {"type": "Software", "url": "https://claimwizard.com/", "description": "ClaimWizard CRM - workflow automation for public adjusters"},
                {"type": "YouTube", "url": "https://www.youtube.com/watch?v=yqnCkQkYO4Y", "description": "ClaimWizard history and features"}
            ],
            "key_insights": [
                "AI can streamline public adjusting workflows significantly",
                "Client acquisition requires a systematic playbook",
                "Time management separates successful firms from struggling ones",
                "ClaimWizard automates the claims lifecycle"
            ]
        },
        {
            "id": "bill-wilson",
            "name": "Bill Wilson",
            "alias": None,
            "credentials": "CPCU, ARM, AIM, AAM",
            "category": "Insurance Coverage",
            "bio": "Bill Wilson is an insurance coverage expert, founder of InsuranceCommentary.com, retired from Independent Insurance Agents & Brokers of America. Author with 50+ years experience in policy language and claims disputes. The U.S.A.'s foremost authority on insurance policy language.",
            "expertise": [
                "Insurance policy language interpretation",
                "Coverage disputes resolution",
                "Policy exclusions analysis",
                "Claims denial challenges",
                "ISO policy forms"
            ],
            "books": [
                {
                    "title": "When Words Collide: Resolving Insurance Coverage and Claims Disputes",
                    "url": "https://www.amazon.com/When-Words-Collide-Resolving-Insurance/dp/1986596923",
                    "excerpt": "Written by Bill Wilson, the U.S.A.'s foremost authority on insurance policy language - practical and entertaining guide. The culmination of a legendary career stretching over six decades."
                },
                {
                    "title": "20/20 Vision: Why Insurance Doesn't Cover COVID-19",
                    "excerpt": "Pandemic claims analysis."
                }
            ],
            "articles": [
                {
                    "title": "Shrinkflation and Insurance",
                    "url": "https://insurancecommentary.com/shrinkflation-and-insurance/",
                    "excerpt": "Does 'shrinkflation' happen with insurance? If so, who is to blame?"
                },
                {
                    "title": "My Neighbor's Check Forgery Loss",
                    "url": "https://insurancecommentary.com/my-neighbors-check-forgery-loss/",
                    "excerpt": "A neighbor had an outgoing check stolen... her bank denies responsibility... no one mentioned insurance."
                },
                {
                    "title": "Poorly Worded Policy Language and Unintended Consequences",
                    "url": "https://insurancecommentary.com/poorly-worded-policy-language-and-unintended-consequences/",
                    "excerpt": "A homeowners insurer appears to be attempting to exclude coverage for e-bikes... the way they've worded the definition implies excluding much more."
                },
                {
                    "title": "One of the Most Often Misinterpreted Liability Exclusions",
                    "url": "https://insurancecommentary.com/one-of-the-most-often-misinterpreted-liability-exclusions/",
                    "excerpt": "ISO's BOP and CGL policies include a liability exclusion for aircraft, autos, and watercraft... just because an exception doesn't apply doesn't mean the exclusion applies."
                }
            ],
            "resources": [
                {"type": "Blog", "url": "https://insurancecommentary.com/", "description": "Articles on exclusions and policy interpretation - 50+ years experience"},
                {"type": "eBook", "url": "https://www.amazon.com/Greatest-Things-Anyone-Ever-Said-ebook/dp/B075FDDN1C", "description": "52 of the Greatest Things Anyone Ever Said - free PDF of QuoteNotes with purchase"}
            ],
            "key_insights": [
                "Policy language is often ambiguous - favor the insured interpretation",
                "Just because an exception doesn't apply doesn't mean the exclusion applies",
                "ISO forms have specific meanings that carriers often misapply",
                "50+ years of experience shows patterns in carrier behavior"
            ]
        },
        {
            "id": "john-voelpel",
            "name": "John A. Voelpel III",
            "alias": None,
            "category": "Insurance Appraisal",
            "bio": "John A. Voelpel III is an insurance appraisal specialist, past president of WIND (Windstorm Insurance Network). Expert in resolving disputed insurance claims through appraisal. Has taught WIND's sold-out appraisal courses for over twenty years.",
            "expertise": [
                "Insurance appraisal process",
                "Dispute resolution",
                "Appraiser/umpire selection",
                "Appraisal award execution",
                "Windstorm claims"
            ],
            "books": [
                {
                    "title": "The Appraisal Process: Resolution of Disputed Insurance Claims",
                    "url": "https://www.amazon.com/Appraisal-Process-Resolution-Disputed-Insurance/dp/B0CV6KGSPC",
                    "excerpt": "Written for insurance claims professionals desiring deeper understanding of appraisal. Covers history to practical issues in appraisal, appendix with documents."
                }
            ],
            "articles": [
                {
                    "title": "Book Review: The Appraisal Process",
                    "url": "https://www.propertyinsurancecoveragelaw.com/blog/the-appraisal-process-resolution-of-disputed-insurance-claims-by-john-a-voelpel-iii",
                    "excerpt": "Those involved in insurance appraisals should purchase John Voelpel's new book... taught Windstorm Insurance Networks sold-out appraisal courses for over twenty years."
                }
            ],
            "resources": [
                {"type": "Amazon", "url": "https://www.amazon.com/Appraisal-Process-Resolution-Disputed-Insurance/dp/B0CV6KGSPC", "description": "Hardcover and Kindle editions"}
            ],
            "key_insights": [
                "Appraisal is often faster and cheaper than litigation",
                "Proper appraiser selection is critical",
                "Umpire should be truly neutral",
                "Document all communications in appraisal process"
            ]
        }
    ],
    "leadership_mentors": [
        {
            "id": "simon-sinek",
            "name": "Simon Sinek",
            "category": "Leadership",
            "bio": "Leadership expert and author of 'Start With Why.' Focuses on building trust, inspiring teams, and purpose-driven leadership.",
            "relevance": "Team building and firm leadership in public adjusting",
            "books": [
                {
                    "title": "Leaders Eat Last: Why Some Teams Pull Together and Others Don't",
                    "url": "https://www.amazon.com/Leaders-Eat-Last-Together-Others/dp/1591848016",
                    "excerpt": "Expanded chapter on leading millennials. Understanding how to build teams that trust each other."
                },
                {
                    "title": "Start With Why",
                    "excerpt": "How great leaders inspire everyone to take action."
                }
            ],
            "resources": [
                {"type": "TED Talks", "url": "https://www.ted.com/speakers/simon_sinek", "description": "Videos on leadership and inspiration"}
            ],
            "key_insights": [
                "Great leaders put their team first",
                "Purpose drives engagement more than profit",
                "Trust is built through consistent actions",
                "Leaders create safe environments for risk-taking"
            ]
        },
        {
            "id": "jocko-willink",
            "name": "Jocko Willink",
            "category": "Leadership",
            "bio": "Former Navy SEAL commander, co-author with Leif Babin on leadership through accountability. Host of Jocko Podcast.",
            "relevance": "Discipline, ownership, and high-stakes decision making for claims",
            "books": [
                {
                    "title": "Extreme Ownership: How U.S. Navy SEALs Lead and Win",
                    "url": "https://www.amazon.com/Extreme-Ownership-U-S-Navy-SEALs/dp/1250183863",
                    "coauthor": "Leif Babin",
                    "excerpt": "#1 New York Times bestseller - leadership principles from the battlefield applied to business."
                },
                {
                    "title": "The Dichotomy of Leadership",
                    "excerpt": "Balancing competing forces as a leader."
                }
            ],
            "resources": [
                {"type": "Podcast", "url": "https://jockopodcast.com/", "description": "Insights for high-stakes environments"}
            ],
            "key_insights": [
                "Take ownership of everything in your world",
                "There are no bad teams, only bad leaders",
                "Discipline equals freedom",
                "Decentralize command - empower your team"
            ]
        },
        {
            "id": "alex-hormozi",
            "name": "Alex Hormozi",
            "category": "Business Growth",
            "bio": "Entrepreneur, investor, and author who scaled multiple businesses past $100M+. Founder of Acquisition.com, a portfolio of companies generating $200M+ annually. Known for his frameworks on offers, lead generation, and scaling service businesses. His no-BS approach to business building resonates with operators who want to grow fast and profitably.",
            "relevance": "Offer creation, lead generation, scaling a service-based firm, pricing strategy, and client acquisition for public adjusting",
            "books": [
                {
                    "title": "$100M Offers: How to Make Offers So Good People Feel Stupid Saying No",
                    "url": "https://www.amazon.com/100M-Offers-People-Stupid-Saying/dp/1737475731",
                    "excerpt": "How to create Grand Slam Offers that are so compelling your prospects feel stupid saying no."
                },
                {
                    "title": "$100M Leads: How to Get Strangers to Want to Buy Your Stuff",
                    "url": "https://www.amazon.com/100M-Leads-Strangers-Want-Your/dp/1737475774",
                    "excerpt": "The advertising playbook that generated $200M+ in revenue."
                }
            ],
            "resources": [
                {"type": "YouTube", "url": "https://www.youtube.com/@AlexHormozi", "description": "Business growth tactics, free education on scaling"},
                {"type": "Website", "url": "https://www.acquisition.com/", "description": "Portfolio company and business resources"}
            ],
            "key_insights": [
                "Make your offer so good people feel stupid saying no",
                "Volume negates luck - take more shots",
                "Price on value delivered, not time spent",
                "The best marketing is a great product with happy customers",
                "Speed to lead is everything in service businesses"
            ]
        },
        {
            "id": "dan-martell",
            "name": "Dan Martell",
            "category": "Business Growth",
            "bio": "SaaS entrepreneur, angel investor, and bestselling author. Founder of SaaS Academy, the #1 coaching community for B2B SaaS founders. Built and sold multiple companies including Clarity.fm. Known for teaching founders to 'buy back their time' by building systems and delegating effectively. His frameworks apply to any service business looking to scale beyond the founder.",
            "relevance": "Time management, delegation, building systems, scaling operations, and avoiding founder burnout in a growing PA firm",
            "books": [
                {
                    "title": "Buy Back Your Time: Get Unstuck, Reclaim Your Freedom, and Build Your Empire",
                    "url": "https://www.amazon.com/Buy-Back-Your-Time-Unstuck/dp/0593422783",
                    "excerpt": "How to delegate effectively and build systems so you can focus on what matters most."
                }
            ],
            "resources": [
                {"type": "YouTube", "url": "https://www.youtube.com/@DanMartell", "description": "Scaling businesses, time management, leadership"},
                {"type": "Website", "url": "https://www.danmartell.com/", "description": "SaaS Academy and business coaching"}
            ],
            "key_insights": [
                "Buy back your time - delegate everything below your hourly rate",
                "If you can't replace yourself, you can't scale",
                "Build the playbook before you hire the player",
                "Energy audit: eliminate, delegate, or automate low-value tasks",
                "Pain of staying the same must exceed the pain of change"
            ]
        },
        {
            "id": "pastor-miguel-delgado",
            "name": "Pastor Miguel Delgado",
            "category": "Faith & Purpose",
            "bio": "CEO of Zone 5, pastor, and visionary leader. Combines faith-driven purpose with entrepreneurial execution. His leadership centers on building people up, creating culture, and operating with integrity in everything. A mentor who models that business success and spiritual grounding are not in conflict — they amplify each other.",
            "relevance": "Purpose-driven leadership, culture building, integrity in business, and leading a team with conviction",
            "books": [],
            "resources": [],
            "key_insights": [
                "Lead with purpose and the results will follow",
                "Build people first, then they build the business",
                "Culture is not what you say — it's what you tolerate",
                "Integrity is doing the right thing when no one is watching"
            ]
        },
        {
            "id": "dr-rodney-howard-browne",
            "name": "Dr. Rodney Howard-Browne",
            "category": "Faith & Purpose",
            "bio": "Founder and senior pastor of The River at Tampa Bay Church and Revival Ministries International. A globally recognized evangelist and author who has ministered in over 40 countries. Known for bold faith, revival culture, and building one of the largest churches in the Tampa Bay area. His teachings on faith, perseverance, and vision inspire leaders to think bigger and never settle.",
            "relevance": "Bold faith, perseverance through adversity, vision casting, and building something that outlasts you",
            "books": [
                {
                    "title": "The Touch of God",
                    "excerpt": "Foundational teaching on experiencing God's presence and power."
                },
                {
                    "title": "Seeing Jesus As He Really Is",
                    "excerpt": "A fresh look at the person of Christ and what it means for daily life."
                }
            ],
            "resources": [
                {"type": "Website", "url": "https://www.revival.com/", "description": "Revival Ministries International"},
                {"type": "Church", "url": "https://www.theriver.org/", "description": "The River at Tampa Bay Church"}
            ],
            "key_insights": [
                "Faith without action is dead — move boldly",
                "Build something that outlasts your lifetime",
                "Never let circumstances dictate your vision",
                "Perseverance through adversity is what separates dreamers from builders"
            ]
        },
        {
            "id": "pastor-alex-burgos",
            "name": "Pastor Alex Burgos",
            "category": "Faith & Purpose",
            "bio": "Pastor at The River Orlando, a faith leader committed to building community, developing leaders, and empowering people to walk in their calling. His approach to ministry mirrors great business leadership — invest in people, create systems of discipleship, and lead by example. A mentor who demonstrates that serving others is the highest form of leadership.",
            "relevance": "Servant leadership, community building, investing in people, and leading by example",
            "books": [],
            "resources": [],
            "key_insights": [
                "Serve first, lead second",
                "Your calling is bigger than your comfort zone",
                "Invest in people and they will invest in the mission",
                "Consistency builds trust — show up every day"
            ]
        }
    ]
}


# Florida Public Adjusting Laws - Current as of February 2026
FLORIDA_PA_LAWS = {
    "description": "Comprehensive Florida-specific statutes, regulations, and laws relevant to public adjusting and insurance claims handling. Current as of February 2026.",
    "key_statutes": [
        {
            "id": "626.854",
            "statute": "Florida Statute 626.854 - 'Public Adjuster' Defined; Prohibitions",
            "summary": "Defines public adjusters and their prohibitions",
            "details": """Defines a public adjuster as any person (except licensed attorneys exempted under s. 626.860) who, for compensation, prepares, completes, or files insurance claims for insureds or third-party claimants, or negotiates settlements on behalf of policyholders.

Key Prohibitions:
• Cannot provide legal advice or handle bodily injury/death claims
• Cannot solicit between 8 p.m. and 8 a.m. or on Sundays
• Must provide a copy of executed contract to insured immediately and to insurer within 7 days
• Cannot charge fees on claims denied or paid in full before contract execution
• During emergencies, additional restrictions on solicitation and fees apply""",
            "source_url": "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699%2F0626%2FSections%2F0626.854.html",
            "last_updated": "2025 Florida Statutes; current in 2026"
        },
        {
            "id": "626.865",
            "statute": "Florida Statute 626.865 - Public Adjuster's Qualifications, Bond",
            "summary": "Licensing requirements and bond obligations",
            "details": """Requirements for public adjuster license:
• Pay required fees
• Pass examination
• Submit fingerprints
• File a $50,000 surety bond conditioned on faithful performance
• Have at least 1 year of experience OR complete approved courses
• Maintain continuing education (24 hours biennially)

Disciplinary actions for violations include suspension or revocation.""",
            "source_url": "https://www.flsenate.gov/Laws/Statutes/2024/0626.865",
            "last_updated": "2025 Florida Statutes; current in 2026"
        },
        {
            "id": "626.8651",
            "statute": "Florida Statute 626.8651 - Public Adjuster Apprentice",
            "summary": "Apprentice requirements and limitations",
            "details": """Apprentice requirements:
• Must be licensed all-lines adjuster
• File a $50,000 bond
• Be supervised by a licensed public adjuster
• Firms can appoint up to four apprentices simultaneously
• Supervisors limited to four apprentices

Limitations:
• Apprentices assist in ascertaining losses only
• Cannot sign contracts independently
• Cannot negotiate settlements independently
• Appointment valid for 18 months""",
            "source_url": "https://www.flsenate.gov/Laws/Statutes/2025/626.8651",
            "last_updated": "2025 Florida Statutes; current in 2026"
        },
        {
            "id": "626.8795",
            "statute": "Florida Statute 626.8795 - Prohibition of Conflict of Interest",
            "summary": "Conflict of interest prohibitions",
            "details": """Public adjusters CANNOT:
• Participate in reconstruction, repair, or restoration of property they adjust (directly or indirectly)
• Have financial interests in contractors or suppliers involved in the claim

This is critical for maintaining objectivity and avoiding conflicts.""",
            "source_url": "https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0600-0699%2F0626%2FSections%2F0626.8795.html",
            "last_updated": "2025 Florida Statutes; current in 2026"
        },
        {
            "id": "626.8796",
            "statute": "Florida Statute 626.8796 - Public Adjuster Contracts",
            "summary": "Contract requirements and disclosures",
            "details": """Contract requirements:
• Must be in writing
• At least 12-point type
• Titled 'Public Adjuster Contract'
• Include fraud warning in 18-point bold type
• Detail adjuster/insured information, services, compensation, and rescission rights

Rescission Rights:
• Insured can rescind if no written estimate submitted to insurer within 60 days (unless extenuating circumstances)
• Must include statement on potential fee reductions if claim amount decreases

Non-compliant contracts are INVALID and UNENFORCEABLE.""",
            "source_url": "https://www.flsenate.gov/Laws/Statutes/2024/0626.8796",
            "last_updated": "2025 Florida Statutes; see SB 266 for potential extensions"
        },
        {
            "id": "fee-structures",
            "statute": "Fee Structures and Caps (626.854 and Related Rules)",
            "summary": "Maximum fees and emergency caps",
            "details": """Maximum Fee Structure:
• Standard residential/condo claims: 20% maximum
• During state of emergency: 10% maximum for one year post-event
• If insurer commits to full policy limits early: 1% maximum

Prohibited Fees:
• No fees on denied claims
• No fees on amounts paid before contract execution
• Emergency declarations cap at 10% for one year""",
            "source_url": "https://flsenate.gov/Session/Bill/2026/266/Analyses/2026s00266.bi.PDF",
            "last_updated": "2025 Statutes; confirmed current in 2026"
        },
        {
            "id": "69B-220.201",
            "statute": "Code of Ethics for Public Adjusters (69B-220.201, F.A.C.)",
            "summary": "Ethical standards and record-keeping",
            "details": """Code of Ethics Requirements:
• Prioritize fair treatment of claimants over personal interests
• Treat all claimants equally without favoritism
• Adhere strictly to insurance contracts
• Avoid conflicts of interest
• Maintain records for 5 years
• Use electronic estimating programs during emergencies
• Retain ALL estimate versions for transparency

Updated via Emergency Rule 69BER24-4 (2024, still effective in 2026).""",
            "source_url": "https://www.propertyinsurancecoveragelaw.com/blog/florida-adjuster-and-public-adjuster-codes-of-ethics",
            "last_updated": "Emergency Rule 69BER24-4 (2024); effective in 2026"
        },
        {
            "id": "claims-timelines",
            "statute": "Claims Handling Timelines (SB 7052)",
            "summary": "Required response and payment timelines",
            "details": """Insurer Obligations:
• Acknowledge claims within 7 days
• Provide status updates every 14 days
• Pay or deny within 60 days of proof of loss

Public Adjuster Obligations:
• Submit estimates promptly
• Maintain transparency in estimate submissions""",
            "source_url": "https://krapflegal.com/recources/property-damage/florida-insurance-reform-2025",
            "last_updated": "SB 7052 (2025); effective July 1, 2025; current in 2026"
        },
        {
            "id": "aob-reforms",
            "statute": "Assignment of Benefits (AOB) Reforms",
            "summary": "AOB prohibitions",
            "details": """Key Points:
• Post-loss AOBs are PROHIBITED to prevent fraud
• Public adjusters CANNOT use AOBs for claims
• Policyholders must handle claims directly

This reform was implemented to combat widespread AOB abuse in Florida.""",
            "source_url": "https://www.genre.com/us/knowledge/publications/2023/february/florida-sb-2A-notable-changes-to-florida-property-insurance-regulations-en",
            "last_updated": "Effective since 2023; confirmed no reversals in 2026"
        },
        {
            "id": "appraisal",
            "statute": "Appraisal Process in Claims",
            "summary": "Appraisal procedures and limitations",
            "details": """Appraisal Process:
• For disputed claims, appraisal can be invoked if policy allows
• Public adjusters can assist but CANNOT act as appraisers if conflicted
• Recent reforms prohibit bad faith claims based solely on appraisal awards

Note: John Voelpel III's book 'The Appraisal Process' is the definitive guide.""",
            "source_url": "https://www.genre.com/us/knowledge/publications/2023/february/florida-sb-2A-notable-changes-to-florida-property-insurance-regulations-en",
            "last_updated": "From SB 2A (2023); current in 2026"
        }
    ],
    "recent_updates_2026": [
        {
            "id": "sb-266",
            "bill": "Senate Bill 266 (2026) - Public Adjuster Contracts",
            "summary": "Extends rescission period to 10 days",
            "details": "Extends rescission period to 10 days without penalty. Clarifies that insureds can cancel within 10 days after contract execution.",
            "source_url": "https://legiscan.com/FL/text/S0266/id/3274475/Florida-2026-S0266-Introduced.html",
            "status": "Introduced January 2026; advancing as of February 4, 2026"
        },
        {
            "id": "hb-427",
            "bill": "House Bill 427 (2026) - Public Adjuster Contracts",
            "summary": "Clarifies disciplinary acts for PAs",
            "details": "Authorizes rescission by certain persons; clarifies acts that subject public adjusters to discipline, including non-compliance with contract requirements.",
            "source_url": "https://trackbill.com/bill/florida-house-bill-427-public-adjuster-contracts/2749649",
            "status": "Introduced 2026; no final passage as of February 4, 2026"
        },
        {
            "id": "hb-527",
            "bill": "House Bill 527 / Senate Bill 202 (2026) - AI in Claims Handling",
            "summary": "Requires human review for AI-denied claims",
            "details": "Requires mandatory human review for claim denials based on AI/algorithms; cannot deny solely on AI output. Insurers must detail AI use in claims manuals. Applies to public adjusters interacting with AI-processed claims.",
            "source_url": "https://www.jdsupra.com/legalnews/new-proposed-legislation-in-florida-9848816",
            "status": "Filed November 2025; passed subcommittee December 2025; advancing in 2026"
        },
        {
            "id": "hb-459",
            "bill": "House Bill 459 (2025) - Disputed Claims Resolution",
            "summary": "Formal process for disputed claims",
            "details": "Establishes formal process for disputed property claims, potentially involving public adjusters in mediation/appraisal steps.",
            "source_url": "https://boggslawgroup.com/what-floridas-new-insurance-laws-mean-for-2026",
            "status": "Passed 2025; effective 2026"
        }
    ],
    "key_numbers": {
        "max_fee_standard": "20%",
        "max_fee_emergency": "10%",
        "max_fee_policy_limits": "1%",
        "surety_bond": "$50,000",
        "record_retention_years": 5,
        "ce_hours_biennial": 24,
        "apprentice_term_months": 18,
        "max_apprentices_per_firm": 4,
        "max_apprentices_per_supervisor": 4,
        "claim_acknowledgment_days": 7,
        "claim_status_update_days": 14,
        "claim_pay_deny_days": 60,
        "contract_rescission_days": 10,
        "estimate_submission_days": 60
    },
    "resources": [
        {"type": "Official Statutes", "url": "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0600-0699%2F0626%2F0626ContentsIndex.html", "description": "Full Chapter 626 (2025 Florida Statutes)"},
        {"type": "DFS Licensing", "url": "https://myfloridacfo.com/division/agents/licensing/agents-adjusters/adjusters", "description": "Florida DFS licensing and rules"},
        {"type": "Legal Updates Blog", "url": "https://www.propertyinsurancecoveragelaw.com/tags/florida/", "description": "Recent Florida insurance law changes"}
    ]
}


# Pydantic models
class ExpertSummary(BaseModel):
    id: str
    name: str
    alias: Optional[str]
    category: str
    bio: str


class ExpertDetail(BaseModel):
    id: str
    name: str
    alias: Optional[str]
    category: str
    bio: str
    expertise: List[str]
    books: List[dict]
    articles: List[dict]
    resources: List[dict]
    key_insights: List[str]


@router.get("/experts")
async def get_all_experts():
    """Get all industry experts (summary view)"""
    experts = []
    for figure in INDUSTRY_EXPERTS["figures"]:
        experts.append({
            "id": figure["id"],
            "name": figure["name"],
            "alias": figure.get("alias"),
            "category": figure["category"],
            "bio": figure["bio"][:200] + "..." if len(figure["bio"]) > 200 else figure["bio"],
            "expertise_count": len(figure.get("expertise", [])),
            "books_count": len(figure.get("books", [])),
            "articles_count": len(figure.get("articles", []))
        })
    return {"experts": experts, "count": len(experts)}


@router.get("/experts/{expert_id}")
async def get_expert_detail(expert_id: str):
    """Get detailed information about a specific expert"""
    for figure in INDUSTRY_EXPERTS["figures"]:
        if figure["id"] == expert_id:
            return figure
    raise HTTPException(status_code=404, detail="Expert not found")


@router.get("/mentors")
async def get_leadership_mentors():
    """Get leadership mentors"""
    return {"mentors": INDUSTRY_EXPERTS["leadership_mentors"]}


@router.get("/search")
async def search_knowledge_base(q: str):
    """Search across all experts and their content"""
    query = q.lower()
    results = []
    
    for figure in INDUSTRY_EXPERTS["figures"]:
        score = 0
        matches = []
        
        # Check name
        if query in figure["name"].lower():
            score += 10
            matches.append("name")
        
        # Check bio
        if query in figure["bio"].lower():
            score += 5
            matches.append("bio")
        
        # Check expertise
        for exp in figure.get("expertise", []):
            if query in exp.lower():
                score += 3
                matches.append(f"expertise: {exp}")
        
        # Check key insights
        for insight in figure.get("key_insights", []):
            if query in insight.lower():
                score += 2
                matches.append(f"insight: {insight}")
        
        # Check articles
        for article in figure.get("articles", []):
            if query in article.get("title", "").lower() or query in article.get("excerpt", "").lower():
                score += 2
                matches.append(f"article: {article.get('title', '')}")
        
        if score > 0:
            results.append({
                "expert_id": figure["id"],
                "name": figure["name"],
                "category": figure["category"],
                "score": score,
                "matches": matches[:5]  # Top 5 matches
            })
    
    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    
    return {"results": results, "query": q}


@router.get("/for-eve")
async def get_knowledge_for_eve(topic: Optional[str] = None):
    """
    Get formatted knowledge base content for Eve AI context.
    This endpoint provides expert insights relevant to the given topic.
    """
    if not topic:
        # Return all key insights compiled
        all_insights = []
        for figure in INDUSTRY_EXPERTS["figures"]:
            expert_insights = {
                "expert": figure["name"],
                "category": figure["category"],
                "insights": figure.get("key_insights", [])
            }
            all_insights.append(expert_insights)
        return {"context": all_insights}
    
    # Search for topic-relevant content
    topic_lower = topic.lower()
    relevant_content = []
    
    for figure in INDUSTRY_EXPERTS["figures"]:
        relevance = 0
        expert_content = {
            "expert": figure["name"],
            "category": figure["category"],
            "relevant_insights": [],
            "relevant_expertise": []
        }
        
        # Check expertise
        for exp in figure.get("expertise", []):
            if topic_lower in exp.lower():
                expert_content["relevant_expertise"].append(exp)
                relevance += 2
        
        # Check key insights
        for insight in figure.get("key_insights", []):
            if topic_lower in insight.lower():
                expert_content["relevant_insights"].append(insight)
                relevance += 3
        
        # Check category
        if topic_lower in figure["category"].lower():
            relevance += 5
        
        if relevance > 0:
            expert_content["relevance_score"] = relevance
            relevant_content.append(expert_content)
    
    # Sort by relevance
    relevant_content.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
    
    return {"topic": topic, "experts": relevant_content[:5]}


@router.get("/categories")
async def get_categories():
    """Get all unique expert categories"""
    categories = set()
    for figure in INDUSTRY_EXPERTS["figures"]:
        categories.add(figure["category"])
    for mentor in INDUSTRY_EXPERTS["leadership_mentors"]:
        categories.add(mentor["category"])
    return {"categories": sorted(list(categories))}


# ==================== FLORIDA LAWS ENDPOINTS ====================

@router.get("/florida-laws")
async def get_florida_laws():
    """Get all Florida public adjusting laws and statutes"""
    return {
        "description": FLORIDA_PA_LAWS["description"],
        "statutes_count": len(FLORIDA_PA_LAWS["key_statutes"]),
        "recent_updates_count": len(FLORIDA_PA_LAWS["recent_updates_2026"]),
        "key_numbers": FLORIDA_PA_LAWS["key_numbers"],
        "resources": FLORIDA_PA_LAWS["resources"]
    }


@router.get("/florida-laws/statutes")
async def get_florida_statutes():
    """Get all Florida PA statutes with summaries"""
    statutes = []
    for statute in FLORIDA_PA_LAWS["key_statutes"]:
        statutes.append({
            "id": statute["id"],
            "statute": statute["statute"],
            "summary": statute["summary"],
            "source_url": statute.get("source_url"),
            "last_updated": statute.get("last_updated")
        })
    return {"statutes": statutes, "count": len(statutes)}


@router.get("/florida-laws/statutes/{statute_id}")
async def get_florida_statute_detail(statute_id: str):
    """Get detailed information about a specific Florida statute"""
    for statute in FLORIDA_PA_LAWS["key_statutes"]:
        if statute["id"] == statute_id:
            return statute
    raise HTTPException(status_code=404, detail="Statute not found")


@router.get("/florida-laws/updates")
async def get_florida_law_updates():
    """Get recent Florida law updates and pending legislation"""
    return {
        "updates": FLORIDA_PA_LAWS["recent_updates_2026"],
        "count": len(FLORIDA_PA_LAWS["recent_updates_2026"])
    }


@router.get("/florida-laws/key-numbers")
async def get_florida_key_numbers():
    """Get key numbers and limits for Florida PA regulations"""
    return FLORIDA_PA_LAWS["key_numbers"]


@router.get("/florida-laws/search")
async def search_florida_laws(q: str):
    """Search Florida laws and statutes"""
    query = q.lower()
    results = []
    
    # Search statutes
    for statute in FLORIDA_PA_LAWS["key_statutes"]:
        score = 0
        matches = []
        
        if query in statute["statute"].lower():
            score += 10
            matches.append("statute name")
        
        if query in statute.get("summary", "").lower():
            score += 5
            matches.append("summary")
        
        if query in statute.get("details", "").lower():
            score += 3
            matches.append("details")
        
        if score > 0:
            results.append({
                "type": "statute",
                "id": statute["id"],
                "title": statute["statute"],
                "summary": statute["summary"],
                "score": score,
                "matches": matches
            })
    
    # Search recent updates
    for update in FLORIDA_PA_LAWS["recent_updates_2026"]:
        score = 0
        matches = []
        
        if query in update["bill"].lower():
            score += 10
            matches.append("bill name")
        
        if query in update.get("summary", "").lower():
            score += 5
            matches.append("summary")
        
        if query in update.get("details", "").lower():
            score += 3
            matches.append("details")
        
        if score > 0:
            results.append({
                "type": "update",
                "id": update["id"],
                "title": update["bill"],
                "summary": update["summary"],
                "status": update.get("status"),
                "score": score,
                "matches": matches
            })
    
    results.sort(key=lambda x: x["score"], reverse=True)
    return {"results": results, "query": q}


@router.get("/florida-laws/for-eve")
async def get_florida_laws_for_eve(topic: Optional[str] = None):
    """
    Get Florida law context for Eve AI.
    Returns relevant statutes and regulations based on the topic.
    """
    if not topic:
        # Return key numbers and most important statutes
        return {
            "key_numbers": FLORIDA_PA_LAWS["key_numbers"],
            "critical_statutes": [
                s for s in FLORIDA_PA_LAWS["key_statutes"] 
                if s["id"] in ["626.854", "fee-structures", "626.8796", "claims-timelines"]
            ],
            "pending_legislation": FLORIDA_PA_LAWS["recent_updates_2026"]
        }
    
    topic_lower = topic.lower()
    relevant_statutes = []
    
    for statute in FLORIDA_PA_LAWS["key_statutes"]:
        relevance = 0
        
        if topic_lower in statute["statute"].lower():
            relevance += 10
        if topic_lower in statute.get("summary", "").lower():
            relevance += 5
        if topic_lower in statute.get("details", "").lower():
            relevance += 3
        
        if relevance > 0:
            relevant_statutes.append({
                "statute": statute["statute"],
                "summary": statute["summary"],
                "details": statute["details"],
                "relevance": relevance
            })
    
    relevant_statutes.sort(key=lambda x: x["relevance"], reverse=True)
    
    return {
        "topic": topic,
        "relevant_statutes": relevant_statutes[:5],
        "key_numbers": FLORIDA_PA_LAWS["key_numbers"]
    }
