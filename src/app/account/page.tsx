"use client";

import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, User as UserIcon, Mail } from "lucide-react";

export default function ProfilePage() {
    const { data: session } = useSession();

    if (!session) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Card className="w-full max-w-sm">
                    <CardContent className="h-40 flex flex-col items-center justify-center gap-4">
                        <p className="text-muted-foreground">No hay sesión activa</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl">
            <h1 className="text-3xl font-bold tracking-tight">Mi Cuenta</h1>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Información de Perfil</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4 py-8">
                        <Avatar className="h-24 w-24 ring-2 ring-slate-100">
                            <AvatarImage src={session.user?.image || ""} />
                            <AvatarFallback className="text-2xl bg-slate-200">
                                {session.user?.name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-bold">{session.user?.name}</h2>
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                <Mail size={14} />
                                {session.user?.email}
                            </p>
                        </div>

                        <div className="mt-4">
                            <Badge variant="secondary" className="px-3 py-1">
                                Sesión de Google Activa
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Acciones de Cuenta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-lg border text-sm text-slate-600">
                            <p className="mb-2 font-semibold">Estado de la cuenta</p>
                            <p>Tu cuenta está vinculada a Google Workspace de Mediastream. Utiliza estas credenciales para acceder a todos los servicios del dashboard.</p>
                        </div>

                        <Button
                            variant="destructive"
                            className="w-full justify-start gap-2"
                            onClick={() => signOut({ callbackUrl: '/' })}
                        >
                            <LogOut size={16} />
                            Cerrar Sesión
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
