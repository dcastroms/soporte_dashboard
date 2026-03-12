"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncIntercomData } from "@/lib/intercom";
import { toast } from "sonner";

export function SyncIntercomButton() {
    const [loading, setLoading] = useState(false);

    const handleSync = async () => {
        setLoading(true);
        try {
            await syncIntercomData();
            toast.success("Sincronización manual completada");
        } catch (error) {
            toast.error("Error al sincronizar con Intercom");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            onClick={handleSync}
            disabled={loading}
            className="gap-2"
        >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            {loading ? "Sincronizando..." : "Sincronizar Intercom"}
        </Button>
    );
}
