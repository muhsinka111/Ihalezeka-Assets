import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { IconSparkles, IconX, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface BannerData {
  count: number;
  lastVisitedAt: string | null;
}

async function fetchNewSinceLastVisit(): Promise<BannerData> {
  const res = await fetch(`${BASE}/api/notifications/new-since-last-visit`);
  if (!res.ok) return { count: 0, lastVisitedAt: null };
  return res.json();
}

async function updateLastVisit(): Promise<void> {
  await fetch(`${BASE}/api/notifications/update-last-visit`, { method: "POST" });
}

interface Props {
  className?: string;
}

export function NewMatchesBanner({ className }: Props) {
  const [data, setData] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const updatedRef = useRef(false);

  useEffect(() => {
    fetchNewSinceLastVisit().then(setData);

    return () => {
      if (!updatedRef.current) {
        updatedRef.current = true;
        updateLastVisit();
      }
    };
  }, []);

  if (!data || data.count === 0 || dismissed) return null;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2D5BFF]/15 bg-[#EAEFFF]/60 dark:bg-[#2D5BFF]/10 dark:border-[#2D5BFF]/30 shadow-sm",
      className
    )}>
      <div className="h-8 w-8 rounded-lg bg-[#2D5BFF] flex items-center justify-center shrink-0 shadow-sm">
        <IconSparkles className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#14213D] dark:text-white">
          Son ziyaretinizden bu yana {data.count} yeni eşleşme
        </p>
        <p className="text-xs text-[#2D5BFF]/70 dark:text-[#6E8BFF]/60 mt-0.5">
          Profilinizle eşleşen yeni ihaleler bulundu
        </p>
      </div>
      <Link href="/firsatlarim">
        <button className="flex items-center gap-1 text-xs font-semibold text-[#2D5BFF] dark:text-[#6E8BFF] hover:text-[#1E45D6] dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
          Görüntüle <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="h-6 w-6 rounded-full flex items-center justify-center text-[#6E8BFF] hover:text-[#2D5BFF] hover:bg-[#EAEFFF] dark:hover:bg-[#1B2C50]/40 transition-colors shrink-0"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
