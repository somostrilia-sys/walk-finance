import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import logoWhite from "@/assets/logo-walk-white-bg.jpg";

const WatermarkW = () => (
  <div className="fixed inset-0 flex items-center justify-center pointer-events-none select-none z-0">
    <svg
      viewBox="0 0 200 200"
      className="w-[85vw] h-[85vw] max-w-[650px] max-h-[650px] opacity-[0.04]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Circle */}
      <circle cx="100" cy="100" r="80" stroke="hsl(40, 65%, 50%)" strokeWidth="5" fill="none" />
      {/* W icon — stylized like Walk logo */}
      <path
        d="M70 65 C70 65, 72 130, 85 130 C98 130, 100 90, 100 90 C100 90, 102 130, 115 130 C128 130, 130 65, 130 65"
        stroke="hsl(40, 65%, 50%)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </div>
);

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
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Watermark W */}
      <WatermarkW />

      {/* Left panel — brand (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative border-r border-border">
        <div className="relative z-10 text-center">
          <img src={logoWhite} alt="Walk Holding Corporation" className="w-[32rem] mx-auto mb-10" />
          <div className="brand-divider w-40 mx-auto mb-6" />
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Sistema Financeiro Integrado — Gestão centralizada e inteligente para todas as empresas do grupo.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex justify-center mb-6 lg:hidden pt-6">
            <img src={logoWhite} alt="Walk Holding" className="w-80 max-w-[85vw]" />
          </div>

          <div className="text-center lg:text-left mb-8">
            <h1 className="text-2xl font-bold text-foreground">
              {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin ? "Acesse o sistema financeiro" : "Preencha os dados para começar"}
            </p>
          </div>

          <div className="rounded-xl border border-border p-6 sm:p-8 bg-card shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required={!isLogin} />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Processando..." : isLogin ? (<><LogIn className="w-4 h-4 mr-2" /> Entrar</>) : (<><UserPlus className="w-4 h-4 mr-2" /> Criar conta</>)}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline font-medium">
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-8">
            Walk Holding Corporation © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
