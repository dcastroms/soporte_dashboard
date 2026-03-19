"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = pathname === "/login" || pathname === "/register";

    return (
        <AuthProvider>
            {isAuthPage ? (
                children
            ) : (
                <div className="flex h-screen overflow-hidden">
                    <Sidebar />
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <Header />
                        <main className="flex-1 overflow-auto p-6">
                            {children}
                        </main>
                    </div>
                </div>
            )}
        </AuthProvider>
    );
}
