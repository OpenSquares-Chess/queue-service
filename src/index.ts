import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from 'redis';
import { validateToken } from './auth';

const PORT = 4000;

const redisClient = createClient({
    url: 'redis://localhost:6379',
});
redisClient.connect();

const redisSubscriber = createClient({
    url: 'redis://localhost:6379',
});
redisSubscriber.connect();

interface ExtWebSocket extends WebSocket {
    alive?: boolean;
    authenticated?: boolean;
}

const clients = new Map<string, ExtWebSocket>();

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: ExtWebSocket) => {
    ws.alive = true;
    ws.authenticated = false;
    ws.on('pong', () => {
        ws.alive = true;
    })
    ws.on('message', (message: string | Buffer) => {
        if (!ws.authenticated) {
            const token = message.toString();
            validateToken(token, (sub) => {
                if (sub) {
                    ws.authenticated = true;
                    const clientId = `${sub}-${Date.now()}`;
                    console.log(`Client ${clientId} connected`);
                    clients.set(clientId, ws);
                    redisClient.lPush('players', clientId);
                    ws.on('close', async () => {
                        console.log(`Client ${clientId} disconnected`);
                        clients.delete(clientId);
                        await redisClient.lRem('players', 0, clientId);
                    })
                } else {
                    ws.close();
                }
            });
        } else if (message.toString() === 'leave') {
            ws.close();
        }
    });
});

const interval = setInterval(() => {
    wss.clients.forEach((client: ExtWebSocket) => {
        if (client.alive === false) {
            client.terminate();
        } else {
            client.alive = false;
            client.ping();
        }
    })
}, 30000);

redisSubscriber.subscribe('matchmaking:queue', (message: string) => {
    const { playerId: clientId, matchInfo } = JSON.parse(message);
    const client = clients.get(clientId);

    if (!client) {
        console.log(`Client ${clientId} not found`);
        return;
    }

    client.send(JSON.stringify(matchInfo));
    client.close();
});

