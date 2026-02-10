/**
 * University Module - Certificates Tab Component
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Award, Trophy, Download } from 'lucide-react';

const CertificateCard = ({ certificate }) => (
  <Card className="overflow-hidden">
    <div className="h-3 bg-gradient-to-r from-orange-500 to-orange-600" />
    <CardContent className="p-5 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
        <Trophy className="w-8 h-8 text-orange-600" />
      </div>
      <p className="text-gray-500 text-sm mb-1">Awarded to</p>
      <p className="font-semibold text-lg text-gray-900 mb-2">
        {certificate.user_name}
      </p>
      <p className="text-gray-500 text-sm mb-1">for completing</p>
      <p className="font-medium text-gray-800 mb-3">
        {certificate.course_title}
      </p>
      <p className="text-gray-600 text-xs">
        {new Date(certificate.issued_at).toLocaleDateString()}
      </p>
      {certificate.download_url && (
        <a 
          href={certificate.download_url}
          className="mt-4 inline-flex items-center text-orange-600 text-sm hover:underline"
        >
          <Download className="w-4 h-4 mr-1" /> Download
        </a>
      )}
    </CardContent>
  </Card>
);

export const CertificatesTab = ({ certificates }) => {
  if (!certificates || certificates.length === 0) {
    return (
      <Card className="dark:bg-white">
        <CardContent className="p-12 text-center">
          <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Certificates Yet
          </h3>
          <p className="text-gray-600">
            Complete courses and pass quizzes to earn certificates!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Award className="w-6 h-6 text-orange-600" />
        <h2 className="text-xl font-semibold text-gray-900">
          Your Certificates ({certificates.length})
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map((cert) => (
          <CertificateCard key={cert.id} certificate={cert} />
        ))}
      </div>
    </div>
  );
};

export default CertificatesTab;
