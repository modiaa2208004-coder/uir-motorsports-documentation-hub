import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { BlobServiceClient } from "@azure/storage-blob";

type EvidenceStorage = {
  put: (objectKey: string, file: File) => Promise<{ size: number; contentType: string }>;
  get: (objectKey: string) => Promise<{ body: ReadableStream<Uint8Array>; size?: number } | null>;
};

function hasAzureConfig() {
  return process.env.EVIDENCE_STORAGE === "azure" && Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING && process.env.AZURE_STORAGE_CONTAINER);
}

function azureStorage(): EvidenceStorage {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const containerName = process.env.AZURE_STORAGE_CONTAINER!;
  const client = BlobServiceClient.fromConnectionString(connectionString);
  const container = client.getContainerClient(containerName);

  return {
    async put(objectKey, file) {
      await container.createIfNotExists();
      const blob = container.getBlockBlobClient(objectKey);
      const bytes = new Uint8Array(await file.arrayBuffer());
      await blob.uploadData(bytes, {
        blobHTTPHeaders: { blobContentType: file.type || "application/octet-stream" },
      });
      return { size: file.size, contentType: file.type || "application/octet-stream" };
    },
    async get(objectKey) {
      const blob = container.getBlobClient(objectKey);
      if (!(await blob.exists())) return null;
      const download = await blob.download();
      const body = download.readableStreamBody;
      if (!body) return null;
      const nodeReadable = body as unknown as Readable;
      return {
        body: Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>,
        size: download.contentLength,
      };
    },
  };
}

function localStorage(): EvidenceStorage {
  const root =
    process.env.LOCAL_EVIDENCE_DIR || path.join(process.cwd(), ".sites-runtime", "evidence");

  return {
    async put(objectKey, file) {
      const safeKey = objectKey.replace(/^\/*/, "").replace(/\.\./g, "_");
      const fullPath = path.join(root, safeKey);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, new Uint8Array(await file.arrayBuffer()));
      return { size: file.size, contentType: file.type || "application/octet-stream" };
    },
    async get(objectKey) {
      const safeKey = objectKey.replace(/^\/*/, "").replace(/\.\./g, "_");
      const fullPath = path.join(root, safeKey);
      try {
        const data = await fs.readFile(fullPath);
        return { body: new Response(data).body! };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}

export function getEvidenceStorage(): EvidenceStorage {
  if (process.env.EVIDENCE_STORAGE === "azure" && !hasAzureConfig()) {
    throw new Error("EVIDENCE_STORAGE=azure requires AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER");
  }
  return hasAzureConfig() ? azureStorage() : localStorage();
}
