import React from "react";
import { User } from "lucide-react";
import { TACTICAL_AVATAR } from "./constants";

interface Props {
  error?: string;
  previewUrl: string;
  onFileSelected: (file: File | null) => void;
}

const HeadshotUploader: React.FC<Props> = ({ error, previewUrl, onFileSelected }) => {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-4">
      <h3 className="text-xs text-orange-400 font-mono uppercase tracking-wider mb-3">Branding / Headshot</h3>
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1">
          <label className="text-zinc-300 font-mono text-sm block">HEADSHOT UPLOAD *</label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="input-tactical w-full mt-1 file:mr-4 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-orange-500/20 file:text-orange-300"
            onChange={(e) => onFileSelected(e.target.files?.[0] || null)}
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          <p className="text-xs text-zinc-500 font-mono mt-2">Accepted: JPG, PNG, WEBP</p>
        </div>
        <div className="w-28 h-28 rounded-xl border border-zinc-700/50 bg-zinc-800/40 overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Headshot preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = TACTICAL_AVATAR;
              }}
            />
          ) : (
            <User className="w-8 h-8 text-zinc-600" />
          )}
        </div>
      </div>
    </div>
  );
};

export default HeadshotUploader;
