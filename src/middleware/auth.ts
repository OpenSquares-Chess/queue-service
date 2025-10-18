import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

const keycloakRealmUrl = 'https://auth.opensquares.xyz/realms/opensquares';

const client = jwksClient.default({
    jwksUri: `${keycloakRealmUrl}/protocol/openid-connect/certs`,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) {
            callback(err, undefined);
            return;
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
    });
}

export const validateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided or invalid format' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, getKey, {
        audience: 'game-server',
        issuer: keycloakRealmUrl,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            console.error('Token validation error:', err);
            return res.status(403).json({ message: 'Invalid token' });
        }
        (req as any).user = decoded;
        next();
    });
};
