import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus, Eye, EyeOff, Lock } from "lucide-react";


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
    <div className="min-h-screen flex">
      {/* Left Panel — imagem do designer */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <img
          src="/login-brand.png"
          alt="Walk Finance"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Right Panel — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 sm:px-12 bg-background relative overflow-hidden">
        {/* Soft radial glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] opacity-[0.06] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, hsl(var(--accent)), transparent 70%)" }}
        />

        <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
          {/* Logo Walk Finance */}
          <div className="mb-8 flex flex-col items-center select-none">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white tracking-tight">Walk</span>
              <span className="text-xl font-light text-[#4da6ff] tracking-widest">Finance</span>
            </div>
          </div>

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
          <p className="text-xs text-muted-foreground/60 mt-8 tracking-wide">
            Walk Holding Corporation © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
