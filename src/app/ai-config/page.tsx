import { AiConfigShell } from "@/components/ai/AiConfigShell";

export const metadata = { title: "Configuración IA — Soporte 360" };

export default function AiConfigPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title uppercase">IA · Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona el asistente de sugerencias, el system prompt y revisa las estadísticas de uso.
        </p>
      </div>
      <AiConfigShell />
    </div>
  );
}
