import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage, type File } from "@google-cloud/storage";
import { canAccessObject, getObjectAclPolicy, setObjectAclPolicy, type ObjectAclPolicy, ObjectPermission } from "./objectAcl";

const SIDECAR = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: { url: `${SIDECAR}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

function parsePath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/");
  if (parts.length < 3 || !parts[1] || !parts.slice(2).join("/")) throw new Error("Invalid object path");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signObjectUrl(bucketName: string, objectName: string, method: "PUT" | "GET") {
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket_name: bucketName, object_name: objectName, method, expires_at: new Date(Date.now() + 900_000).toISOString() }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to sign object URL (${response.status})`);
  const result = await response.json() as { signed_url?: string };
  if (!result.signed_url) throw new Error("Object storage did not return a signed URL");
  return result.signed_url;
}

export class ObjectStorageService {
  getPublicObjectSearchPaths() {
    const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    if (!paths.length) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS is not configured");
    return [...new Set(paths)];
  }

  getPrivateObjectDir() {
    const value = process.env.PRIVATE_OBJECT_DIR?.trim();
    if (!value) throw new Error("PRIVATE_OBJECT_DIR is not configured");
    return value.replace(/\/+$/, "");
  }

  normalizeObjectEntityPath(rawPath: string) {
    if (rawPath.startsWith("/objects/")) return rawPath;
    if (!rawPath.startsWith("https://storage.googleapis.com/")) return rawPath;
    const pathname = new URL(rawPath).pathname;
    const prefix = `${this.getPrivateObjectDir()}/`;
    return pathname.startsWith(prefix) ? `/objects/${pathname.slice(prefix.length)}` : pathname;
  }

  async getObjectEntityUploadURL() {
    const { bucketName, objectName } = parsePath(`${this.getPrivateObjectDir()}/uploads/${randomUUID()}`);
    return signObjectUrl(bucketName, objectName, "PUT");
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    const safePath = filePath.replace(/^\/+/, "").split("/").filter((part) => part && part !== "." && part !== "..").join("/");
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const { bucketName, objectName } = parsePath(`${searchPath}/${safePath}`);
      const file = objectStorageClient.bucket(bucketName).file(objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const { bucketName, objectName } = parsePath(`${this.getPrivateObjectDir()}/${objectPath.slice("/objects/".length)}`);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  async getObjectEntityMetadata(objectPath: string) {
    const file = await this.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    return { file, metadata };
  }

  async deleteObjectEntity(objectPath: string) {
    let file: File;
    try {
      file = await this.getObjectEntityFile(objectPath);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) return false;
      throw error;
    }
    try {
      await file.delete();
      return true;
    } catch (error) {
      const statusCode = (error as { code?: number }).code;
      if (statusCode === 404) return false;
      throw error;
    }
  }

  async downloadObject(file: File, cacheTtlSec = 3600) {
    const [metadata] = await file.getMetadata();
    const policy = await getObjectAclPolicy(file);
    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType ?? "application/octet-stream",
      "Cache-Control": `${policy?.visibility === "public" ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) headers["Content-Length"] = String(metadata.size);
    return new Response(Readable.toWeb(file.createReadStream()) as ReadableStream, { headers });
  }

  async trySetObjectEntityAclPolicy(rawPath: string, policy: ObjectAclPolicy) {
    const normalized = this.normalizeObjectEntityPath(rawPath);
    const file = await this.getObjectEntityFile(normalized);
    await setObjectAclPolicy(file, policy);
    return normalized;
  }

  async canAccessObjectEntity(input: { userId?: string; objectFile: File; requestedPermission?: ObjectPermission }) {
    return canAccessObject({ ...input, requestedPermission: input.requestedPermission ?? ObjectPermission.READ });
  }
}