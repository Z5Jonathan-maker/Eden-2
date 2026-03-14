import React from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using Eden ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, you may not access or use the Platform. We reserve the right to modify these Terms at any time, and your continued use of the Platform constitutes acceptance of any modifications.`,
  },
  {
    title: '2. Description of Service',
    body: `Eden is a proprietary claims management platform operated by Care Claims LLC ("Company"). The Platform provides tools for insurance claims processing, field operations management, AI-assisted analysis, document management, and related services. Access to certain features may require a paid subscription or specific user role authorization.`,
  },
  {
    title: '3. Account Responsibilities',
    body: `You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify Care Claims LLC of any unauthorized use of your account. You agree to provide accurate, current, and complete information during registration and to update such information as necessary. Care Claims LLC reserves the right to suspend or terminate accounts that violate these Terms.`,
  },
  {
    title: '4. Intellectual Property',
    body: `All content, features, functionality, AI models, algorithms, and trade secrets embodied in the Platform are owned by Care Claims LLC and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property laws. The Eden name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of Care Claims LLC.`,
  },
  {
    title: '5. Prohibited Uses',
    body: `You agree not to:\n\n• Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Platform\n• Scrape, crawl, or use automated means to extract data from the Platform\n• Copy, reproduce, or imitate the Platform's features, functionality, or user interface designs\n• Attempt to gain unauthorized access to any systems, networks, or data connected to the Platform\n• Use information obtained from the Platform to develop a competing product or service\n• Share, resell, or redistribute your access credentials to unauthorized parties\n• Use the Platform for any unlawful purpose or in violation of any applicable regulations\n• Interfere with or disrupt the integrity or performance of the Platform`,
  },
  {
    title: '6. Confidentiality',
    body: `Users acknowledge that claim data, AI insights, carrier strategies, negotiation playbooks, and all operational intelligence accessed through the Platform are confidential and proprietary. You agree not to disclose, share, or use any confidential information obtained through the Platform for any purpose other than your authorized use of the Platform. This confidentiality obligation survives termination of your account.`,
  },
  {
    title: '7. Data Protection',
    body: `We protect your data using industry-standard encryption and access controls. All data transmitted between your device and our servers is encrypted using TLS 1.2 or higher. Data at rest is encrypted using AES-256 encryption. Access to user data is restricted to authorized personnel on a need-to-know basis. For complete details on how we handle your data, please review our Privacy Policy.`,
  },
  {
    title: '8. Limitation of Liability',
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CARE CLAIMS LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM. OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.`,
  },
  {
    title: '9. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflict of law principles. Any legal action or proceeding arising out of or relating to these Terms shall be brought exclusively in the state or federal courts located in the State of Florida, and you consent to the personal jurisdiction of such courts.`,
  },
  {
    title: '10. Contact',
    body: `If you have any questions about these Terms of Service, please contact us at:\n\nCare Claims LLC\nEmail: jonathan@careclaimsadjusting.com`,
  },
];

const TermsOfService = () => {
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
            Terms of Service
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
            <Link to="/privacy" className="text-zinc-500 hover:text-orange-400 text-xs transition-colors">
              Privacy Policy
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

export default TermsOfService;
