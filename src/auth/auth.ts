import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import 'dotenv/config';

const keycloakRealmUrl = process.env.KEYCLOAK_REALM_URL;

const client = jwksClient.default({
    jwksUri: `${keycloakRealmUrl}/protocol/openid-connect/certs`,
});

interface CustomJwtPayload extends jwt.JwtPayload {
    account_id: string;
}

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

export const validateToken = (token: string, callback: (accountId: string | undefined) => void) => {
    jwt.verify(token, getKey, {
        audience: 'queue-service',
        issuer: keycloakRealmUrl,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            console.error('Token validation error:', err);
            callback(undefined);
        } else {
            const customPayload = decoded as CustomJwtPayload;
            callback(customPayload?.account_id as string);
        }
    });
};
