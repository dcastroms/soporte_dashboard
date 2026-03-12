"use client";

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { checkPendingHandover } from '@/lib/actions';
import { HandoverDialog } from './HandoverDialog';
import { Button } from '@/components/ui/button';

export function HandoverAlert({ assignments }: { assignments: any[] }) {
    const { data: session } = useSession();
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        if (session?.user?.name) {
            checkStatus(session.user.name);
        }

        const handleUpdate = () => {
            if (session?.user?.name) {
                checkStatus(session.user.name);
            }
        };

        window.addEventListener('handover-updated', handleUpdate);
        return () => window.removeEventListener('handover-updated', handleUpdate);
    }, [session]);

    const checkStatus = async (agentName: string) => {
        const pending = await checkPendingHandover(agentName);
        setIsPending(pending);
    };

    if (!isPending) return null;

    return (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-3 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
                <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-full">
                    <AlertCircle className="text-red-600 dark:text-red-400 h-5 w-5" />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-red-700 dark:text-red-300">Entrega de Turno Pendiente</h4>
                    <p className="text-xs text-red-600 dark:text-red-400/80">
                        Tu turno ha finalizado. Tienes {assignments.length > 0 ? assignments.length : 'varios'} tickets pendientes. Por favor registra la entrega.
                    </p>
                </div>
            </div>

            {/* Reutilizamos el diálogo pero con un botón personalizado */}
            <HandoverDialog
                assignments={assignments}
                customTrigger={
                    <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 text-xs">
                        Realizar Entrega
                    </Button>
                }
            />
        </div>
    );
}
