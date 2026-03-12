import { notFound } from "next/navigation";
import { ClientAuditView } from "@/components/dashboard/ClientAuditView";
import { getClientAudit } from "@/lib/clientIntelActions";
import { getClientNotes, getClientActions } from "@/lib/clientNoteActions";

export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ client: string }>;
}

export default async function ClientAuditPage({ params }: Props) {
    const { client } = await params;

    const [auditData, notes, actions] = await Promise.all([
        getClientAudit(client).catch(() => null),
        getClientNotes(client),
        getClientActions(client),
    ]);

    if (!auditData) return notFound();

    return (
        <div className="min-h-screen p-6">
            <ClientAuditView
                data={auditData}
                initialNotes={notes as any[]}
                initialActions={actions as any[]}
            />
        </div>
    );
}

export async function generateMetadata({ params }: Props) {
    const { client } = await params;
    const name = decodeURIComponent(client);
    return {
        title: `Auditoría — ${name} | Soporte 360`,
    };
}
