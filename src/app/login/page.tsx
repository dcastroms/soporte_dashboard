"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email.endsWith("@mediastre.am")) {
            setError("Solo se permiten correos de @mediastre.am");
            return;
        }

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            setError("Credenciales inválidas o acceso no autorizado");
        } else {
            router.push("/");
            router.refresh();
        }
    };

    return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <Zap className="text-blue-600 h-10 w-10" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Bienvenido de nuevo</CardTitle>
                    <CardDescription>
                        Inicia sesión con tu cuenta corporativa @mediastre.am
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <input
                                type="email"
                                placeholder="usuario@mediastre.am"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-2 border rounded-md focus:ring-1 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Contraseña</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-2 border rounded-md focus:ring-1 focus:ring-blue-500"
                                required
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <Button type="button" variant="outline" className="w-full flex items-center gap-2" onClick={() => signIn("google", { callbackUrl: "/" })}>
                            <img src="https://authjs.dev/img/providers/google.svg" alt="Google" className="w-5 h-5" />
                            Continuar con Google
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-slate-500">O con credenciales</span>
                            </div>
                        </div>

                        <Button type="submit" className="w-full">
                            Iniciar Sesión
                        </Button>
                        <p className="text-center text-sm text-slate-500 mt-4">
                            ¿No tienes cuenta?{" "}
                            <button
                                type="button"
                                onClick={() => router.push("/register")}
                                className="text-blue-600 hover:underline"
                            >
                                Regístrate aquí
                            </button>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
