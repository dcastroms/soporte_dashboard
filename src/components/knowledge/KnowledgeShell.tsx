"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Plus, Trash2, Loader2, FileText, X,
  CheckCircle2, Upload, FileUp, Image as ImageIcon, Download,
} from "lucide-react";
import { BatchImportDialog } from "@/components/knowledge/BatchImportDialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface KnowledgeDoc {
  id: string;
  title: string;
  uploadedBy: string;
  createdAt: string;
  docType: string;
  imageUrl?: string | null;
}

type InputMode = "pdf" | "image" | "text";

const MODES: { id: InputMode; label: string }[] = [
  { id: "pdf",   label: "📄 PDF" },
  { id: "image", label: "🖼️ Imagen" },
  { id: "text",  label: "📝 Texto" },
];

export function KnowledgeShell() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("pdf");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState(""); // for images
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/ai/knowledge");
      if (resp.ok) setDocs(await resp.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function resetForm() {
    setTitle(""); setContent(""); setDescription("");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }

  function handleFileSelect(selected: File | null) {
    if (!selected) return;
    const isPdf = selected.type === "application/pdf";
    const isImage = selected.type.startsWith("image/");
    if (!isPdf && !isImage) {
      toast.error("Solo se aceptan PDF o imágenes (JPG, PNG, WebP)");
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      toast.error("Archivo muy grande (máx 20 MB)");
      return;
    }
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, ""));
    if (isImage) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(selected));
    }
  }

  async function handleUpload() {
    setUploading(true);
    try {
      let resp: Response;

      if (inputMode === "text") {
        if (!title.trim() || !content.trim()) return;
        resp = await fetch("/api/ai/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content }),
        });
      } else {
        if (!file) return;
        const form = new FormData();
        form.append("file", file);
        form.append("title", title || file.name.replace(/\.[^.]+$/, ""));
        if (inputMode === "image") {
          if (!description.trim()) {
            toast.error("Agrega una descripción para que la IA pueda indexar la imagen");
            return;
          }
          form.append("description", description);
        }
        resp = await fetch("/api/ai/knowledge", { method: "POST", body: form });
      }

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Error al subir");
      toast.success(`Indexado — ${data.chunkCount} fragmentos`);
      resetForm();
      setShowForm(false);
      fetchDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const resp = await fetch(`/api/ai/knowledge/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error();
      toast.success("Documento eliminado");
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  const acceptAttr = inputMode === "pdf" ? ".pdf" : inputMode === "image" ? "image/*" : undefined;

  const canSubmit = !uploading && (
    inputMode === "text"
      ? title.trim() && content.trim()
      : !!file && (inputMode === "pdf" || description.trim())
  );

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BookOpen size={17} className="text-primary" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold">Base de Conocimiento</h1>
            <p className="text-[11px] text-muted-foreground">
              Documentos que la IA usa para sus sugerencias (RAG)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBatchDialog(true)}
          className="gap-1.5"
        >
          <Download size={14} />
          Importar tickets
        </Button>
        <Button size="sm" onClick={() => { setShowForm((v) => !v); resetForm(); }} className="gap-1.5">
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancelar" : "Agregar"}
        </Button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setInputMode(m.id); resetForm(); }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                  inputMode === m.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* ── PDF or Image: drop zone ── */}
          {(inputMode === "pdf" || inputMode === "image") && (
            <>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl transition-colors cursor-pointer",
                  dragOver ? "border-primary bg-primary/5" : file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/40"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0] ?? null); }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptAttr}
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />

                {/* Image preview */}
                {inputMode === "image" && previewUrl ? (
                  <div className="p-3 flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-48 rounded-lg object-contain"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB · Haz clic para cambiar
                    </p>
                  </div>
                ) : file ? (
                  <div className="p-8 flex flex-col items-center gap-2">
                    <FileText size={28} className="text-primary" />
                    <p className="text-[13px] font-semibold">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB · Haz clic para cambiar
                    </p>
                  </div>
                ) : (
                  <div className="p-8 flex flex-col items-center gap-2 text-muted-foreground">
                    {inputMode === "image"
                      ? <ImageIcon size={28} className="opacity-40" />
                      : <FileUp size={28} className="opacity-40" />
                    }
                    <p className="text-[13px]">
                      {inputMode === "image"
                        ? "Arrastra una imagen o haz clic para seleccionar"
                        : "Arrastra un PDF o haz clic para seleccionar"}
                    </p>
                    <p className="text-[10px]">
                      {inputMode === "image" ? "JPG, PNG, WebP · máx 20 MB" : "Máx 20 MB"}
                    </p>
                  </div>
                )}
              </div>

              <Input
                placeholder={file ? `Título (por defecto: ${file.name.replace(/\.[^.]+$/, "")})` : "Título (opcional)"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm"
              />

              {/* Description required for images (used for RAG indexing) */}
              {inputMode === "image" && (
                <div className="space-y-1.5">
                  <Textarea
                    placeholder="Describe el contenido de la imagen con detalle (ej: 'Captura del dashboard mostrando el botón de configuración de Endpoints en la sección de Integraciones'). Esta descripción es lo que la IA indexa para buscar."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="text-sm resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    La IA no puede leer imágenes directamente — indexa esta descripción para el RAG.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Text / Markdown ── */}
          {inputMode === "text" && (
            <>
              <Input
                placeholder="Título del documento"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm"
              />
              <Textarea
                placeholder={`Pega el contenido aquí (texto plano o markdown).\n\nEjemplos útiles:\n• Procedimientos de soporte\n• FAQs de clientes\n• Errores comunes y soluciones`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="text-sm font-mono resize-y"
              />
            </>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Vectorizado con{" "}
              <code className="bg-muted px-1 py-0.5 rounded">nomic-embed-text</code>
            </p>
            <Button size="sm" onClick={handleUpload} disabled={!canSubmit} className="gap-1.5">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {uploading ? "Indexando..." : "Subir e indexar"}
            </Button>
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Upload size={36} className="opacity-20" />
          <p className="text-sm">No hay documentos aún</p>
          <p className="text-[11px] text-center max-w-xs">
            Sube PDFs, imágenes o texto con procedimientos y documentación
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {docs.length} {docs.length === 1 ? "documento" : "documentos"} indexados
          </p>
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
            >
              {doc.docType === "image" && doc.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.imageUrl}
                  alt={doc.title}
                  className="w-10 h-10 rounded object-cover shrink-0 border border-border"
                />
              ) : doc.docType === "image" ? (
                <ImageIcon size={15} className="text-primary shrink-0" />
              ) : (
                <FileText size={15} className="text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold truncate">{doc.title}</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {doc.docType}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {doc.uploadedBy} · {format(new Date(doc.createdAt), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
              >
                {deletingId === doc.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
              </Button>
            </div>
          ))}
        </div>
      )}

      <BatchImportDialog open={showBatchDialog} onClose={() => setShowBatchDialog(false)} />
    </div>
  );
}
