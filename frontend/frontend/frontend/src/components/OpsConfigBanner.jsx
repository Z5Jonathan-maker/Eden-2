import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/api';
const BUILD_VERSION = import.meta.env.REACT_APP_CONFIG_VERSION || '';

const OpsConfigBanner = () => {
  const [manifestVersion, setManifestVersion] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        const res = await apiGet('/api/ops/manifest');
        if (res.ok && res.data?.config_version) {
          setManifestVersion(res.data.config_version);
          setError('');
        }
      } catch (err) {
        setError('Failed to load ops manifest');
      }
    };

    fetchManifest();
    const interval = setInterval(fetchManifest, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!BUILD_VERSION || !manifestVersion) return null;

  if (BUILD_VERSION === manifestVersion) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-amber-200 text-xs font-mono flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span>Config mismatch detected.</span>
        <span className="text-amber-300">UI: {BUILD_VERSION}</span>
        <span className="text-amber-400">API: {manifestVersion}</span>
        {error && <span className="text-amber-500">{error}</span>}
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 text-amber-200 hover:text-white"
      >
        <RefreshCw className="w-3 h-3" />
        Reload
      </button>
    </div>
  );
};

export default OpsConfigBanner;
