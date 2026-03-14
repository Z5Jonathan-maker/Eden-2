import React from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: `We collect the following types of information when you use Eden:

• Account Information: Name, email address, phone number, company affiliation, and role designation.
• Claim Data: Insurance claim details, property information, damage assessments, photographs, inspection reports, and related documentation you upload or create within the Platform.
• Usage Analytics: Pages visited, features used, session duration, device type, browser information, and interaction patterns to improve Platform performance and user experience.
• Communication Data: Messages, notes, and communications sent through the Platform's built-in communication tools.
• Payment Information: Billing details processed securely through our third-party payment processor (Stripe). We do not store full credit card numbers on our servers.`,
  },
  {
    title: '2. How We Use Your Information',
    body: `We use the information we collect to:

• Provide, maintain, and improve the Eden platform and its features
• Process insurance claims and facilitate claims management workflows
• Generate AI-powered insights, recommendations, and analysis to support your operations
• Communicate with you about your account, updates, and Platform changes
• Ensure Platform security and prevent unauthorized access or fraud
• Comply with legal obligations and respond to lawful requests
• Analyze usage patterns to improve user experience and develop new features`,
  },
  {
    title: '3. Data Security Measures',
    body: `We implement industry-standard security measures to protect your information:

• All data in transit is encrypted using TLS 1.2 or higher
• Data at rest is encrypted using AES-256 encryption
• Access controls enforce role-based permissions and least-privilege principles
• Regular security audits and vulnerability assessments are conducted
• Multi-factor authentication is available for all accounts
• Automated monitoring systems detect and alert on suspicious activity
• Database backups are encrypted and stored in geographically separate locations`,
  },
  {
    title: '4. Third-Party Services',
    body: `Eden integrates with the following third-party services that may process your data in accordance with their own privacy policies:

• Google Gemini AI: Used for AI-powered claim analysis, document processing, and intelligent recommendations. Data sent to Gemini is processed according to Google's enterprise data processing terms.
• SignNow: Used for electronic document signing. Document data is transmitted securely to SignNow's servers for signature processing.
• Stripe: Used for payment processing. Payment information is handled directly by Stripe and is subject to Stripe's privacy policy and PCI DSS compliance.
• Google Workspace: Used for email integration and calendar functionality. Data shared with Google Workspace is governed by your organization's Google Workspace agreement.

We carefully vet all third-party integrations and require that they maintain appropriate security and privacy standards.`,
  },
  {
    title: '5. Data Retention',
    body: `We retain your information for as long as your account is active or as needed to provide services. Specifically:

• Account data is retained for the duration of your active account plus 90 days after account closure
• Claim data is retained for a minimum of 7 years to comply with insurance industry regulations and applicable statutes of limitations
• Usage analytics are retained in anonymized form for up to 24 months
• Communication records are retained for the duration of the associated claim lifecycle
• You may request deletion of your personal data, subject to our legal retention obligations, by contacting us at the address below`,
  },
  {
    title: '6. Your Rights',
    body: `You have the following rights regarding your personal information:

• Access: You may request a copy of the personal data we hold about you
• Correction: You may request correction of inaccurate or incomplete personal data
• Deletion: You may request deletion of your personal data, subject to legal retention requirements
• Portability: You may request your data in a structured, commonly used, machine-readable format
• Objection: You may object to processing of your personal data in certain circumstances
• Restriction: You may request restriction of processing of your personal data

To exercise any of these rights, please contact us using the information provided below.`,
  },
  {
    title: '7. Florida-Specific Privacy Provisions',
    body: `As a Florida-based company, we comply with applicable Florida privacy laws:

• Florida Information Protection Act (FIPA): We maintain reasonable security measures to protect personal information and will provide notification within 30 days in the event of a data breach affecting Florida residents.
• Florida Security of Communications Act: We do not intercept or monitor private communications except as necessary for Platform operation and with appropriate notice.
• We do not sell your personal information to third parties.
• We provide equal service and pricing regardless of whether you exercise your privacy rights.`,
  },
  {
    title: '8. Contact Information',
    body: `If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:

Care Claims LLC
Email: jonathan@careclaimsadjusting.com

We will respond to your inquiry within 30 business days.`,
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-zinc-500 hover:text-orange-400 transition-colors mb-8"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Eden
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-zinc-500 font-mono">
            Last updated: March 14, 2026
          </p>
          <div className="mt-4 h-px bg-gradient-to-r from-orange-500/50 to-transparent" />
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div
              key={section.title}
              className="bg-[#1a1a1a] border border-zinc-800/60 rounded-xl p-6 sm:p-8"
            >
              <h2 className="text-lg font-semibold text-white mb-4">
                <span className="text-orange-500">//</span> {section.title}
              </h2>
              <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                {section.body}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-zinc-800/50 text-center">
          <p className="text-zinc-600 text-xs font-mono">
            &copy; 2026 Care Claims LLC. All rights reserved.
          </p>
          <div className="mt-3 flex justify-center gap-4">
            <Link to="/terms" className="text-zinc-500 hover:text-orange-400 text-xs transition-colors">
              Terms of Service
            </Link>
            <span className="text-zinc-700">|</span>
            <Link to="/" className="text-zinc-500 hover:text-orange-400 text-xs transition-colors">
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
