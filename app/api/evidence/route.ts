import { asc, eq } from "drizzle-orm";
import { recordEvents, records, evidence } from "../../../db/schema";
import { canEdit, requireApiUser } from "../../auth";
import { getEvidenceStorage } from "../_lib/evidenceStorage";

export const runtime = "nodejs";

async function database() {
  const { getDb } = await import("../../../db");
  return getDb();
}

async function sha256Hex(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const url = new URL(request.url);
    const recordId = (url.searchParams.get("recordId") || "").trim();
    if (!recordId) {
      return Response.json({ error: "recordId is required" }, { status: 400 });
    }

    const rows = await (await database())
      .select()
      .from(evidence)
      .where(eq(evidence.recordId, recordId))
      .orderBy(asc(evidence.createdAt));

    return Response.json({ evidence: rows.filter((item) => !item.deletedAt) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load evidence" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const body = await request.formData();
    const recordId = String(body.get("recordId") ?? "").trim();
    const caption = String(body.get("caption") ?? "").trim();
    const file = body.get("file");
    if (!recordId) return Response.json({ error: "recordId is required" }, { status: 400 });
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }
    const maxUploadSize = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 10 * 1024 * 1024);
    if (file.size > maxUploadSize) {
      return Response.json({ error: `Files must be ${Math.round(maxUploadSize / (1024 * 1024))} MB or smaller` }, { status: 413 });
    }

    const [record] = await (await database())
      .select()
      .from(records)
      .where(eq(records.id, recordId))
      .limit(1);
    if (!record) return Response.json({ error: "Record not found" }, { status: 404 });
    if (!canEdit(auth) && record.ownerUserId !== auth.id) return Response.json({ error: "Only the record owner or a team leader can add evidence." }, { status: 403 });
    if (record.status === "Approved") return Response.json({ error: "This record is sealed because all reviewers approved it. Create a new record for further changes." }, { status: 409 });

    const id = crypto.randomUUID();
    const safeFilename = file.name.replace(/["\r\n]/g, "_");
    const objectKey = `${recordId}/${id}-${safeFilename}`;

    const storage = getEvidenceStorage();
    const stored = await storage.put(objectKey, file);
    const digest = await sha256Hex(file);
    const [item] = await (await database())
      .insert(evidence)
      .values({
        id,
        recordId,
        projectId: record.projectId,
        filename: safeFilename,
        objectKey,
        contentType: stored.contentType,
        size: stored.size,
        caption,
        uploadedByUserId: auth.id,
        sha256: digest,
      })
      .returning();

    await (await database())
      .insert(recordEvents)
      .values({
        id: crypto.randomUUID(),
        recordId: record.id,
        projectId: record.projectId,
        actorUserId: auth.id,
        type: "evidence_added",
        payloadJson: JSON.stringify({
          actorName: auth.displayName,
          evidenceId: item.id,
          filename: item.filename,
          size: item.size,
          sha256: item.sha256,
        }),
      })
      .run();

    return Response.json({ evidence: item }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to upload evidence" },
      { status: 500 },
    );
  }
}
