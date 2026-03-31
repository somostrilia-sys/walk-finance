import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
}

const EmptyState = ({ icon, title, description, className = "" }: EmptyStateProps) => (
  <div className={`flex flex-col items-center justify-center py-14 text-center gap-3 ${className}`}>
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
      {icon}
    </div>
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{description}</p>
      )}
    </div>
  </div>
);

export default EmptyState;
