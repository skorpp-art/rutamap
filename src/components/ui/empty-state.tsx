import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado vacío consistente: ícono + título + descripción + acción opcional. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6 animate-fade-in", className)}>
      <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
