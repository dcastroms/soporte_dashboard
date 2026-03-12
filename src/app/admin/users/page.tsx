"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Shield, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
}

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await fetch('/api/admin/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const updateUserRole = async (userId: string, newRole: string) => {
        try {
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            });

            if (response.ok) {
                toast.success('Rol actualizado correctamente');
                loadUsers();
            } else {
                toast.error('Error al actualizar rol');
            }
        } catch (error) {
            console.error('Error updating role:', error);
            toast.error('Error al actualizar rol');
        }
    };

    if (status === "loading" || loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">Cargando...</p>
            </div>
        );
    }

    if ((session?.user as any)?.role !== "ADMIN") {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center gap-4 py-8">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                        <h2 className="text-xl font-bold text-foreground">Acceso Denegado</h2>
                        <p className="text-muted-foreground text-center">
                            No tienes permisos para acceder a esta página.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title flex items-center gap-2">
                        <Shield className="h-8 w-8 text-primary" />
                        Gestión de Usuarios
                    </h1>
                    <p className="page-subtitle">Administra roles y permisos de los usuarios del sistema.</p>
                </div>
                <Badge variant="secondary" className="h-8 px-3">
                    <Users size={14} className="mr-1" />
                    {users.length} usuarios
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios Registrados</CardTitle>
                    <CardDescription>
                        Asigna roles para controlar el acceso a diferentes módulos del dashboard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {users.map((user) => (
                            <div
                                key={user.id}
                                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/40 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-primary font-bold">
                                            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-medium">{user.name || 'Sin nombre'}</p>
                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Select
                                        value={user.role}
                                        onValueChange={(value) => updateUserRole(user.id, value)}
                                        disabled={user.id === session?.user?.id}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADMIN">
                                                <span className="flex items-center gap-2">
                                                    <Shield size={14} className="text-destructive" />
                                                    Admin
                                                </span>
                                            </SelectItem>
                                            <SelectItem value="USER">
                                                <span className="flex items-center gap-2">
                                                    <Users size={14} className="text-foreground" />
                                                    Usuario
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {user.id === session?.user?.id && (
                                        <Badge variant="outline" className="text-xs">Tú</Badge>
                                    )}
                                </div>
                            </div>
                        ))}

                        {users.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No hay usuarios registrados</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-foreground">
                        <AlertCircle size={18} className="text-primary" />
                        Información sobre Roles
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p><strong>ADMIN:</strong> Acceso completo a todos los módulos, incluyendo gestión de usuarios.</p>
                    <p><strong>USER:</strong> Acceso a módulos operativos (Turnos, Reportes, Tracking).</p>
                </CardContent>
            </Card>
        </div>
    );
}
