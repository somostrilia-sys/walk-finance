import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus, Eye, EyeOff, Lock } from "lucide-react";
import WalkLogo from "@/components/WalkLogo";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar solicitação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-background">
      {/* Subtle geometric pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(30deg, hsl(var(--accent)) 12%, transparent 12.5%, transparent 87%, hsl(var(--accent)) 87.5%),
            linear-gradient(150deg, hsl(var(--accent)) 12%, transparent 12.5%, transparent 87%, hsl(var(--accent)) 87.5%),
            linear-gradient(30deg, hsl(var(--accent)) 12%, transparent 12.5%, transparent 87%, hsl(var(--accent)) 87.5%),
            linear-gradient(150deg, hsl(var(--accent)) 12%, transparent 12.5%, transparent 87%, hsl(var(--accent)) 87.5%)
          `,
          backgroundSize: "80px 140px",
          backgroundPosition: "0 0, 0 0, 40px 70px, 40px 70px",
        }}
      />

      {/* Soft radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-[0.08]"
        style={{ background: "radial-gradient(ellipse at center, hsl(var(--accent)), transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo — large */}
        <div className="mb-6 flex flex-col items-center select-none">
          <WalkLogo width={280} className="brightness-0 invert" />
        </div>

        {/* Subtitle + gold divider */}
        <p className="text-sm text-muted-foreground mb-2 tracking-wide">Sistema Financeiro Integrado</p>
        <div className="w-20 h-[2px] rounded-full mb-8 gold-gradient" />

        {/* Form card */}
        <div className="w-full rounded-2xl bg-card border border-border/40 p-8"
          style={{ boxShadow: "0 4px 40px hsl(var(--hub-card-shadow) / 0.3)" }}>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              {isLogin ? "Acesse o sistema financeiro" : "Preencha os dados para começar"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Nome completo</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required={!isLogin} className="h-12 rounded-xl bg-muted/40 border-border/50 focus:bg-card" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="h-12 rounded-xl bg-muted/40 border-border/50 focus:bg-card" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-12 rounded-xl bg-muted/40 border-border/50 focus:bg-card" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 mt-1 text-base font-semibold rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={loading}
            >
              {loading ? "Processando..." : isLogin ? (<><LogIn className="w-4 h-4 mr-2" /> Entrar</>) : (<><UserPlus className="w-4 h-4 mr-2" /> Criar conta</>)}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-accent hover:underline font-medium">
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/60 mt-10 tracking-wide">
          Walk Holding Corporation © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Auth;
