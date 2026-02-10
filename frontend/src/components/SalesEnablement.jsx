import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  DoorOpen, ChevronRight, ChevronLeft, Check, MessageSquare, AlertCircle,
  FileText, Calendar, ClipboardCheck, Users, Shield, Target, Sparkles,
  Wind, Droplets, Flame, Clock, X, Home, Phone, Presentation, Play,
  Pause, RotateCcw, Volume2, VolumeX, ThumbsUp, ThumbsDown, ArrowRight,
  Zap, CloudRain, Snowflake, Eye, CheckCircle2
} from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';

// ============================================
// STORM/EVENT DATA
// ============================================
const ACTIVE_STORMS = [
  {
    id: 'hurricane_milton',
    name: 'Hurricane Milton',
    type: 'hurricane',
    date: 'October 9-10, 2024',
    deadline: 'October 2025',
    regions: ['Tampa Bay', 'Orlando', 'Central Florida'],
    pitchLine: "We're in the neighborhood because the 1-year deadline to file for Hurricane Milton is coming up, and many people don't even realize they still have eligible damage."
  },
  {
    id: 'jan_31_wind',
    name: 'January 31, 2026 Wind Event',
    type: 'wind',
    date: 'January 31, 2026',
    deadline: 'January 2027',
    regions: ['Tampa Bay', 'Hillsborough County', 'Pinellas County'],
    pitchLine: "We're in the area because of the strong winds on January 31st. We've already seen some damage nearby that isn't always obvious from the ground."
  }
];

// ============================================
// OBJECTION RESPONSES
// ============================================
const OBJECTIONS = {
  'insurance_came': {
    title: "Insurance already came out",
    shortResponse: "Initial inspections often miss hidden damage. We've recovered funds for many homeowners after insurance came out.",
    fullResponse: "That's actually common. Initial inspections are often brief and can miss hidden damage — especially on roofs. We specialize in thorough documentation using technology that wasn't available before. We've recovered funds for many homeowners after insurance already came out. A second look costs you nothing and takes about 10 minutes."
  },
  'rates_raised': {
    title: "I don't want my rates raised",
    shortResponse: "In Florida, carriers cannot raise your rates because you filed a claim.",
    fullResponse: "In Florida, insurance carriers cannot raise your rates specifically because you filed a claim. Rates are set based on area-wide risk factors and company-wide claims data. Filing a legitimate claim is your contractual right — you've been paying premiums for exactly this situation."
  },
  'busy': {
    title: "We're busy right now",
    shortResponse: "Inspection takes 10 minutes. I can come back at a better time.",
    fullResponse: "I completely understand. The inspection itself only takes about 10 minutes, and you don't even need to be outside with me. Would it work better if I came back tomorrow around this time? Or I can leave my card and you can call when it's convenient."
  },
  'no_damage': {
    title: "We don't have any damage",
    shortResponse: "Most storm damage isn't visible from the ground. A quick check ensures peace of mind.",
    fullResponse: "Most storm damage isn't visible from the ground — especially hail hits and wind-lifted shingles. Many homeowners are surprised to find damage they didn't know existed. A 10-minute check gives you peace of mind, and if there's nothing, you've lost nothing."
  },
  'spouse': {
    title: "I need to talk to my spouse",
    shortResponse: "Absolutely. I can come back when you're both available.",
    fullResponse: "Absolutely, that makes sense. The inspection itself is free with no commitment — I'm just documenting what's there. I can come back when you're both available, or you can call me to schedule. What works better for you?"
  },
  'contractor': {
    title: "We already have a contractor",
    shortResponse: "Great! We work with your contractor. We handle insurance, they handle repairs.",
    fullResponse: "That's great! We actually work alongside contractors. Our role is specifically handling the insurance side — making sure you get the full payout you're entitled to. Your contractor handles the repairs. We make their job easier and your claim more complete."
  },
  'renter': {
    title: "I'm just renting",
    shortResponse: "Could you pass along my info to the homeowner?",
    fullResponse: "No problem at all. Would you be able to pass along my information to the homeowner? Or do you have a contact number for them? They may want to know about potential storm damage to their property."
  }
};

// ============================================
// LOSS-SPECIFIC PRESENTATION FLOWS
// ============================================
const LOSS_FLOWS = {
  wind: {
    name: 'Wind Damage',
    icon: Wind,
    color: 'orange',
    steps: [
      {
        id: 'opening',
        title: 'Opening',
        subtitle: 'Establish context',
        script: "Hi, I'm [NAME] with [COMPANY]. We're in the area documenting storm damage from the recent wind event on [DATE]. Many homes in this neighborhood have damage that's not visible from the ground.",
        tips: ['Make eye contact', 'Smile warmly', 'Stand 3-4 feet back from door'],
        objective: 'Create curiosity without being pushy'
      },
      {
        id: 'damage_frame',
        title: 'Damage Framing',
        subtitle: 'Educate on wind damage',
        script: "Wind damage often shows up as lifted shingles, cracked seals, or exposed nail heads. These might seem small, but they let water in and cause bigger problems over time. Insurance covers this type of damage, but there's a deadline to file.",
        tips: ['Point to roof while speaking', 'Use hand gestures', 'Reference specific date'],
        objective: 'Position yourself as knowledgeable'
      },
      {
        id: 'education',
        title: 'Education',
        subtitle: 'Explain the process',
        script: "What we do is a free inspection — I take photos from the ground and sometimes from a ladder. If there's damage, I document it and help you file with your insurance. If there's nothing, you've lost nothing. Either way, you'll know for sure.",
        tips: ['Emphasize FREE', 'Mention no obligation', 'Keep it simple'],
        objective: 'Remove barriers to saying yes'
      },
      {
        id: 'authority',
        title: 'Establish Authority',
        subtitle: 'Build credibility',
        script: "We're licensed public adjusters — that means we work for you, not the insurance company. We've helped [X] families in this area get their claims paid properly. The insurance company has their own adjusters; you deserve someone in your corner too.",
        tips: ['Mention license', 'Reference local success', 'Position as advocate'],
        objective: 'Differentiate from roofers/salespeople'
      },
      {
        id: 'close',
        title: 'Soft Close',
        subtitle: 'Get the inspection',
        script: "I can take a quick look right now — it only takes about 10 minutes and you don't even need to be outside with me. If there's damage, we'll talk about next steps. If not, at least you'll know. Sound fair?",
        tips: ['Lower your voice slightly', 'Pause after the question', 'Nod slightly'],
        objective: 'Get agreement for inspection'
      },
      {
        id: 'contract',
        title: 'Contract Introduction',
        subtitle: 'Transition to agreement',
        script: "I found [describe damage]. This is definitely claimable. Before I proceed with the full documentation, I need you to sign this agreement. It authorizes us to represent you with your insurance company. We only get paid if your claim gets approved — we take a percentage of what insurance pays out.",
        tips: ['Show damage photos', 'Explain contingency', 'No upfront cost'],
        objective: 'Get contract signed'
      },
      {
        id: 'expectations',
        title: 'Set Expectations',
        subtitle: 'Explain next steps',
        script: "Here's what happens next: I'll complete the full documentation today. We'll file the claim within 48 hours. Insurance typically sends their adjuster within 2-3 weeks. We'll be there for that inspection. Any questions should come to me first — I'm your point of contact now.",
        tips: ['Give timeline', 'Set single point of contact', 'Provide business card'],
        objective: 'Prevent confusion, establish relationship'
      }
    ]
  },
  hail: {
    name: 'Hail Damage',
    icon: CloudRain,
    color: 'cyan',
    steps: [
      {
        id: 'opening',
        title: 'Opening',
        subtitle: 'Establish context',
        script: "Hi, I'm [NAME] with [COMPANY]. We're documenting hail damage in the area from the storm on [DATE]. We've already found significant damage on several homes nearby.",
        tips: ['Reference specific storm date', 'Mention nearby homes', 'Create urgency without pressure'],
        objective: 'Create relevance'
      },
      {
        id: 'damage_frame',
        title: 'Damage Framing',
        subtitle: 'Educate on hail damage',
        script: "Hail damage is tricky because it's almost never visible from the ground. It shows up as small dents in shingles, cracked vents, and damaged gutters. These small hits break the protective granules and shorten your roof's life by years.",
        tips: ['Explain granule loss', 'Reference gutter/AC damage', 'Show concern for property'],
        objective: 'Establish hail as serious'
      },
      {
        id: 'education',
        title: 'Education',
        subtitle: 'Explain the process',
        script: "I do a free inspection — I'll check the roof, gutters, AC unit, and soft metals. Hail leaves a distinct pattern. If I find it, I photograph everything and handle your insurance claim. You pay nothing unless insurance pays.",
        tips: ['List inspection areas', 'Mention pattern recognition', 'Emphasize no-cost'],
        objective: 'Lower resistance'
      },
      {
        id: 'authority',
        title: 'Establish Authority',
        subtitle: 'Build credibility',
        script: "I've been trained specifically to identify hail damage patterns. Insurance adjusters sometimes miss it because they're not looking at the right places. We know exactly what to document and how to present it so your claim gets approved.",
        tips: ['Show expertise', 'Position against insurance', 'Confidence without arrogance'],
        objective: 'Build trust'
      },
      {
        id: 'close',
        title: 'Soft Close',
        subtitle: 'Get the inspection',
        script: "Let me take 10 minutes and check your roof. If there's hail damage, you'll want to know before the filing deadline. If not, no worries — you'll have peace of mind. I just need access to check the backyard.",
        tips: ['Be specific on time', 'Mention deadline', 'Ask for access casually'],
        objective: 'Get agreement'
      },
      {
        id: 'contract',
        title: 'Contract Introduction',
        subtitle: 'Transition to agreement',
        script: "Good news and bad news. Bad news: you definitely have hail damage — see these hits here? Good news: this is 100% covered by insurance. I need you to sign this authorization so I can file your claim. Remember, we only get paid if you get paid.",
        tips: ['Show physical evidence', 'Frame as good news', 'Contingency explanation'],
        objective: 'Get contract signed'
      },
      {
        id: 'expectations',
        title: 'Set Expectations',
        subtitle: 'Explain next steps',
        script: "I'll finish documenting today and file your claim this week. Expect a call from me within 48 hours confirming everything is submitted. When insurance sends their adjuster, I'll be there. Don't talk to insurance without me — that's what you hired us for.",
        tips: ['Clear timeline', 'Prevent DIY communication', 'Establish control'],
        objective: 'Set up for success'
      }
    ]
  },
  water: {
    name: 'Water Damage',
    icon: Droplets,
    color: 'blue',
    steps: [
      {
        id: 'opening',
        title: 'Opening',
        subtitle: 'Establish context',
        script: "Hi, I'm [NAME] with [COMPANY]. We're following up on the recent flooding/storm in the area. Water damage claims are time-sensitive, and we want to make sure homeowners know their options.",
        tips: ['Reference recent event', 'Emphasize time sensitivity', 'Position as helpful'],
        objective: 'Create urgency'
      },
      {
        id: 'damage_frame',
        title: 'Damage Framing',
        subtitle: 'Educate on water damage',
        script: "Water damage goes beyond what you can see. It gets into walls, under floors, into insulation. If not properly documented and dried, it leads to mold within 48-72 hours. Insurance covers water damage from storms, but the claim needs to be filed correctly.",
        tips: ['Mention hidden damage', 'Reference mold timeline', 'Scare slightly without fear-mongering'],
        objective: 'Establish stakes'
      },
      {
        id: 'education',
        title: 'Education',
        subtitle: 'Explain the process',
        script: "We use moisture meters and thermal cameras to find water you can't see. We document everything according to IICRC standards — that's the industry standard insurance companies respect. Then we file your claim with proper documentation.",
        tips: ['Mention technology', 'Reference IICRC', 'Sound professional'],
        objective: 'Demonstrate expertise'
      },
      {
        id: 'authority',
        title: 'Establish Authority',
        subtitle: 'Build credibility',
        script: "Water claims are complex — insurance companies often try to limit payouts or deny based on 'pre-existing conditions.' We know how to document the timeline and prove storm causation. That's why having us in your corner matters.",
        tips: ['Acknowledge complexity', 'Position against denial tactics', 'Advocate role'],
        objective: 'Build trust'
      },
      {
        id: 'close',
        title: 'Soft Close',
        subtitle: 'Get the inspection',
        script: "Can I come in and do a moisture check? It takes about 15 minutes and will tell us immediately if there's hidden water. If there is, we can help. If not, you'll know your home is dry. Can I take a look?",
        tips: ['Ask to enter home', 'Be specific on time', 'Frame as diagnostic'],
        objective: 'Get inside'
      },
      {
        id: 'contract',
        title: 'Contract Introduction',
        subtitle: 'Transition to agreement',
        script: "The readings show elevated moisture in [areas]. This needs to be addressed now before it becomes a mold issue. I can file your claim today, but I need you to authorize us to represent you. We handle everything from here.",
        tips: ['Show meter readings', 'Urgency on mold', 'Handle everything language'],
        objective: 'Get contract signed'
      },
      {
        id: 'expectations',
        title: 'Set Expectations',
        subtitle: 'Explain next steps',
        script: "First priority is stopping further damage — do you have a mitigation company? If not, we can recommend one. I'll file the claim today. Insurance should respond within [X] days. I'll coordinate everything and keep you updated.",
        tips: ['Mitigation urgency', 'Coordination role', 'Communication promise'],
        objective: 'Take control of situation'
      }
    ]
  },
  fire: {
    name: 'Fire Damage',
    icon: Flame,
    color: 'red',
    steps: [
      {
        id: 'opening',
        title: 'Opening',
        subtitle: 'Approach with sensitivity',
        script: "Hi, I'm [NAME] with [COMPANY]. I know this is an incredibly difficult time. We specialize in helping homeowners navigate fire damage claims. Is there anything I can help you with right now?",
        tips: ['Be gentle', 'Offer help first', 'Dont pitch immediately'],
        objective: 'Build rapport'
      },
      {
        id: 'damage_frame',
        title: 'Damage Framing',
        subtitle: 'Educate on fire damage',
        script: "Fire damage claims are some of the most complex. Beyond the visible damage, there's smoke damage, water damage from firefighting, structural concerns, and contents. Insurance companies often try to minimize these, but you're entitled to full restoration.",
        tips: ['Acknowledge complexity', 'List all damage types', 'Full restoration language'],
        objective: 'Set expectations high'
      },
      {
        id: 'education',
        title: 'Education',
        subtitle: 'Explain the process',
        script: "We document everything — structure, contents, additional living expenses if you can't stay here. We work with engineers and specialists to ensure nothing is missed. Insurance will send their adjuster, but we'll be there representing your interests.",
        tips: ['Comprehensive documentation', 'Mention specialists', 'ALE coverage'],
        objective: 'Demonstrate thoroughness'
      },
      {
        id: 'authority',
        title: 'Establish Authority',
        subtitle: 'Build credibility',
        script: "We've handled [X] fire claims. We know how insurance companies try to depreciate contents and limit structural payouts. Having a licensed public adjuster means you have someone who knows the policy language and fights for what you're owed.",
        tips: ['Reference experience', 'Depreciation warning', 'Policy expertise'],
        objective: 'Establish as essential'
      },
      {
        id: 'close',
        title: 'Soft Close',
        subtitle: 'Offer to help',
        script: "I don't want to overwhelm you right now. What I can do is start documenting everything while it's fresh. The sooner we begin, the stronger your claim. Would it be okay if I took some photos and notes? No commitment required yet.",
        tips: ['Low pressure', 'Offer to start', 'No commitment yet'],
        objective: 'Get permission to document'
      },
      {
        id: 'contract',
        title: 'Contract Introduction',
        subtitle: 'Transition to agreement',
        script: "Based on what I've seen, this claim could be substantial. I want to make sure you get everything you're entitled to. This agreement authorizes us to handle your claim. We work on contingency — we only get paid when you get paid. Can I explain the terms?",
        tips: ['Substantial claim framing', 'Explain contingency clearly', 'Offer to explain'],
        objective: 'Get contract signed'
      },
      {
        id: 'expectations',
        title: 'Set Expectations',
        subtitle: 'Support and next steps',
        script: "Here's what happens: I'll complete documentation over the next few days. We'll file the claim immediately. I'll help you find temporary housing if needed — that's covered. I'll be your single point of contact. Any questions from insurance come through me.",
        tips: ['Multi-day documentation', 'Temporary housing', 'Single contact point'],
        objective: 'Provide stability'
      }
    ]
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
const SalesEnablement = () => {
  const [mode, setMode] = useState('home');
  const [selectedLossType, setSelectedLossType] = useState('wind');
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedObjection, setExpandedObjection] = useState(null);
  const [repName, setRepName] = useState(localStorage.getItem('eden_rep_name') || 'Rep');
  const [companyName, setCompanyName] = useState(localStorage.getItem('eden_company_name') || 'Eden Claims');

  const currentFlow = LOSS_FLOWS[selectedLossType];
  const steps = currentFlow?.steps || [];
  const currentStepData = steps[currentStep];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetFlow = () => {
    setCurrentStep(0);
    setMode('home');
  };

  const personalizeScript = (script) => {
    return script
      .replace('[NAME]', repName)
      .replace('[COMPANY]', companyName)
      .replace('[DATE]', 'January 31st')
      .replace('[X]', '47');
  };

  // ============================================
  // HOME MODE
  // ============================================
  if (mode === 'home') {
    return (
      <div className="min-h-screen p-4 sm:p-6 page-enter">
        {/* Header */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <img src={NAV_ICONS.sales_ops} alt="Sales Ops" className="w-10 h-10 object-contain icon-3d-shadow" />
            <div>
              <h1 className="text-2xl font-tactical font-bold text-white tracking-wide text-glow-orange">SALES OPS</h1>
              <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Step-by-step guided sales flows</p>
            </div>
          </div>
        </div>

        {/* Loss Type Selection */}
        <div className="card-tactical mb-6 shadow-tactical">
          <div className="p-4 border-b border-zinc-800/50">
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Select Loss Type</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(LOSS_FLOWS).map(([key, flow]) => {
              const Icon = flow.icon;
              const isSelected = selectedLossType === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedLossType(key)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isSelected 
                      ? `border-${flow.color}-500 bg-${flow.color}-500/20` 
                      : 'border-gray-300 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${
                    isSelected ? `text-${flow.color}-400` : 'text-gray-600'
                  }`} />
                  <p className={`font-medium ${isSelected ? 'text-gray-900' : 'text-gray-300'}`}>
                    {flow.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <div className="flex gap-4 mb-8">
          <button 
            onClick={() => setMode('presentation')}
            className="flex-1 h-14 btn-tactical text-lg font-tactical font-bold flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start {currentFlow.name} Pitch
          </button>
        </div>

        {/* Quick Door Knock Script */}
        <div className="card-tactical mb-6 shadow-tactical">
          <div className="p-4 border-b border-zinc-800/50">
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-orange-400" />
              Quick Door Knock Script
            </h3>
          </div>
          <div className="p-4">
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <p className="text-gray-200 leading-relaxed">
                "Hi, I'm <span className="text-orange-400 font-medium">{repName}</span> with <span className="text-orange-400 font-medium">{companyName}</span>. 
                We're in the area documenting storm damage from the recent {selectedLossType} event. 
                We've already found damage on several homes nearby that wasn't visible from the ground. 
                Do you have 2 minutes for me to explain what we're seeing?"
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="border-gray-300 text-gray-300"
                onClick={() => setMode('presentation')}
              >
                Full Guided Flow
              </Button>
              <Button 
                variant="outline" 
                className="border-gray-300 text-gray-300"
                onClick={() => setMode('objections')}
              >
                Handle Objections
              </Button>
            </div>
          </div>
        </div>

        {/* Objection Quick Reference */}
        <div className="card-tactical shadow-tactical">
          <div className="p-4 border-b border-zinc-800/50">
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              Objection Handling
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {Object.entries(OBJECTIONS).slice(0, 5).map(([key, obj]) => (
              <div 
                key={key}
                className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedObjection(expandedObjection === key ? null : key)}
                  className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="text-white font-medium text-sm">{obj.title}</span>
                  <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform ${
                    expandedObjection === key ? 'rotate-90' : ''
                  }`} />
                </button>
                {expandedObjection === key && (
                  <div className="px-3 pb-3 border-t border-zinc-700/30">
                    <p className="text-zinc-400 text-sm pt-2">{obj.fullResponse}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // OBJECTIONS MODE
  // ============================================
  if (mode === 'objections') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            onClick={() => setMode('home')}
            className="text-gray-500"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Objection Handling</h1>
            <p className="text-gray-500 text-sm">Responses for common objections</p>
          </div>
        </div>

        {/* All Objections */}
        <div className="space-y-3">
          {Object.entries(OBJECTIONS).map(([key, obj]) => (
            <Card key={key} className="bg-white border-gray-200">
              <button
                onClick={() => setExpandedObjection(expandedObjection === key ? null : key)}
                className="w-full"
              >
                <CardHeader className="pb-0">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      {obj.title}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${
                      expandedObjection === key ? 'rotate-90' : ''
                    }`} />
                  </CardTitle>
                </CardHeader>
              </button>
              {expandedObjection === key && (
                <CardContent className="pt-2">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-3">
                    <p className="text-green-300 font-medium text-sm mb-1">Quick Response:</p>
                    <p className="text-gray-200">{obj.shortResponse}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-gray-600 font-medium text-sm mb-1">Full Response:</p>
                    <p className="text-gray-300 text-sm">{obj.fullResponse}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ============================================
  // PRESENTATION MODE - Step by Step
  // ============================================
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFlow}
              className="text-gray-500"
            >
              <X className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                {React.createElement(currentFlow.icon, { className: `w-5 h-5 text-${currentFlow.color}-400` })}
                {currentFlow.name} Flow
              </h1>
              <p className="text-gray-500 text-xs">Step {currentStep + 1} of {steps.length}</p>
            </div>
          </div>
          <Badge className={`bg-${currentFlow.color}-500/20 text-${currentFlow.color}-400`}>
            {currentStepData?.title}
          </Badge>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3">
          <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-1" />
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Step Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{currentStepData?.title}</h2>
          <p className="text-gray-600">{currentStepData?.subtitle}</p>
        </div>

        {/* Objective */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-orange-400" />
            <span className="text-orange-400 font-medium text-sm">OBJECTIVE</span>
          </div>
          <p className="text-gray-200">{currentStepData?.objective}</p>
        </div>

        {/* Script */}
        <Card className="bg-white border-gray-200 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              What to Say
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-100 text-lg leading-relaxed">
                "{personalizeScript(currentStepData?.script || '')}"
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {currentStepData?.tips?.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Footer */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex-1 h-12 border-gray-300 text-gray-300 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back
          </Button>
          
          {currentStep === steps.length - 1 ? (
            <Button
              onClick={resetFlow}
              className="flex-1 h-12 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-5 h-5 mr-1" />
              Complete
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              className="flex-1 h-12 bg-orange-500 hover:bg-orange-600"
            >
              Next Step
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          )}
        </div>
        
        {/* Quick Objection Access */}
        <Button
          variant="ghost"
          onClick={() => setMode('objections')}
          className="w-full mt-2 text-gray-500 hover:text-gray-300"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Handle an Objection
        </Button>
      </div>
    </div>
  );
};

export default SalesEnablement;
