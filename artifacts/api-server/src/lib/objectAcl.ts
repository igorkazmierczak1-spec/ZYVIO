import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export async function setObjectAclPolicy(file: File, policy: ObjectAclPolicy) {
  await file.setMetadata({ metadata: { [ACL_POLICY_METADATA_KEY]: JSON.stringify(policy) } });
}

export async function getObjectAclPolicy(file: File): Promise<ObjectAclPolicy | null> {
  const [metadata] = await file.getMetadata();
  const raw = metadata.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!raw) return null;
  try {
    return JSON.parse(String(raw)) as ObjectAclPolicy;
  } catch {
    return null;
  }
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: File;
  requestedPermission: ObjectPermission;
}) {
  const policy = await getObjectAclPolicy(objectFile);
  if (!policy) return false;
  if (policy.visibility === "public" && requestedPermission === ObjectPermission.READ) return true;
  return Boolean(userId && policy.owner === userId);
}