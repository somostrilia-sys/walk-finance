import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

const PageHeader = ({ title, subtitle, showBack = false }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-4 mb-8">
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          className="hub-card-base flex items-center justify-center w-10 h-10 rounded-lg"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
      )}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
