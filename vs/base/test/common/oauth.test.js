/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import * as sinon from 'sinon';
import { getClaimsFromJWT, getDefaultMetadataForUrl, getMetadataWithDefaultValues, isAuthorizationAuthorizeResponse, isAuthorizationDeviceResponse, isAuthorizationDeviceTokenErrorResponse, isAuthorizationDynamicClientRegistrationResponse, isAuthorizationProtectedResourceMetadata, isAuthorizationServerMetadata, isAuthorizationTokenResponse, parseWWWAuthenticateHeader, fetchDynamicRegistration, DEFAULT_AUTH_FLOW_PORT } from '../../common/oauth.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
import { encodeBase64, VSBuffer } from '../../common/buffer.js';
suite('OAuth', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('Type Guards', () => {
        test('isAuthorizationProtectedResourceMetadata should correctly identify protected resource metadata', () => {
            // Valid metadata
            assert.strictEqual(isAuthorizationProtectedResourceMetadata({ resource: 'https://example.com' }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationProtectedResourceMetadata(null), false);
            assert.strictEqual(isAuthorizationProtectedResourceMetadata(undefined), false);
            assert.strictEqual(isAuthorizationProtectedResourceMetadata({}), false);
            assert.strictEqual(isAuthorizationProtectedResourceMetadata('not an object'), false);
        });
        test('isAuthorizationServerMetadata should correctly identify server metadata', () => {
            // Valid metadata
            assert.strictEqual(isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                response_types_supported: ['code']
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationServerMetadata(null), false);
            assert.strictEqual(isAuthorizationServerMetadata(undefined), false);
            assert.strictEqual(isAuthorizationServerMetadata({}), false);
            assert.strictEqual(isAuthorizationServerMetadata({ response_types_supported: ['code'] }), false);
            assert.strictEqual(isAuthorizationServerMetadata('not an object'), false);
        });
        test('isAuthorizationDynamicClientRegistrationResponse should correctly identify registration response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({
                client_id: 'client-123',
                client_name: 'Test Client'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse(null), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse(undefined), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({}), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({ client_id: 'just-id' }), true);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({ client_name: 'missing-id' }), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse('not an object'), false);
        });
        test('isAuthorizationAuthorizeResponse should correctly identify authorization response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationAuthorizeResponse({
                code: 'auth-code-123',
                state: 'state-123'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationAuthorizeResponse(null), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse(undefined), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse({}), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse({ code: 'missing-state' }), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse({ state: 'missing-code' }), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse('not an object'), false);
        });
        test('isAuthorizationTokenResponse should correctly identify token response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationTokenResponse({
                access_token: 'token-123',
                token_type: 'Bearer'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationTokenResponse(null), false);
            assert.strictEqual(isAuthorizationTokenResponse(undefined), false);
            assert.strictEqual(isAuthorizationTokenResponse({}), false);
            assert.strictEqual(isAuthorizationTokenResponse({ access_token: 'missing-type' }), false);
            assert.strictEqual(isAuthorizationTokenResponse({ token_type: 'missing-token' }), false);
            assert.strictEqual(isAuthorizationTokenResponse('not an object'), false);
        });
        test('isAuthorizationDeviceResponse should correctly identify device authorization response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationDeviceResponse({
                device_code: 'device-code-123',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://example.com/verify',
                expires_in: 1800
            }), true);
            // Valid response with optional fields
            assert.strictEqual(isAuthorizationDeviceResponse({
                device_code: 'device-code-123',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://example.com/verify',
                verification_uri_complete: 'https://example.com/verify?user_code=ABCD-EFGH',
                expires_in: 1800,
                interval: 5
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationDeviceResponse(null), false);
            assert.strictEqual(isAuthorizationDeviceResponse(undefined), false);
            assert.strictEqual(isAuthorizationDeviceResponse({}), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ device_code: 'missing-others' }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ user_code: 'missing-others' }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ verification_uri: 'missing-others' }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ expires_in: 1800 }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({
                device_code: 'device-code-123',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://example.com/verify'
                // Missing expires_in
            }), false);
            assert.strictEqual(isAuthorizationDeviceResponse('not an object'), false);
        });
        test('isAuthorizationDeviceTokenErrorResponse should correctly identify device token error response', () => {
            // Valid error response
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({
                error: 'authorization_pending',
                error_description: 'The authorization request is still pending'
            }), true);
            // Valid error response with different error codes
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({
                error: 'slow_down',
                error_description: 'Polling too fast'
            }), true);
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({
                error: 'access_denied',
                error_description: 'The user denied the request'
            }), true);
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({
                error: 'expired_token',
                error_description: 'The device code has expired'
            }), true);
            // Valid response with optional error_uri
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({
                error: 'invalid_request',
                error_description: 'The request is missing a required parameter',
                error_uri: 'https://example.com/error'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse(null), false);
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse(undefined), false);
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({}), false);
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({ error: 'missing-description' }), false);
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse({ error_description: 'missing-error' }), false);
            assert.strictEqual(isAuthorizationDeviceTokenErrorResponse('not an object'), false);
        });
    });
    suite('Utility Functions', () => {
        test('getDefaultMetadataForUrl should return correct default endpoints', () => {
            const authorizationServer = new URL('https://auth.example.com');
            const metadata = getDefaultMetadataForUrl(authorizationServer);
            assert.strictEqual(metadata.issuer, 'https://auth.example.com/');
            assert.strictEqual(metadata.authorization_endpoint, 'https://auth.example.com/authorize');
            assert.strictEqual(metadata.token_endpoint, 'https://auth.example.com/token');
            assert.strictEqual(metadata.registration_endpoint, 'https://auth.example.com/register');
            assert.deepStrictEqual(metadata.response_types_supported, ['code', 'id_token', 'id_token token']);
        });
        test('getMetadataWithDefaultValues should fill in missing endpoints', () => {
            const minimal = {
                issuer: 'https://auth.example.com',
                response_types_supported: ['code']
            };
            const complete = getMetadataWithDefaultValues(minimal);
            assert.strictEqual(complete.issuer, 'https://auth.example.com');
            assert.strictEqual(complete.authorization_endpoint, 'https://auth.example.com/authorize');
            assert.strictEqual(complete.token_endpoint, 'https://auth.example.com/token');
            assert.strictEqual(complete.registration_endpoint, 'https://auth.example.com/register');
            assert.deepStrictEqual(complete.response_types_supported, ['code']);
        });
        test('getMetadataWithDefaultValues should preserve custom endpoints', () => {
            const custom = {
                issuer: 'https://auth.example.com',
                authorization_endpoint: 'https://auth.example.com/custom-authorize',
                token_endpoint: 'https://auth.example.com/custom-token',
                registration_endpoint: 'https://auth.example.com/custom-register',
                response_types_supported: ['code', 'token']
            };
            const complete = getMetadataWithDefaultValues(custom);
            assert.strictEqual(complete.authorization_endpoint, 'https://auth.example.com/custom-authorize');
            assert.strictEqual(complete.token_endpoint, 'https://auth.example.com/custom-token');
            assert.strictEqual(complete.registration_endpoint, 'https://auth.example.com/custom-register');
        });
    });
    suite('Parsing Functions', () => {
        test('parseWWWAuthenticateHeader should correctly parse simple header', () => {
            const result = parseWWWAuthenticateHeader('Bearer');
            assert.strictEqual(result.scheme, 'Bearer');
            assert.deepStrictEqual(result.params, {});
        });
        test('parseWWWAuthenticateHeader should correctly parse header with parameters', () => {
            const result = parseWWWAuthenticateHeader('Bearer realm="api", error="invalid_token", error_description="The access token expired"');
            assert.strictEqual(result.scheme, 'Bearer');
            assert.deepStrictEqual(result.params, {
                realm: 'api',
                error: 'invalid_token',
                error_description: 'The access token expired'
            });
        });
        test('getClaimsFromJWT should correctly parse a JWT token', () => {
            // Create a sample JWT with known payload
            const payload = {
                jti: 'id123',
                sub: 'user123',
                iss: 'https://example.com',
                aud: 'client123',
                exp: 1716239022,
                iat: 1716235422,
                name: 'Test User'
            };
            // Create fake but properly formatted JWT
            const header = { alg: 'HS256', typ: 'JWT' };
            const encodedHeader = encodeBase64(VSBuffer.fromString(JSON.stringify(header)));
            const encodedPayload = encodeBase64(VSBuffer.fromString(JSON.stringify(payload)));
            const fakeSignature = 'fake-signature';
            const token = `${encodedHeader}.${encodedPayload}.${fakeSignature}`;
            const claims = getClaimsFromJWT(token);
            assert.deepStrictEqual(claims, payload);
        });
        test('getClaimsFromJWT should throw for invalid JWT format', () => {
            // Test with wrong number of parts - should throw "Invalid JWT token format"
            assert.throws(() => getClaimsFromJWT('only.two'), /Invalid JWT token format.*three parts/);
            assert.throws(() => getClaimsFromJWT('one'), /Invalid JWT token format.*three parts/);
            assert.throws(() => getClaimsFromJWT('has.four.parts.here'), /Invalid JWT token format.*three parts/);
        });
        test('getClaimsFromJWT should throw for invalid header content', () => {
            // Create JWT with invalid header
            const encodedHeader = encodeBase64(VSBuffer.fromString('not-json'));
            const encodedPayload = encodeBase64(VSBuffer.fromString(JSON.stringify({ sub: 'test' })));
            const token = `${encodedHeader}.${encodedPayload}.signature`;
            assert.throws(() => getClaimsFromJWT(token), /Failed to parse JWT token/);
        });
        test('getClaimsFromJWT should throw for invalid payload content', () => {
            // Create JWT with valid header but invalid payload
            const header = { alg: 'HS256', typ: 'JWT' };
            const encodedHeader = encodeBase64(VSBuffer.fromString(JSON.stringify(header)));
            const encodedPayload = encodeBase64(VSBuffer.fromString('not-json'));
            const token = `${encodedHeader}.${encodedPayload}.signature`;
            assert.throws(() => getClaimsFromJWT(token), /Failed to parse JWT token/);
        });
    });
    suite('Network Functions', () => {
        let sandbox;
        let fetchStub;
        setup(() => {
            sandbox = sinon.createSandbox();
            fetchStub = sandbox.stub(globalThis, 'fetch');
        });
        teardown(() => {
            sandbox.restore();
        });
        test('fetchDynamicRegistration should make correct request and parse response', async () => {
            // Setup successful response
            const mockResponse = {
                client_id: 'generated-client-id',
                client_name: 'Test Client',
                client_uri: 'https://code.visualstudio.com'
            };
            fetchStub.resolves({
                ok: true,
                json: async () => mockResponse
            });
            const result = await fetchDynamicRegistration('https://auth.example.com/register', 'Test Client');
            // Verify fetch was called correctly
            assert.strictEqual(fetchStub.callCount, 1);
            const [url, options] = fetchStub.firstCall.args;
            assert.strictEqual(url, 'https://auth.example.com/register');
            assert.strictEqual(options.method, 'POST');
            assert.strictEqual(options.headers['Content-Type'], 'application/json');
            // Verify request body
            const requestBody = JSON.parse(options.body);
            assert.strictEqual(requestBody.client_name, 'Test Client');
            assert.strictEqual(requestBody.client_uri, 'https://code.visualstudio.com');
            assert.deepStrictEqual(requestBody.grant_types, ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code']);
            assert.deepStrictEqual(requestBody.response_types, ['code']);
            assert.deepStrictEqual(requestBody.redirect_uris, [
                'https://insiders.vscode.dev/redirect',
                'https://vscode.dev/redirect',
                'http://localhost/',
                'http://127.0.0.1/',
                `http://localhost:${DEFAULT_AUTH_FLOW_PORT}/`,
                `http://127.0.0.1:${DEFAULT_AUTH_FLOW_PORT}/`
            ]);
            // Verify response is processed correctly
            assert.deepStrictEqual(result, mockResponse);
        });
        test('fetchDynamicRegistration should throw error on non-OK response', async () => {
            fetchStub.resolves({
                ok: false,
                statusText: 'Bad Request'
            });
            await assert.rejects(async () => await fetchDynamicRegistration('https://auth.example.com/register', 'Test Client'), /Registration failed: Bad Request/);
        });
        test('fetchDynamicRegistration should throw error on invalid response format', async () => {
            fetchStub.resolves({
                ok: true,
                json: async () => ({ invalid: 'response' }) // Missing required fields
            });
            await assert.rejects(async () => await fetchDynamicRegistration('https://auth.example.com/register', 'Test Client'), /Invalid authorization dynamic client registration response/);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2F1dGgudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvaGFybW9ueS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS90ZXN0L2NvbW1vbi9vYXV0aC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQ2pDLE9BQU8sS0FBSyxLQUFLLE1BQU0sT0FBTyxDQUFDO0FBQy9CLE9BQU8sRUFDTixnQkFBZ0IsRUFDaEIsd0JBQXdCLEVBQ3hCLDRCQUE0QixFQUM1QixnQ0FBZ0MsRUFDaEMsNkJBQTZCLEVBQzdCLHVDQUF1QyxFQUN2QyxnREFBZ0QsRUFDaEQsd0NBQXdDLEVBQ3hDLDZCQUE2QixFQUM3Qiw0QkFBNEIsRUFDNUIsMEJBQTBCLEVBQzFCLHdCQUF3QixFQUd4QixzQkFBc0IsRUFDdEIsTUFBTSx1QkFBdUIsQ0FBQztBQUMvQixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDckUsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUVoRSxLQUFLLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRTtJQUNuQix1Q0FBdUMsRUFBRSxDQUFDO0lBQzFDLEtBQUssQ0FBQyxhQUFhLEVBQUUsR0FBRyxFQUFFO1FBQ3pCLElBQUksQ0FBQyxnR0FBZ0csRUFBRSxHQUFHLEVBQUU7WUFDM0csaUJBQWlCO1lBQ2pCLE1BQU0sQ0FBQyxXQUFXLENBQUMsd0NBQXdDLENBQUMsRUFBRSxRQUFRLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRXhHLGdCQUFnQjtZQUNoQixNQUFNLENBQUMsV0FBVyxDQUFDLHdDQUF3QyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsd0NBQXdDLENBQUMsU0FBUyxD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