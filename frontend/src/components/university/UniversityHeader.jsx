/**
 * University Module - Header Component
 * Tactical Military Style with 3D Icon
 */

import React from 'react';
import { GraduationCap, Edit2, Shield } from 'lucide-react';
import { Input } from '../shared/ui/input';
import { Button } from '../shared/ui/button';
import { PAGE_ICONS } from '../../assets/badges';

export const UniversityHeader = ({
  universityName,
  isEditingName,
  editedName,
  setEditedName,
  setIsEditingName,
  onSave,
  canEdit
}) => {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 mb-2">
        <img 
          src={PAGE_ICONS.university} 
          alt="University" 
          className="w-12 h-12 sm:w-16 sm:h-16 object-contain animate-glow-breathe flex-shrink-0"
          style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
        />
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="input-tactical text-lg sm:text-2xl font-bold w-full sm:max-w-md"
                placeholder="University Name"
              />
              <div className="flex gap-2">
                <Button size="sm" className="btn-tactical" onClick={onSave}>Save</Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-zinc-700/30 text-zinc-300 hover:bg-zinc-800/50"
                  onClick={() => { setIsEditingName(false); setEditedName(universityName); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white uppercase tracking-wide text-glow-orange truncate">
                {universityName}
              </h1>
              {canEdit && (
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-zinc-500 hover:text-orange-500 rounded flex-shrink-0 transition-colors"
                  title="Edit university name"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <p className="text-sm sm:text-base text-zinc-500 font-mono uppercase tracking-wider">
            Internal training, standards & doctrine for your team
          </p>
        </div>
      </div>
    </div>
  );
};

export default UniversityHeader;
