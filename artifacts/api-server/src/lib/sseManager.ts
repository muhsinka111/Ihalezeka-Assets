import type { Response } from "express";

interface SseClient {
  res: Response;
  heartbeat: ReturnType<typeof setInterval>;
}

const clients = new Map<string, Set<SseClient>>();

export function addSseClient(businessId: string, res: Response): () => void {
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      removeClient(businessId, client);
    }
  }, 25_000);

  const client: SseClient = { res, heartbeat };

  if (!clients.has(businessId)) {
    clients.set(businessId, new Set());
  }
  clients.get(businessId)!.add(client);

  return () => removeClient(businessId, client);
}

function removeClient(businessId: string, client: SseClient) {
  clearInterval(client.heartbeat);
  const set = clients.get(businessId);
  if (set) {
    set.delete(client);
    if (set.size === 0) clients.delete(businessId);
  }
}

export function broadcastToBusinessId(businessId: string, event: string, data: unknown) {
  const set = clients.get(businessId);
  if (!set || set.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of set) {
    try {
      client.res.write(payload);
    } catch {
      removeClient(businessId, client);
    }
  }
}
