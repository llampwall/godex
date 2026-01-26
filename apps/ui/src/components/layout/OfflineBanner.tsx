import { useOnline } from "@/hooks/useOnline";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-destructive text-destructive-foreground",
        "px-4 py-2 flex items-center justify-center gap-2",
        "text-sm font-medium shadow-md"
      )}
    >
      <WifiOff className="w-4 h-4" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  );
}
