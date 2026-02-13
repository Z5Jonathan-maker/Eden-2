// @ts-nocheck
import React from "react";
import { UserRound } from "lucide-react";
import { Button } from "../ui/button";

interface ProfileCardProps {
  name: string;
  role: string;
  email: string;
  phone: string;
  onEditProfile: () => void;
}

const initialsFrom = (name: string) => {
  if (!name) return "OP";
  const chunks = name.trim().split(/\s+/).slice(0, 2);
  return chunks.map((chunk) => chunk[0]?.toUpperCase() || "").join("");
};

const ProfileCard: React.FC<ProfileCardProps> = ({ name, role, email, phone, onEditProfile }) => {
  return (
    <section className="settings-card settings-fade-in">
      <div className="grid gap-5 md:grid-cols-[auto,1fr]">
        <div className="flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-xl font-semibold text-slate-100">
            {initialsFrom(name)}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="settings-field-label">Name</p>
            <p className="settings-field-value">{name || "Not set"}</p>
          </div>
          <div>
            <p className="settings-field-label">Role</p>
            <p className="settings-field-value">{role || "Operator"}</p>
          </div>
          <div>
            <p className="settings-field-label">Email</p>
            <p className="settings-field-value">{email || "Not set"}</p>
          </div>
          <div>
            <p className="settings-field-label">Phone</p>
            <p className="settings-field-value">{phone || "Not set"}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={onEditProfile}
          variant="outline"
          className="border-slate-600 bg-slate-800/50 text-slate-100 hover:border-slate-500 hover:bg-slate-800"
        >
          <UserRound className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>
    </section>
  );
};

export default ProfileCard;
