import React from "react";
import { Check } from "lucide-react";
import { TEMPLATES } from "./TemplateThemes";
import { TemplateKey } from "./types";

interface Props {
  selectedTemplate: string;
  onSelect: (template: TemplateKey) => void;
}

const TemplateSelector: React.FC<Props> = ({ selectedTemplate, onSelect }) => {
  return (
    <div className="mb-6">
      <p className="text-zinc-300 font-mono text-sm mb-3 block">SELECT CARD TEMPLATE</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.values(TEMPLATES).map((template) => {
          const active = selectedTemplate === template.id;
          return (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              className={`relative overflow-hidden rounded-xl border-2 transition-all text-left ${
                active
                  ? `${template.border} shadow-[0_0_26px_rgba(34,211,238,0.28)] scale-[1.01]`
                  : "border-zinc-700/30 hover:border-zinc-500 hover:shadow-[0_0_18px_rgba(63,63,70,0.5)]"
              }`}
            >
              <div className={`h-24 relative ${template.background}`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className={`text-[10px] font-mono uppercase tracking-wider ${template.accent}`}>
                    {template.uniqueElement}
                  </p>
                </div>
                {active && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <div className="p-3 bg-zinc-900">
                <p className="font-tactical font-bold text-white text-sm">{template.name}</p>
                <p className="text-zinc-500 text-xs">{template.description}</p>
                <p className={`text-[10px] font-mono uppercase mt-1 ${template.accent}`}>Template ID: {template.id}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TemplateSelector;
