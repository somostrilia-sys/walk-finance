import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import logoWhite from "@/assets/logo-walk-white-bg.jpg";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  companyLogo?: string | null;
}

const PageHeader = ({ title, subtitle, showBack = false, companyLogo }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-4 mb-8">
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="hub-card-base flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
      )}
      {companyLogo ? (
        <img src={companyLogo} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/50 flex-shrink-0" />
      ) : null}
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <img src={logoWhite} alt="Walk Holding" className="h-8 w-auto opacity-40 hidden sm:block" />
    </div>
  );
};

export default PageHeader;
