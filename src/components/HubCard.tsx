import { useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface HubCardProps {
  title: string;
  icon?: string;
  initials?: string;
  subtitle?: string;
  to: string;
  statusBadge?: "positive" | "warning" | "danger";
  statusLabel?: string;
  delay?: number;
}

const iconMap: Record<string, LucideIcon> = {
  BarChart3: Icons.BarChart3,
  Landmark: Icons.Landmark,
  Wallet: Icons.Wallet,
  ClipboardList: Icons.ClipboardList,
  FolderOpen: Icons.FolderOpen,
  AlertTriangle: Icons.AlertTriangle,
  TrendingUp: Icons.TrendingUp,
  Receipt: Icons.Receipt,
  Send: Icons.Send,
};

const HubCard = ({ title, icon, initials, subtitle, to, statusBadge, statusLabel, delay = 0 }: HubCardProps) => {
  const navigate = useNavigate();
  const IconComponent = icon ? iconMap[icon] : null;

  return (
    <button
      onClick={() => navigate(to)}
      className="hub-card-base flex flex-col items-center justify-center p-6 aspect-square text-center gap-3 animate-fade-in"
      style={{ animationDelay: `${delay * 60}ms` }}
    >
      {IconComponent ? (
        <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center">
          <IconComponent className="w-7 h-7 text-accent-foreground" />
        </div>
      ) : initials ? (
        <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-lg font-bold text-primary-foreground">{initials}</span>
        </div>
      ) : null}

      <div className="space-y-1">
        <span className="text-sm font-semibold text-card-foreground leading-tight block">{title}</span>
        {subtitle && (
          <span className="text-xs text-muted-foreground leading-tight block">{subtitle}</span>
        )}
      </div>

      {statusBadge && statusLabel && (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full status-badge-${statusBadge}`}>
          {statusLabel}
        </span>
      )}
    </button>
  );
};

export default HubCard;
