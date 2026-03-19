"use client";

import { useState } from "react";

export default function AiDebugPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/ai/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">AI Debug — RAG + Sugerencia</h1>

      <div className="flex gap-2">
        <textarea
          className="flex-1 border rounded p-2 text-sm min-h-[80px] bg-background"
          placeholder="Escribe la consulta del cliente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={run}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded font-medium disabled:opacity-50"
        >
          {loading ? "Procesando..." : "Probar"}
        </button>
      </div>

      {result && (
        <div className="space-y-4 text-sm">

          {/* Info */}
          <div className="flex gap-4 p-3 bg-muted rounded text-xs">
            <span><b>Provider:</b> {result.provider}</span>
            <span><b>Modelo:</b> {result.model}</span>
            <span><b>Chunks totales:</b> {result.chunksTotal}</span>
            <span><b>Chunks encontrados:</b> {result.chunksFound}</span>
          </div>

          {/* Chunks RAG */}
          <div>
            <h2 className="font-semibold mb-2">Contexto RAG ({result.chunksFound} chunks)</h2>
            {result.chunks.length === 0 ? (
              <p className="text-destructive">No se encontraron chunks relevantes — el RAG está vacío o los embeddings no coinciden.</p>
            ) : (
              <div className="space-y-2">
                {result.chunks.map((chunk: { text: string; score: number } | string, i: number) => {
                  const text = typeof chunk === "string" ? chunk : chunk.text;
                  const score = typeof chunk === "object" ? chunk.score : null;
                  return (
                    <div key={i} className="p-3 bg-muted rounded border-l-2 border-primary text-xs whitespace-pre-wrap">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-primary">Chunk {i + 1}</span>
                        {score !== null && (
                          <span className="text-muted-foreground">
                            similitud: <span className={score > 0.6 ? "text-green-500" : score > 0.4 ? "text-yellow-500" : "text-red-500"}>
                              {(score * 100).toFixed(1)}%
                            </span>
                          </span>
                        )}
                      </div>
                      <p>{text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Respuesta IA */}
          <div>
            <h2 className="font-semibold mb-2">Respuesta IA</h2>
            <div className="p-3 bg-muted rounded whitespace-pre-wrap">{result.suggestion}</div>
          </div>

        </div>
      )}
    </div>
  );
}
