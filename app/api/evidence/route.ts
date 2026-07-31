import { asc, eq } from "drizzle-orm";
import { evidence } from "../../../db/schema";

async function database() {
  const { getDb } = await import("../../../db");
  return getDb();
}

async function storage() {
  const { env } = await import("cloudflare:workers");
  return env.BUCKET;
}

export async function GET(request: Request) {
  const recordId = new URL(request.url).searchParams.get("recordId") ?? "";
  if (!recordId) return Response.json({ evidence: [] });

  const rows = await (await database())
    .select()
    .from(evidence)
    .where(eq(evidence.recordId, recordId))
    .orderBy(asc(evidence.createdAt));
  return Response.json({ evidence: rows });
}

export async function POST(request: Request) {
  try {
    const bucket = await storage();
    if (!bucket) {
      return Response.json({ error: "Evidence storage is unavailable" }, { status: 503 });
    }

    const form = await request.formData();
    const recordId = String(form.get("recordId") ?? "").trim();
    const caption = String(form.get("caption") ?? "").trim();
    const file = form.get("file");

    if (!recordId || !(file instanceof File)) {
      return Response.json({ error: "A record and file are required" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: "Files must be 10 MB or smaller" }, { status: 413 });
    }

    const id = `EVD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `evidence/${recordId}/${id}-${safeName}`;
    await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });

    const [item] = await (await database())
      .insert(evidence)
      .values({
        id,
        recordId,
        filename: file.name,
        objectKey,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        caption,
      })
      .returning();

    return Response.json({ evidence: item }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to upload evidence" },
      { status: 500 },
    );
  }
}
