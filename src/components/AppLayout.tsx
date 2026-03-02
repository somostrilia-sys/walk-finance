import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import logoWhite from "@/assets/logo-walk-white-bg.jpg";

interface AppLayoutProps {
  children: React.ReactNode;
  companyBar?: { primary?: string | null; accent?: string | null };
}

const AppLayout = ({ children, companyBar }: AppLayoutProps) => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <img src={logoWhite} alt="Walk Holding" className="h-8" />
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Company brand accent bar */}
      {companyBar && (
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, ${companyBar.primary || "hsl(var(--primary))"}, ${companyBar.accent || "hsl(var(--accent))"})`
          }}
        />
      )}

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Walk Holding Corporation © {new Date().getFullYear()}</p>
          <p className="text-xs text-muted-foreground">v1.1</p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
