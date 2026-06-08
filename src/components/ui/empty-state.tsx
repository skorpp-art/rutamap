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
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-up", className)}>
      <div className="relative mb-4">
        {/* Halo suave con el índigo de firma */}
        <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-xl" />
        <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/15 flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary/80" strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
