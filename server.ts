import { encode } from '@std/msgpack';
import { Application } from '@oak/oak/application';
import { Router } from '@oak/oak/router';

const app = new Application();
const router = new Router();

type Socket = {
  socketId: string;
  socket: WebSocket;
  ipAddr: string | null;
};

type Room = {
  roomId: string;
  sockets: Map<string, Socket>;
};

const rooms = new Map<string, Room>();

type BroadcastOptions = {
  forceEncode?: boolean;
  excludeId?: string;
};

function broadcast(
  roomId: string,
  // deno-lint-ignore no-explicit-any
  data: any,
  options: BroadcastOptions = { forceEncode: true },
) {
  const dataEncoded = options.forceEncode ? encode(data) : data;
  rooms.get(roomId)?.sockets.forEach((e) => {
    if (
      e.socketId === options.excludeId ||
      e.socket.readyState !== WebSocket.OPEN
    ) return;
    e.socket.send(dataEncoded);
  });
}

router.get('/chat/:id', (ctx) => {
  if (ctx.isUpgradable) {
    const socket = ctx.upgrade();
    const roomId = ctx.params.id;
    const id = crypto.randomUUID();

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { roomId: id, sockets: new Map() });
    }
    const room = rooms.get(roomId);

    socket.addEventListener('open', () => {
      const ipAddr = ctx.request.ip;
      console.log(`Socket ${id} connected from ${ipAddr}`);

      room?.sockets.set(id, { socketId: id, socket, ipAddr });
      broadcast(roomId, { count: room?.sockets.size });
    });

    socket.addEventListener('message', (e) => {
      broadcast(roomId, e.data, { excludeId: id, forceEncode: false });
    });

    socket.addEventListener('close', () => {
      room?.sockets.delete(id);
      broadcast(roomId, { count: room?.sockets.size });
    });
  } else {
    ctx.response.status = 400;
    ctx.response.body = 'Connection cannot be upgraded to WebSocket';
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', (e) => {
  console.log(
    `Listening on ${e.secure ? 'https' : 'http'}://${
      e.hostname ?? 'localhost'
    }:${e.port}`,
  );
});

app.listen({ port: 8080 });
