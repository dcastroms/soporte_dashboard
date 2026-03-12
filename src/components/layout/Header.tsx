"use client";

import { Bell, Search, LogOut } from 'lucide-react';
import { useSession, signOut } from "next-auth/react";
import { NotificationBell } from '../dashboard/NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { LiveIndicator } from '../dashboard/LiveIndicator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

export function Header() {
    const { data: session } = useSession();

    return (
        <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 sticky top-0 z-40 transition-colors duration-75">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-3 pr-6 border-r border-border">
                    <span className="font-bold text-foreground leading-tight tracking-tight tracking-[-0.04em]">Mediastream</span>
                    <img src="/mediastream-icon.png" alt="" className="h-5 w-5 object-contain" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Soporte 360</span>
                </div>

                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-signal transition-colors duration-75" size={14} />
                    <input
                        type="text"
                        placeholder="Buscar tickets, agentes o proyectos..."
                        className="pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-background w-72 lg:w-96 text-xs transition-all duration-75 placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-focus-within:flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded border border-border bg-card text-[10px] text-muted-foreground font-sans shadow-none">Enter</kbd>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select defaultValue="q1">
                        <SelectTrigger className="w-[130px] h-8 border border-border bg-muted/50 rounded-md text-[11px] font-semibold focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-background transition-all duration-75">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent className="rounded-md border-border bg-popover shadow-md fade-in-0 zoom-in-95">
                            <SelectItem value="q1" className="text-xs">Q1 - 2024</SelectItem>
                            <SelectItem value="q2" className="text-xs">Q2 - 2024</SelectItem>
                            <SelectItem value="q3" className="text-xs">Q3 - 2024</SelectItem>
                            <SelectItem value="q4" className="text-xs">Q4 - 2024</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Live webhook indicator — center */}
            <div className="hidden md:flex">
                <LiveIndicator />
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 border-r border-border pr-3 mr-1">
                    <ThemeToggle />
                    <NotificationBell userId={session?.user?.id as string} />
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-foreground leading-none mb-1">{session?.user?.name || 'Usuario'}</p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{session?.user?.email}</p>
                    </div>
                    <div className="relative group">
                        <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center text-foreground font-bold text-sm border-2 border-background ring-1 ring-border group-hover:ring-signal transition-all duration-75 overflow-hidden cursor-pointer active:scale-[0.98]">
                            {session?.user?.name ? session.user.name.charAt(0) : 'U'}
                        </div>
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all duration-75 active:scale-[0.98]"
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
}
