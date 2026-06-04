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
      "flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50/60 dark:from-indigo-950/30 dark:to-violet-950/20 dark:border-indigo-800/40 shadow-sm",
      className
    )}>
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
        <IconSparkles className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
          Son ziyaretinizden bu yana {data.count} yeni eşleşme
        </p>
        <p className="text-xs text-indigo-600/70 dark:text-indigo-300/60 mt-0.5">
          Profilinizle eşleşen yeni ihaleler bulundu
        </p>
      </div>
      <Link href="/firsatlarim">
        <button className="flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors whitespace-nowrap shrink-0">
          Görüntüle <IconChevronRight className="h-3.5 w-3.5" />
        </button>
      </Link>
      <button
        onClick={() => setDismissed(true)}
        className="h-6 w-6 rounded-full flex items-center justify-center text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors shrink-0"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
