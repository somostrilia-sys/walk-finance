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
    <div className="min-h-screen relative overflow-hidden">
      {/* Vídeo fullscreen em loop */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* Formulário — alinhado com Walk Finance no vídeo (centro-direita) */}
      <div className="absolute inset-0 flex items-center" style={{ justifyContent: "center", paddingLeft: "45%" }}>
        <div className="w-full max-w-sm">
          <div className="w-full rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 p-8">
            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
              </h1>
              <p className="text-sm text-white/60 mt-1.5 flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                {isLogin ? "Acesse o sistema financeiro" : "Preencha os dados para começar"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-white/80 uppercase tracking-wider">Nome completo</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" required={!isLogin} className="h-12 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-white/80 uppercase tracking-wider">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="h-12 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-white/80 uppercase tracking-wider">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-12 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 mt-1 text-base font-semibold rounded-xl text-white hover:opacity-90"
                style={{ backgroundColor: "#2e5cc1" }}
                disabled={loading}
              >
                {loading ? "Processando..." : isLogin ? (<><LogIn className="w-4 h-4 mr-2" /> Entrar</>) : (<><UserPlus className="w-4 h-4 mr-2" /> Criar conta</>)}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-white/60 hover:text-white transition-colors font-medium">
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
