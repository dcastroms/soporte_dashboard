/**
 * Query bridge to MongoDB proxy Lambda.
 * Mismo patrón que mediastream-tools/lib/db/mongo.js.
 */
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({ region: "us-east-1" });

function getProxyName(): string {
  return process.env.DATABASE_PROXY_URL || "soporte-mongodb-dev-proxy";
}

export interface MongoQueryPayload {
  collection: string;
  operation:
    | "find"
    | "findOne"
    | "insertOne"
    | "insertMany"
    | "updateOne"
    | "updateMany"
    | "replaceOne"
    | "deleteOne"
    | "deleteMany"
    | "countDocuments"
    | "aggregate";
  filter?: Record<string, any>;
  document?: Record<string, any>;
  documents?: Record<string, any>[];
  update?: Record<string, any>;
  options?: Record<string, any>;
  pipeline?: any[];
}

export async function queryProxy<T = any>(payload: MongoQueryPayload): Promise<T> {
  const proxyUrl = getProxyName();

  // Local dev: si DATABASE_PROXY_URL es una URL HTTP, llama al proxy local
  if (proxyUrl.startsWith("http://") || proxyUrl.startsWith("https://")) {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await res.json();
    if (!response.success) {
      throw new Error(response.reason || "MongoDB proxy query failed");
    }
    return response.result as T;
  }

  // Producción: invocar Lambda por nombre
  const cmd = new InvokeCommand({
    FunctionName: proxyUrl,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(payload)),
  });
  const result = await lambda.send(cmd);
  const text = result.Payload
    ? Buffer.from(result.Payload).toString("utf8")
    : "{}";
  const response = JSON.parse(text || "{}");
  if (!response.success) {
    throw new Error(response.reason || "MongoDB proxy query failed");
  }
  return response.result as T;
}
