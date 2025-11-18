import type { WebSocket } from "ws";

// Store connected clients with their tenant IDs
const clients = new Map<WebSocket, string>();

export function registerClient(ws: WebSocket, tenantId: string) {
  clients.set(ws, tenantId);
  
  ws.on("close", () => {
    clients.delete(ws);
  });
}

export function broadcastToTenant(tenantId: string, event: string, data: any) {
  const message = JSON.stringify({ event, data });
  
  clients.forEach((clientTenantId, ws) => {
    if (clientTenantId === tenantId && ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });
}

export function broadcast(event: string, data: any) {
  const message = JSON.stringify({ event, data });
  
  clients.forEach((_, ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  });
}
