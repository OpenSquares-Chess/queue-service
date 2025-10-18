import express from 'express';
import { createClient } from 'redis';
import { validateToken } from './middleware/auth';

const app = express();
const PORT = 3000;

const redisClient = createClient({
    url: 'redis://host.docker.internal:6379',
});
redisClient.connect();

const redisSubscriber = createClient({
    url: 'redis://host.docker.internal:6379',
});
redisSubscriber.connect();

interface SSEClient {
    id: string;
    res: express.Response;
}

const clients = new Map<string, SSEClient>();

function sseHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.flushHeaders();
    next();
}

app.get('/', validateToken, sseHeaders, async (req, res) => {
    const playerId = (req as any).user.sub;
    const clientId = `${playerId}-${Date.now()}`;

    console.log(`New player connected: ${playerId}`);

    clients.set(clientId, { id: clientId, res });

    const keepAliveInterval = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
        clearInterval(keepAliveInterval);
        clients.delete(clientId);
    });

    await redisClient.lPush('players', playerId);
});

redisSubscriber.subscribe('matchmaking:queue1', (message: string) => {
    const { playerId, matchInfo } = JSON.parse(message);

    clients.forEach((client) => {
        if (client.id.startsWith(playerId)) {
            client.res.write(`event: matchFound\n`);
            client.res.write(`data: ${JSON.stringify(matchInfo)}\n\n`);
            client.res.end();
        }
    });
});

app.listen(PORT, () => {
    console.log(`Queue service listening on port ${PORT}`);
});

