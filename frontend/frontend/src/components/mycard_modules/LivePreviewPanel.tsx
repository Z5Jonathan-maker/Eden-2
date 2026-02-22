import React from "react";
import { Briefcase, Mail, Phone, Shield } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TACTICAL_AVATAR } from "./constants";
import { MyCardFormData, TemplateKey } from "./types";
import { TEMPLATES, TEMPLATE_FALLBACK_ID, toTemplateKey } from "./TemplateThemes";
import "./previewAnimations.css";

interface Props {
  formData: MyCardFormData;
  selectedTemplate: TemplateKey | string;
  headshotPreview: string;
  shareUrl: string;
}

const LivePreviewPanel: React.FC<Props> = ({ formData, selectedTemplate, headshotPreview, shareUrl }) => {
  const templateKey = toTemplateKey(selectedTemplate);
  const theme = TEMPLATES[templateKey] || TEMPLATES[TEMPLATE_FALLBACK_ID];
  const qrValue = shareUrl || "https://eden.app/card/preview";

  const renderTemplateUniqueLayer = () => {
    if (templateKey === "tacticalCommander") {
      return (
        <div className="mycard-corner-brackets">
          <span />
          <span />
          <span />
          <span />
        </div>
      );
    }
    if (templateKey === "fieldOperations") {
      return <div className="mycard-radar-ring" />;
    }
    if (templateKey === "eliteAgent") {
      return <div className="mycard-gold-trim" />;
    }
    return null;
  };

  return (
    <div className="card-tactical p-4">
      <h3 className="font-tactical font-bold text-white uppercase tracking-wide mb-3">Live Card Preview</h3>
      <div className={`${theme.background} ${theme.border} ${theme.font} rounded-2xl overflow-hidden`}>
        {renderTemplateUniqueLayer()}
        <div className="relative p-4">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={headshotPreview || TACTICAL_AVATAR}
              alt="Operator"
              className="w-16 h-16 rounded-xl object-cover border border-zinc-700/40"
              onError={(e) => {
                e.currentTarget.src = TACTICAL_AVATAR;
              }}
            />
            <div>
              <p className="font-tactical text-white text-lg">{formData.full_name || "OPERATOR NAME"}</p>
              <p className={`text-sm ${theme.accent}`}>
                {formData.title || "Field Commander"}
              </p>
              <p className="text-xs text-zinc-500 font-mono">Template: {theme.id}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-zinc-300 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              {formData.company || "Care Claims"}
            </p>
            <p className="text-zinc-300 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {formData.phone || "(555) 123-4567"}
            </p>
            <p className="text-zinc-300 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {formData.email || "operator@careclaims.com"}
            </p>
            <p className="text-zinc-300 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              License: {formData.license_number || "PA-XXXX"}
            </p>
          </div>

          {formData.tagline && <p className="mt-3 text-sm text-zinc-300 italic">"{formData.tagline}"</p>}
          <div className="mt-4 flex justify-center">
            <div className="rounded-lg bg-white p-2 shadow-[0_0_18px_rgba(255,255,255,0.2)]">
              <QRCodeSVG value={qrValue} size={128} />
            </div>
          </div>
          <p className={`mt-3 text-[10px] font-mono uppercase tracking-wider ${theme.accent}`}>
            {theme.uniqueElement}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LivePreviewPanel;
