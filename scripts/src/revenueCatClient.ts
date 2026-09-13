import { ReplitConnectors } from "@replit/connectors-sdk";

type JsonRecord = Record<string, unknown>;

export async function revenueCatRequest<T = JsonRecord>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await new ReplitConnectors().proxy("revenuecat", `/v2${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: JsonRecord = {};
  try {
    data = text ? JSON.parse(text) as JsonRecord : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`RevenueCat ${method} ${path} failed (${response.status}): ${JSON.stringify(data)}`);
  }
  return data as T;
}