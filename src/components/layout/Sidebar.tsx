"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    LayoutDashboard,
    Map,
    History,
    BarChart3,
    CalendarRange,
    Calendar as CalendarIcon,
    Shield,
    UserCircle2,
    Brain,
    ChevronRight,
    MessageSquare,
    BookOpen,
    SlidersHorizontal,
    Activity,
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface NavItem {
    icon: React.ElementType;
    label: string;
    href: string;
}

interface NavSection {
    title: string;
    items: NavItem[];
}

const navSections: NavSection[] = [
    {
        title: "Principal",
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
            { icon: MessageSquare, label: 'Chat Proxy', href: '/chat' },
            { icon: BarChart3, label: 'Reportes', href: '/reports' },
            { icon: Brain, label: 'CS Intelligence', href: '/clients' },
        ],
    },
    {
        title: "Operaciones",
        items: [
            { icon: Activity, label: 'Seguimiento Semanal', href: '/tracking' },
            { icon: Map, label: 'Roadmap · OKRs', href: '/roadmap' },
            { icon: CalendarRange, label: 'Turnos', href: '/shifts' },
            { icon: CalendarIcon, label: 'Calendario', href: '/events' },
            { icon: History, label: 'Entregas de Turno', href: '/handovers' },
        ],
    },
    {
        title: "Configuración",
        items: [
            { icon: BookOpen, label: 'Base de Conocimiento', href: '/knowledge' },
            { icon: SlidersHorizontal, label: 'Config IA', href: '/ai-config' },
        ],
    },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
    return (
        <li className="relative">
            {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
            )}
            <Link
                href={item.href}
                className={cn(
                    "flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-lg transition-all duration-150 text-[12px] font-medium group",
                    isActive
                        ? "bg-sidebar-accent text-primary"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
            >
                <item.icon
                    size={15}
                    className={cn(
                        "shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/80"
                    )}
                />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight size={11} className="ml-auto text-primary/60 shrink-0" />}
            </Link>
        </li>
    );
}

export function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const isAdmin = (session?.user as any)?.role === 'ADMIN';

    return (
        <aside className="w-56 border-r border-sidebar-border bg-sidebar flex flex-col h-screen sticky top-0 transition-colors duration-200">
            {/* Logo / Brand */}
            <div className="px-4 py-5 border-b border-sidebar-border">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-primary/15 rounded-lg flex items-center justify-center shrink-0 border border-primary/25">
                        <img src="/mediastream-icon.png" alt="M" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-black text-sidebar-foreground/80 leading-none tracking-wide truncate">MEDIASTREAM</p>
                        <p className="text-[9px] font-bold text-primary uppercase tracking-[0.18em] mt-0.5">Soporte 360</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hide space-y-4">
                {navSections.map((section) => (
                    <div key={section.title}>
                        <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/35 select-none">
                            {section.title}
                        </p>
                        <ul className="space-y-0.5">
                            {section.items.map((item) => (
                                <NavLink key={item.href} item={item} isActive={pathname === item.href} />
                            ))}
                        </ul>
                    </div>
                ))}

                {/* Admin section */}
                {isAdmin && (
                    <div>
                        <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/35 select-none">
                            Admin
                        </p>
                        <ul className="space-y-0.5">
                            <li className="relative">
                                {pathname === '/admin/users' && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                                )}
                                <Link
                                    href="/admin/users"
                                    className={cn(
                                        "flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-lg transition-all duration-150 text-[12px] font-medium group",
                                        pathname === '/admin/users'
                                            ? "bg-sidebar-accent text-primary"
                                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                                    )}
                                >
                                    <Shield size={15} className={cn(
                                        "shrink-0 transition-colors",
                                        pathname === '/admin/users' ? "text-primary" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/80"
                                    )} />
                                    <span className="truncate">Gestión Usuarios</span>
                                </Link>
                            </li>
                        </ul>
                    </div>
                )}
            </nav>

            {/* Footer */}
            <div className="px-2 py-3 border-t border-sidebar-border">
                <div className="relative">
                    {pathname === '/account' && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                    )}
                    <Link
                        href="/account"
                        className={cn(
                            "flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 group",
                            pathname === '/account'
                                ? "bg-sidebar-accent text-primary"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                    >
                        <UserCircle2 size={15} className="shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/80 transition-colors" />
                        <span className="truncate">Mi Cuenta</span>
                    </Link>
                </div>

                {/* User badge */}
                <div className="flex items-center gap-2 px-3 py-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-black text-primary">
                            {session?.user?.name?.charAt(0) ?? 'U'}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-sidebar-foreground/80 truncate leading-none">
                            {session?.user?.name ?? 'Usuario'}
                        </p>
                        <p className="text-[8px] text-sidebar-foreground/40 truncate mt-0.5">
                            {isAdmin ? 'Administrador' : 'Agente'}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
