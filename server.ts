const users = new Map<
  string,
  { id: string; socket: WebSocket; ip: string | null }
>();

// deno-lint-ignore no-explicit-any
function broadcast(data: any, excludeId?: string) {
  users.forEach((user) => {
    if (user.id !== excludeId && user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  });
}

Deno.serve((request, info) => {
  if (request.headers.get('upgrade') !== 'websocket') {
    return new Response(null, { status: 501 });
  }
  const { socket, response } = Deno.upgradeWebSocket(request);
  const id = crypto.randomUUID();

  socket.addEventListener('open', () => {
    const ip = ['tcp', 'udp'].includes(info.remoteAddr.transport)
      ? `${info.remoteAddr.hostname}:${info.remoteAddr.port}`
      : null;
    users.set(id, { id, socket, ip });
    broadcast({ count: users.size });
    console.log(`Connected: ${ip || 'unknown'}`);
  });

  socket.addEventListener('message', (e) => {
    broadcast(e.data, id);
  });

  socket.addEventListener('close', () => {
    if (users.has(id)) {
      users.delete(id);
      broadcast({ count: users.size });
    }
  });

  return response;
});
