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

export const validateToken = (token: string, callback: (sub: string | undefined) => void) => {
    jwt.verify(token, getKey, {
        audience: 'queue-service',
        issuer: keycloakRealmUrl,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            console.error('Token validation error:', err);
            callback(undefined);
        } else {
            callback(decoded?.sub as string);
        }
    });
};
