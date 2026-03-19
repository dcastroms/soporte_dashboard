// A.6 — Upload and list knowledge documents (text, markdown, PDF, or image)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chunkText } from "@/lib/chunker";
import { embed } from "@/lib/embeddings";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// GET — list all knowledge docs
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docs = await prisma.knowledgeDoc.findMany({
    select: { id: true, title: true, uploadedBy: true, createdAt: true, docType: true, imageUrl: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(docs);
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // Use pdf-parse v1 — v2 has breaking API changes, pdfjs-dist has worker issues in Next.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const result = await pdfParse(buffer);
  return result.text as string;
}

async function saveImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${randomUUID()}.${ext}`;
  const dest = join(process.cwd(), "public", "knowledge", "images", filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, buffer);
  return `/knowledge/images/${filename}`;
}

// POST — upload a document
// Accepts multipart/form-data with:
//   - "file" (PDF or image) + optional "title" + optional "description" (for images)
//   - OR application/json: { title, content }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let title = "";
  let content = "";
  let docType: "text" | "pdf" | "image" = "text";
  let imageUrl: string | undefined;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Archivo muy grande (máx 20 MB)" }, { status: 400 });
    }

    const mimeType = file.type;

    if (mimeType === "application/pdf") {
      // --- PDF ---
      docType = "pdf";
      title = (formData.get("title") as string | null)?.trim() || file.name.replace(/\.pdf$/i, "");
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        content = await parsePdf(buffer);
      } catch (err) {
        console.error("[PDF parse]", err);
        return NextResponse.json({ error: "No se pudo leer el PDF" }, { status: 422 });
      }
    } else if (IMAGE_TYPES.includes(mimeType)) {
      // --- Image ---
      docType = "image";
      title = (formData.get("title") as string | null)?.trim() || file.name.replace(/\.[^.]+$/, "");
      const description = (formData.get("description") as string | null)?.trim() || "";
      if (!description) {
        return NextResponse.json(
          { error: "Las imágenes requieren una descripción para poder indexarlas" },
          { status: 400 }
        );
      }
      content = description;
      try {
        imageUrl = await saveImage(file);
      } catch (err) {
        console.error("[Image save]", err);
        return NextResponse.json({ error: "No se pudo guardar la imagen" }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { error: "Tipo de archivo no soportado (acepta PDF, JPG, PNG, WebP)" },
        { status: 400 }
      );
    }
  } else {
    // --- Plain text / markdown ---
    let body: { title?: string; content?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    title = body.title?.trim() || "";
    content = body.content?.trim() || "";
    docType = "text";
  }

  if (!title || !content?.trim()) {
    return NextResponse.json({ error: "Se requieren título y contenido" }, { status: 400 });
  }

  // Chunk + embed the text content (for images: embeds the description)
  const textChunks = chunkText(content);

  let chunksWithEmbeddings: { text: string; embedding: number[]; chunkIndex: number }[];
  try {
    chunksWithEmbeddings = await Promise.all(
      textChunks.map(async (text, i) => ({
        text,
        embedding: await embed(text),
        chunkIndex: i,
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const doc = await prisma.knowledgeDoc.create({
    data: {
      title,
      content: content.trim(),
      docType,
      imageUrl: imageUrl ?? null,
      uploadedBy: session.user.name || session.user.email,
      chunks: { create: chunksWithEmbeddings },
    },
    select: { id: true, title: true, createdAt: true, docType: true },
  });

  return NextResponse.json({ doc, chunkCount: chunksWithEmbeddings.length }, { status: 201 });
}
