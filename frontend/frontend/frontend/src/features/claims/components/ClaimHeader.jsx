import React from 'react';
import { ArrowLeft, ExternalLink, FileText, Loader2, MapPin, Edit } from 'lucide-react';
import { toast } from 'sonner';

const ClaimHeader = ({
  claim,
  navigate,
  gammaPage,
  creatingGammaPage,
  createGammaStrategyPage,
  handleEditClaim,
  getStatusColor,
}) => {
  const statusColor = getStatusColor(claim.status);

  const handleShareLocation = async () => {
    const address = claim?.property_address || 'No address';
    const text = `Claim ${claim?.claim_number}: ${claim?.client_name}\nProperty: ${address}`;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const mapLink = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
          const fullText = `${text}\nGPS: ${mapLink}`;

          if (navigator.share) {
            navigator
              .share({ title: `Claim ${claim?.claim_number}`, text: fullText })
              .catch(() => {
                navigator.clipboard.writeText(fullText);
                toast.success('Location copied to clipboard');
              });
          } else {
            navigator.clipboard.writeText(fullText);
            toast.success('Location + claim info copied!');
          }
        },
        () => {
          if (navigator.share) {
            navigator
              .share({ title: `Claim ${claim?.claim_number}`, text })
              .catch(() => {});
          } else {
            navigator.clipboard.writeText(text);
            toast.success('Claim info copied (GPS unavailable)');
          }
        },
        { timeout: 5000 }
      );
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Claim info copied');
    }
  };

  return (
    <div className="mb-4 md:mb-6 animate-fade-in-up">
      <button
        onClick={() => navigate('/claims')}
        className="mb-4 px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
        data-testid="back-to-claims"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Garden
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1
              className="text-xl md:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange"
              data-testid="claim-number"
            >
              {claim.claim_number}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${statusColor}`}
              data-testid="claim-status"
            >
              {claim.status}
            </span>
          </div>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
            {claim.claim_type}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {gammaPage?.exists ? (
            <button
              className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={() => window.open(gammaPage.url, '_blank')}
              data-testid="notion-page-btn"
            >
              <ExternalLink className="w-4 h-4" />
              Strategy Page
            </button>
          ) : (
            <button
              className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={createGammaStrategyPage}
              disabled={creatingGammaPage}
              data-testid="create-notion-btn"
            >
              {creatingGammaPage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Create Strategy
            </button>
          )}
          <button
            className="px-4 py-2 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all"
            onClick={handleShareLocation}
            data-testid="share-location-btn"
          >
            <MapPin className="w-4 h-4" />
            Share Location
          </button>
          <button
            className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2"
            onClick={handleEditClaim}
            data-testid="edit-claim-btn"
          >
            <Edit className="w-4 h-4" />
            Edit Mission
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimHeader;
