"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Shield, Users, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { MODULES } from "@/lib/modules";

interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    permissions: string[];
    createdAt: string;
}

function UserRow({ user, currentUserId, onUpdate }: {
    user: User;
    currentUserId?: string;
    onUpdate: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [permissions, setPermissions] = useState<string[]>(user.permissions ?? []);
    const [saving, setSaving] = useState(false);
    const isSelf = user.id === currentUserId;
    const isAdmin = user.role === "ADMIN";

    const togglePermission = (href: string) => {
        setPermissions((prev) =>
            prev.includes(href) ? prev.filter((p) => p !== href) : [...prev, href]
        );
    };

    const savePermissions = async () => {
        setSaving(true);
        try {
            const resp = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, permissions }),
            });
            if (resp.ok) {
                toast.success("Permisos guardados");
                onUpdate();
            } else {
                toast.error("Error al guardar permisos");
            }
        } finally {
            setSaving(false);
        }
    };

    const updateRole = async (newRole: string) => {
        try {
            const resp = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id, role: newRole }),
            });
            if (resp.ok) {
                toast.success("Rol actualizado");
                onUpdate();
            } else {
                toast.error("Error al actualizar rol");
            }
        } catch {
            toast.error("Error al actualizar rol");
        }
    };

    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold">
                            {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <p className="font-medium">{user.name || "Sin nombre"}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Select
                        value={user.role}
                        onValueChange={updateRole}
                        disabled={isSelf}
                    >
                        <SelectTrigger className="w-[130px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ADMIN">
                                <span className="flex items-center gap-2">
                                    <Shield size={14} className="text-destructive" /> Admin
                                </span>
                            </SelectItem>
                            <SelectItem value="USER">
                                <span className="flex items-center gap-2">
                                    <Users size={14} /> Usuario
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {isSelf && <Badge variant="outline" className="text-xs">Tú</Badge>}

                    {!isAdmin && !isSelf && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded((v) => !v)}
                            className="gap-1 text-xs"
                        >
                            Permisos
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </Button>
                    )}
                </div>
            </div>

            {expanded && !isAdmin && (
                <div className="border-t border-border bg-muted/20 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Módulos accesibles
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                        {MODULES.map((mod) => (
                            <label
                                key={mod.href}
                                className="flex items-center gap-2 cursor-pointer select-none"
                            >
                                <Checkbox
                                    checked={permissions.includes(mod.href)}
                                    onCheckedChange={() => togglePermission(mod.href)}
                                />
                                <span className="text-sm">{mod.label}</span>
                            </label>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={savePermissions} disabled={saving}>
                            {saving ? "Guardando..." : "Guardar permisos"}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPermissions(MODULES.map((m) => m.href))}
                        >
                            Seleccionar todo
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPermissions([])}
                        >
                            Quitar todo
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        try {
            const response = await fetch("/api/admin/users");
            if (response.ok) setUsers(await response.json());
        } catch {
            toast.error("Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    };

    if (status === "loading" || loading) {
        return <div className="flex items-center justify-center h-96"><p className="text-muted-foreground">Cargando...</p></div>;
    }

    if ((session?.user as any)?.role !== "ADMIN") {
        return (
            <div className="flex items-center justify-center h-96">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center gap-4 py-8">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                        <h2 className="text-xl font-bold">Acceso Denegado</h2>
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
                    <p className="page-subtitle">Administra roles y permisos de acceso por módulo.</p>
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
                        Los admins tienen acceso total. Para usuarios con rol <strong>Usuario</strong>, activa los módulos con los checkboxes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {users.map((user) => (
                        <UserRow
                            key={user.id}
                            user={user}
                            currentUserId={session?.user?.id}
                            onUpdate={loadUsers}
                        />
                    ))}
                    {users.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No hay usuarios registrados</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
