"use client";

import { LogOut } from 'lucide-react';
import { useSession, signOut } from "next-auth/react";
import { NotificationBell } from '../dashboard/NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { LiveIndicator } from '../dashboard/LiveIndicator';

export function Header() {
    const { data: session } = useSession();

    return (
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-5 sticky top-0 z-40 transition-colors duration-200">
            {/* Left: spacer */}
            <div className="flex-1" />

            {/* Center: Title */}
            <div className="hidden md:flex flex-col items-center mx-6">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground leading-none">Soporte 360</p>
                <p className="text-[8px] text-muted-foreground/60 tracking-[0.08em] mt-0.5">Sistema Integrado</p>
            </div>

            {/* Right: Controls + User */}
            <div className="flex-1 flex items-center justify-end gap-2">
                {/* Live indicator */}
                <div className="hidden md:flex">
                    <LiveIndicator />
                </div>

                <div className="w-px h-5 bg-border mx-1" />

                <ThemeToggle />
                <NotificationBell userId={session?.user?.id as string} />

                <div className="w-px h-5 bg-border mx-1" />

                {/* User avatar */}
                <div className="flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-[11px] font-semibold text-foreground leading-none">
                            {session?.user?.name ?? 'Usuario'}
                        </p>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                            Administrador
                        </p>
                    </div>
                    <div className="w-7 h-7 bg-primary/15 border border-primary/30 rounded-lg flex items-center justify-center text-primary font-black text-[11px] cursor-pointer hover:bg-primary/25 transition-colors">
                        {session?.user?.name?.charAt(0) ?? 'U'}
                    </div>
                </div>

                <button
                    onClick={() => signOut()}
                    className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all duration-150 active:scale-[0.95]"
                    aria-label="Cerrar sesión"
                    title="Cerrar sesión"
                >
                    <LogOut size={14} />
                </button>
            </div>
        </header>
    );
}
