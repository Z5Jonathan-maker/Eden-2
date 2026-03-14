import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-4xl font-tactical font-bold text-white mb-2 tracking-wide">404</h1>
        <p className="text-sm font-mono text-zinc-400 uppercase tracking-wider mb-2">Sector Not Found</p>
        <p className="text-zinc-500 text-sm mb-8">
          <code className="text-red-400/80">{location.pathname}</code> does not exist or has been decommissioned.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 font-tactical text-sm uppercase transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-tactical px-5 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Command Center
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
