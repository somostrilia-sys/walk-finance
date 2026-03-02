import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import logoWhite from "@/assets/logo-walk-white-bg.jpg";
import logoDark from "@/assets/logo-walk-dark-bg.png";

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, hsl(0 0% 100%) 0%, hsl(213 30% 96%) 40%, hsl(40 40% 95%) 100%)" }}>
      
      {/* Subtle decorative circles */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.04]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 70%)" }} />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.03]"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)), transparent 70%)" }} />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Logo — grande e centralizada */}
        <div className="mb-8">
          <img src={logoWhite} alt="Grupo Walk" className="w-[340px] max-w-[85vw] drop-shadow-sm" />
        </div>

        {/* Card do formulário */}
        <div className="w-full rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-xl p-8">
          {/* Title */}
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isLogin ? "Acesse o sistema financeiro do Grupo Walk" : "Preencha os dados para começar"}
            </p>
            <div className="brand-divider w-16 mx-auto mt-4" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required={!isLogin} className="h-11" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="h-11" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-11" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 mt-1 text-base font-semibold" disabled={loading}>
              {loading ? "Processando..." : isLogin ? (<><LogIn className="w-4 h-4 mr-2" /> Entrar</>) : (<><UserPlus className="w-4 h-4 mr-2" /> Criar conta</>)}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline font-medium">
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground mt-8">
          Grupo Walk © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Auth;
