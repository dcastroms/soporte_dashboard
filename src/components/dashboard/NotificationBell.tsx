"use client";

import { useState, useEffect } from "react";
import { Bell, Info, CheckCircle2, AlertTriangle, XCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNotifications, markAllAsRead, markNotificationAsRead } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// If DropdownMenu doesn't exist in UI, I'll use a simple state-based one
import * as Popover from "@radix-ui/react-popover";

export function NotificationBell({ userId }: { userId: string }) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const loadNotifications = async () => {
        if (!userId) return;
        const data = await getNotifications(userId);
        setNotifications(data);
    };

    useEffect(() => {
        loadNotifications();
        // Poll every 30 seconds
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkAllAsRead = async () => {
        await markAllAsRead(userId);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleRead = async (id: string) => {
        await markNotificationAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
            case 'error': return <XCircle className="h-4 w-4 text-rose-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full relative transition-colors">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    className="w-80 bg-background rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[100] animate-in fade-in zoom-in-95 duration-200"
                    align="end"
                    sideOffset={5}
                >
                    <div className="flex items-center justify-between p-4 border-b dark:border-slate-800">
                        <h3 className="font-bold text-sm dark:text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[10px] h-7 px-2 text-[#67AA09] hover:text-[#67AA09]/80 font-bold"
                                onClick={handleMarkAllAsRead}
                            >
                                <Check size={12} className="mr-1" />
                                Marcar todo como leído
                            </Button>
                        )}
                    </div>

                    <ScrollArea className="h-80">
                        {notifications.length > 0 ? (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                {notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`p-4 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative ${!n.read ? 'bg-[#67AA09]/5 dark:bg-[#67AA09]/10' : ''}`}
                                        onClick={() => handleRead(n.id)}
                                    >
                                        {!n.read && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#67AA09] rounded-r" />}
                                        <div className="mt-0.5">{getIcon(n.type)}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs leading-snug ${!n.read ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{n.title}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                                            <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-2 font-medium">
                                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                                    <Bell className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                                </div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">No hay notificaciones</p>
                                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Te avisaremos cuando pase algo importante.</p>
                            </div>
                        )}
                    </ScrollArea>
                    <div className="p-2 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-xl">
                        <Button variant="ghost" className="w-full text-xs text-slate-500 hover:text-[#67AA09] h-8">
                            Ver todas las notificaciones
                        </Button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
