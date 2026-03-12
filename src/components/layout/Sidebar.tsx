"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import {
    LayoutDashboard,
    Map,
    Target,
    History,
    Zap,
    BarChart3,
    CalendarRange,
    Calendar as CalendarIcon,
    Shield,
    UserCircle2,
    HeartPulse
} from 'lucide-react';
import { cn } from "@/lib/utils";

const menuItems = [
    { icon: LayoutDashboard, label: 'Vista General', href: '/' },
    { icon: Map, label: 'Roadmap y OKRs', href: '/roadmap' },
    { icon: Target, label: 'Seguimiento Semanal', href: '/tracking' },
    { icon: CalendarRange, label: 'Gestión de Turnos', href: '/shifts' },
    { icon: CalendarIcon, label: 'Calendario Eventos', href: '/events' },
    { icon: Zap, label: 'Automatizaciones', href: '/automations' },
    { icon: BarChart3, label: 'Reportes (Intercom)', href: '/reports' },
    { icon: HeartPulse, label: 'CS Intelligence', href: '/clients' },
    { icon: History, label: 'Historial Entregas', href: '/handovers' },
];

export function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const isAdmin = (session?.user as any)?.role === 'ADMIN';

    return (
        <aside className="w-64 border-r border-border bg-background flex flex-col h-screen sticky top-0 transition-colors duration-75">
            <div className="p-6 border-b border-border flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center shrink-0 border border-primary/20 shadow-none">
                    <img src="/mediastream-icon.png" alt="M" className="w-6 h-6 object-contain" />
                </div>
                <div>
                    <h1 className="font-bold text-foreground leading-tight tracking-tight">Mediastream</h1>
                    <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Soporte 360</p>
                </div>
            </div>

            <nav className="flex-1 p-4 overflow-y-auto scrollbar-hide">
                <ul className="space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.label}>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-md transition-all duration-75 text-sm font-medium group active:scale-[0.98]",
                                        isActive
                                            ? "bg-muted text-primary"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    )}
                                >
                                    <item.icon size={18} className={cn("transition-colors", isActive ? "text-primary" : "group-hover:text-primary")} />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}

                    {isAdmin && (
                        <li className="pt-4 mt-4 border-t border-border">
                            <Link
                                href="/admin/users"
                                className={cn(
                                    "flex items-center gap-3 p-2.5 rounded-md transition-all duration-75 text-sm font-medium group active:scale-[0.98]",
                                    pathname === '/admin/users'
                                        ? "bg-muted text-primary"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                <Shield size={18} className={cn("transition-colors", pathname === '/admin/users' ? "text-primary" : "group-hover:text-primary")} />
                                <span>Gestión Usuarios</span>
                            </Link>
                        </li>
                    )}
                </ul>
            </nav>

            <div className="p-4 border-t border-border bg-muted/30">
                <Link
                    href="/account"
                    className="flex items-center gap-3 p-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-75 active:scale-[0.98] mb-4"
                >
                    <UserCircle2 size={18} />
                    <span>Mi Cuenta</span>
                </Link>

                <div className="rounded-md overflow-hidden border border-border bg-card">
                    <ActivityFeed />
                </div>
            </div>
        </aside>
    );
}
