import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const BRAND_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-[#EAEFFF]",
  "bg-amber-500",
  "bg-rose-500",
  "bg-fuchsia-500",
  "bg-cyan-500",
  "bg-[#EAEFFF]",
];

function getHashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

interface AgencyLogoProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
}

export function AgencyLogo({ name, logoUrl, className }: AgencyLogoProps) {
  const colorIndex = getHashString(name) % BRAND_COLORS.length;
  const colorClass = BRAND_COLORS[colorIndex];
  const initials = name.substring(0, 2).toUpperCase();

  return (
    <Avatar className={className}>
      <AvatarImage src={logoUrl || undefined} alt={name} />
      <AvatarFallback className={`${colorClass} text-white font-medium`}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}