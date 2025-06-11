/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { decodeBase64 } from './buffer.js';
const WELL_KNOWN_ROUTE = '/.well-known';
export const AUTH_PROTECTED_RESOURCE_METADATA_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/oauth-protected-resource`;
export const AUTH_SERVER_METADATA_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/oauth-authorization-server`;
//#endregion
//#region is functions
export function isAuthorizationProtectedResourceMetadata(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const metadata = obj;
    return metadata.resource !== undefined;
}
export function isAuthorizationServerMetadata(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const metadata = obj;
    return metadata.issuer !== undefined;
}
export function isAuthorizationDynamicClientRegistrationResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.client_id !== undefined;
}
export function isAuthorizationAuthorizeResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.code !== undefined && response.state !== undefined;
}
export function isAuthorizationTokenResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.access_token !== undefined && response.token_type !== undefined;
}
export function isAuthorizationDeviceResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.device_code !== undefined && response.user_code !== undefined && response.verification_uri !== undefined && response.expires_in !== undefined;
}
export function isAuthorizationDeviceTokenErrorResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.error !== undefined && response.error_description !== undefined;
}
//#endregion
export function getDefaultMetadataForUrl(authorizationServer) {
    return {
        issuer: authorizationServer.toString(),
        authorization_endpoint: new URL('/authorize', authorizationServer).toString(),
        token_endpoint: new URL('/token', authorizationServer).toString(),
        registration_endpoint: new URL('/register', authorizationServer).toString(),
        // Default values for Dynamic OpenID Providers
        // https://openid.net/specs/openid-connect-discovery-1_0.html
        response_types_supported: ['code', 'id_token', 'id_token token'],
    };
}
export function getMetadataWithDefaultValues(metadata) {
    const issuer = new URL(metadata.issuer);
    return {
        ...metadata,
        authorization_endpoint: metadata.authorization_endpoint ?? new URL('/authorize', issuer).toString(),
        token_endpoint: metadata.token_endpoint ?? new URL('/token', issuer).toString(),
        registration_endpoint: metadata.registration_endpoint ?? new URL('/register', issuer).toString(),
    };
}
/**
 * Default port for the authorization flow. We try to use this port so that
 * the redirect URI does not change when running on localhost. This is useful
 * for servers that only allow exact matches on the redirect URI. The spec
 * says that the port should not matter, but some servers do not follow
 * the spec and require an exact match.
 */
export const DEFAULT_AUTH_FLOW_PORT = 33418;
export async function fetchDynamicRegistration(registrationEndpoint, clientName) {
    const response = await fetch(registrationEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_name: clientName,
            client_uri: 'https://code.visualstudio.com',
            grant_types: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
            response_types: ['code'],
            redirect_uris: [
                'https://insiders.vscode.dev/redirect',
                'https://vscode.dev/redirect',
                'http://localhost/',
                'http://127.0.0.1/',
                // Added these for any server that might do
                // only exact match on the redirect URI even
                // though the spec says it should not care
                // about the port.
                `http://localhost:${DEFAULT_AUTH_FLOW_PORT}/`,
                `http://127.0.0.1:${DEFAULT_AUTH_FLOW_PORT}/`
            ],
            token_endpoint_auth_method: 'none'
        })
    });
    if (!response.ok) {
        throw new Error(`Registration failed: ${response.statusText}`);
    }
    const registration = await response.json();
    if (isAuthorizationDynamicClientRegistrationResponse(registration)) {
        return registration;
    }
    throw new Error(`Invalid authorization dynamic client registration response: ${JSON.stringify(registration)}`);
}
export function parseWWWAuthenticateHeader(wwwAuthenticateHeaderValue) {
    const parts = wwwAuthenticateHeaderValue.split(' ');
    const scheme = parts[0];
    const params = {};
    if (parts.length > 1) {
        const attributes = parts.slice(1).join(' ').split(',');
        attributes.forEach(attr => {
            const [key, value] = attr.split('=').map(s => s.trim().replace(/"/g, ''));
            params[key] = value;
        });
    }
    return { scheme, params };
}
export function getClaimsFromJWT(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT token format: token must have three parts separated by dots');
    }
    const [header, payload, _signature] = parts;
    try {
        const decodedHeader = JSON.parse(decodeBase64(header).toString());
        if (typeof decodedHeader !== 'object') {
            throw new Error('Invalid JWT token format: header is not a JSON object');
        }
        const decodedPayload = JSON.parse(decodeBase64(payload).toString());
        if (typeof decodedPayload !== 'object') {
            throw new Error('Invalid JWT token format: payload is not a JSON object');
        }
        return decodedPayload;
    }
    catch (e) {
        if (e instanceof Error) {
            throw new Error(`Failed to parse JWT token: ${e.message}`);
        }
        throw new Error('Failed to parse JWT token');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2F1dGguanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2hhcm1vbnkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL29hdXRoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFFM0MsTUFBTSxnQkFBZ0IsR0FBRyxjQUFjLENBQUM7QUFDeEMsTUFBTSxDQUFDLE1BQU0sK0NBQStDLEdBQUcsR0FBRyxnQkFBZ0IsMkJBQTJCLENBQUM7QUFDOUcsTUFBTSxDQUFDLE1BQU0sbUNBQW1DLEdBQUcsR0FBRyxnQkFBZ0IsNkJBQTZCLENBQUM7QUFraUJwRyxZQUFZO0FBRVosc0JBQXNCO0FBRXRCLE1BQU0sVUFBVSx3Q0FBd0MsQ0FBQyxHQUFZO0lBQ3BFLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLEdBQUcsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUM3QyxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFFRCxNQUFNLFFBQVEsR0FBRyxHQUE4QyxDQUFDO0lBQ2hFLE9BQU8sUUFBUSxDQUFDLFFBQVEsS0FBSyxTQUFTLENBQUM7QUFDeEMsQ0FBQztBQUVELE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxHQUFZO0lBQ3pELElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLEdBQUcsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUM3QyxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFDRCxNQUFNLFFBQVEsR0FBRyxHQUFtQyxDQUFDO0lBQ3JELE9BQU8sUUFBUSxDQUFDLE1BQU0sS0FBSyxTQUFTLENBQUM7QUFDdEMsQ0FBQztBQUVELE1BQU0sVUFBVSxnREFBZ0QsQ0FBQyxHQUFZO0lBQzVFLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLEdBQUcsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUM3QyxPQUFPLEtBQUssQ0FBQztJQUNk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