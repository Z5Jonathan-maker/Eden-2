import React from "react";
import { Copy, QrCode, Mail, MessageCircle, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  qrCode: string;
  onCopy: () => void;
  onTrackSend: (channel: string) => void;
}

const ShareModal: React.FC<Props> = ({ open, onClose, shareUrl, qrCode, onCopy, onTrackSend }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg card-tactical p-5 border border-orange-500/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-tactical font-bold text-white uppercase tracking-wide">Share Mission Card</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
            <p className="text-zinc-400 text-xs font-mono mb-2">SHAREABLE URL</p>
            <p className="text-sm text-zinc-200 font-mono break-all">{shareUrl}</p>
            <button
              type="button"
              className="btn-tactical w-full mt-3"
              onClick={() => {
                onCopy();
                onTrackSend("copy_link");
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </button>
          </div>

          <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg">
              {qrCode ? (
                <img src={`data:image/png;base64,${qrCode}`} alt="QR Code" className="w-24 h-24" />
              ) : (
                <div className="w-24 h-24 flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-zinc-600" />
                </div>
              )}
            </div>
            <div>
              <p className="font-tactical text-white">QR Distribution</p>
              <p className="text-xs text-zinc-500 font-mono">Scan for instant card access</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="h-10 px-4 py-2 rounded-md border border-zinc-700/40 text-zinc-300 text-sm font-medium inline-flex items-center justify-center"
              onClick={() => onTrackSend("sms_placeholder")}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Send via SMS
            </button>
            <button
              type="button"
              className="h-10 px-4 py-2 rounded-md border border-zinc-700/40 text-zinc-300 text-sm font-medium inline-flex items-center justify-center"
              onClick={() => onTrackSend("email_placeholder")}
            >
              <Mail className="w-4 h-4 mr-2" />
              Send via Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
