"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!email.endsWith("@mediastre.am")) {
            setError("Solo se permiten correos de @mediastre.am");
            setLoading(false);
            return;
        }

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            setError("Credenciales inválidas o acceso no autorizado");
            setLoading(false);
        } else {
            router.push("/");
            router.refresh();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background glow effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[200px] bg-primary/3 rounded-full blur-[80px]" />
            </div>

            <div className="w-full max-w-sm mx-4 relative">
                {/* Green line on top — Stitch style */}
                <div className="h-[2px] w-full bg-primary rounded-t-full mb-0" />

                <div className="bg-card border border-border rounded-b-2xl rounded-tr-2xl p-8 shadow-[0_0_80px_rgba(123,210,30,0.06)]">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                            <Zap className="text-primary" size={22} />
                        </div>
                        <h1 className="text-lg font-black text-foreground tracking-tight">SOPORTE 360</h1>
                        <p className="text-[11px] text-muted-foreground mt-1">Mediastream Operations Platform</p>
                    </div>

                    {/* Google */}
                    <button
                        type="button"
                        onClick={() => signIn("google", { callbackUrl: "/" })}
                        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-[12px] font-medium text-foreground transition-all duration-150 mb-4"
                    >
                        <img src="https://authjs.dev/img/providers/google.svg" alt="Google" className="w-4 h-4" />
                        Continuar con Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">o con credenciales</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                            <div className="relative">
                                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                                <input
                                    type="email"
                                    placeholder="usuario@mediastre.am"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2.5 bg-muted/30 border border-border rounded-lg text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Contraseña</label>
                            <div className="relative">
                                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2.5 bg-muted/30 border border-border rounded-lg text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                                <p className="text-[11px] text-destructive font-medium">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[12px] rounded-lg flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            ) : (
                                <>Iniciar Sesión <ArrowRight size={13} /></>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-[11px] text-muted-foreground/50 mt-5">
                        ¿No tienes cuenta?{" "}
                        <button
                            type="button"
                            onClick={() => router.push("/register")}
                            className="text-primary hover:text-primary/80 font-semibold transition-colors"
                        >
                            Regístrate aquí
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
