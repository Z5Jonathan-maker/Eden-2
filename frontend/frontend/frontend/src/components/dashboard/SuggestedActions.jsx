import React from 'react';
import {
  AlertTriangle,
  Calendar,
  Zap,
  Mail,
  Plus,
  Flower2,
} from 'lucide-react';

const SuggestedActions = ({ stalledCount = 0, pendingInspections = 0, onNavigate }) => {
  const handleNavigation = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const actions = [
    {
      id: 'review-stalled',
      icon: AlertTriangle,
      label: 'Stalled Claims',
      badge: stalledCount > 0 ? stalledCount : null,
      badgeColor: 'bg-red-500',
      iconColor: 'text-red-400',
      hoverBorder: 'hover:border-red-500/40',
      path: '/claims?filter=stalled',
    },
    {
      id: 'schedule-inspections',
      icon: Calendar,
      label: 'Inspections',
      badge: pendingInspections > 0 ? pendingInspections : null,
      badgeColor: 'bg-purple-500',
      iconColor: 'text-purple-400',
      hoverBorder: 'hover:border-purple-500/40',
      path: '/inspections',
    },
    {
      id: 'open-eve',
      icon: Zap,
      label: 'Eve AI',
      badge: null,
      badgeColor: null,
      iconColor: 'text-orange-400',
      hoverBorder: 'hover:border-orange-500/40',
      path: '/eve',
    },
    {
      id: 'carrier-responses',
      icon: Mail,
      label: 'Carrier Mail',
      badge: null,
      badgeColor: null,
      iconColor: 'text-blue-400',
      hoverBorder: 'hover:border-blue-500/40',
      path: '/contracts',
    },
    {
      id: 'new-claim',
      icon: Plus,
      label: 'New Claim',
      badge: null,
      badgeColor: null,
      iconColor: 'text-green-400',
      hoverBorder: 'hover:border-green-500/40',
      path: '/claims/new',
    },
    {
      id: 'view-garden',
      icon: Flower2,
      label: 'Garden',
      badge: null,
      badgeColor: null,
      iconColor: 'text-emerald-400',
      hoverBorder: 'hover:border-emerald-500/40',
      path: '/garden',
    },
  ];

  return (
    <div className="card-tactical p-4 sm:p-5 shadow-tactical">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-orange-500 animate-bounce-gentle" />
        <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
          Suggested Actions
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const IconComp = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => handleNavigation(action.path)}
              className={`relative p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 ${action.hoverBorder} hover:bg-zinc-800/50 transition-all duration-200 group hover-lift-sm shadow-tactical focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900`}
              data-testid={`action-${action.id}`}
            >
              {/* Badge */}
              {action.badge !== null && (
                <span
                  className={`absolute -top-1.5 -right-1.5 ${action.badgeColor} text-white text-[9px] font-mono font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-lg`}
                >
                  {action.badge}
                </span>
              )}

              <IconComp
                className={`w-6 h-6 ${action.iconColor} mx-auto mb-2 transition-transform duration-200 group-hover:scale-110`}
              />
              <p className="text-xs font-mono text-zinc-400 group-hover:text-zinc-300 uppercase text-center">
                {action.label}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SuggestedActions;
