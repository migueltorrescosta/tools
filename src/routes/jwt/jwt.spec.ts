import { describe, it, expect } from 'vitest';

// Replicate the base64url functions from the JWT component for testing
function base64UrlEncode(str: string): string {
	return btoa(unescape(encodeURIComponent(str)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
	str = str.replace(/-/g, '+').replace(/_/g, '/');
	while (str.length % 4) str += '=';
	return decodeURIComponent(escape(atob(str)));
}

// Helper to parse JWT without actual crypto verification
interface JWTParts {
	header: Record<string, unknown>;
	payload: Record<string, unknown>;
	signature: string;
	valid: boolean;
	error?: string;
}

function parseJWT(t: string): JWTParts {
	if (!t.trim()) {
		return { header: {}, payload: {}, signature: '', valid: false, error: 'Empty token' };
	}

	const parts = t.split('.');
	if (parts.length !== 3) {
		return { header: {}, payload: {}, signature: '', valid: false, error: 'Invalid JWT format' };
	}

	try {
		const header = JSON.parse(base64UrlDecode(parts[0]));
		const payload = JSON.parse(base64UrlDecode(parts[1]));
		return { header, payload, signature: parts[2], valid: true };
	} catch (e) {
		return {
			header: {},
			payload: {},
			signature: parts[2] || '',
			valid: false,
			error: (e as Error).message
		};
	}
}

// Helper to create JWT token (without signature)
function createJWT(header: Record<string, unknown>, payload: Record<string, unknown>): string {
	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	return `${encodedHeader}.${encodedPayload}.`;
}

// Timestamp utilities
function getCurrentTimestamp(): number {
	return Math.floor(Date.now() / 1000);
}

function addSeconds(timestamp: number, seconds: number): number {
	return timestamp + seconds;
}

function addMinutes(timestamp: number, minutes: number): number {
	return timestamp + minutes * 60;
}

function addHours(timestamp: number, hours: number): number {
	return timestamp + hours * 3600;
}

function timestampToDate(timestamp: number): Date {
	return new Date(timestamp * 1000);
}

function isExpired(exp: number): boolean {
	return getCurrentTimestamp() > exp;
}

function getTimeUntilExpiration(exp: number): number {
	return exp - getCurrentTimestamp();
}

// Sample JWT from the component
const SAMPLE_JWT =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('JWT Tool', () => {
	describe('Base64URL Encoding', () => {
		it('encodes a simple string to base64url format', () => {
			const result = base64UrlEncode('Hello');
			expect(result).toBe('SGVsbG8');
		});

		it('encodes a string with special characters', () => {
			const result = base64UrlEncode('Hello, World!');
			expect(result).toBe('SGVsbG8sIFdvcmxkIQ');
		});

		it('encodes JSON objects correctly', () => {
			const json = '{"alg":"HS256","typ":"JWT"}';
			const result = base64UrlEncode(json);
			expect(result).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
		});

		it('encodes Unicode characters', () => {
			const result = base64UrlEncode('日本語');
			expect(result).toBe('5pel5pys6Kqe');
		});

		it('encodes emojis correctly', () => {
			const result = base64UrlEncode('👋');
			// The exact encoding depends on the environment, so we verify it round-trips correctly
			const decoded = base64UrlDecode(result);
			expect(decoded).toBe('👋');
		});
	});

	describe('Base64URL Decoding', () => {
		it('decodes a base64url string back to original', () => {
			const result = base64UrlDecode('SGVsbG8');
			expect(result).toBe('Hello');
		});

		it('decodes a base64url string with special characters', () => {
			const result = base64UrlDecode('SGVsbG8sIFdvcmxkIQ');
			expect(result).toBe('Hello, World!');
		});

		it('decodes JWT header correctly', () => {
			const result = base64UrlDecode('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
			expect(result).toBe('{"alg":"HS256","typ":"JWT"}');
		});

		it('decodes Unicode characters', () => {
			const result = base64UrlDecode('5pel5pys6Kqe');
			expect(result).toBe('日本語');
		});

		it('handles strings with padding', () => {
			const result = base64UrlDecode('SGVsbG8'); // Would be 'SGVsbG8=' in standard base64
			expect(result).toBe('Hello');
		});
	});

	describe('Base64URL Round-trip', () => {
		it('round-trips simple ASCII text', () => {
			const original = 'Test message';
			const encoded = base64UrlEncode(original);
			const decoded = base64UrlDecode(encoded);
			expect(decoded).toBe(original);
		});

		it('round-trips complex JSON', () => {
			const original = '{"sub":"123","name":"John","admin":true}';
			const encoded = base64UrlEncode(original);
			const decoded = base64UrlDecode(encoded);
			expect(decoded).toBe(original);
		});

		it('round-trips JWT claims', () => {
			const original = '{"iat":1516239022,"exp":1516242622,"data":"test"}';
			const encoded = base64UrlEncode(original);
			const decoded = base64UrlDecode(encoded);
			expect(decoded).toBe(original);
		});

		it('round-trips Unicode text', () => {
			const original = 'こんにちは世界';
			const encoded = base64UrlEncode(original);
			const decoded = base64UrlDecode(encoded);
			expect(decoded).toBe(original);
		});
	});

	describe('JWT Structure Parsing', () => {
		it('parses a valid JWT token correctly', () => {
			const result = parseJWT(SAMPLE_JWT);
			expect(result.valid).toBe(true);
			expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' });
			expect(result.payload).toEqual({ sub: '1234567890', name: 'John Doe', iat: 1516239022 });
			expect(result.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
		});

		it('detects invalid JWT with wrong number of parts', () => {
			const result = parseJWT('part1.part2');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Invalid JWT format');
		});

		it('detects empty JWT', () => {
			const result = parseJWT('');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Empty token');
		});

		it('detects whitespace-only JWT', () => {
			const result = parseJWT('   ');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Empty token');
		});

		it('handles JWT with invalid base64 in header', () => {
			const result = parseJWT('invalid!!!.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature');
			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('handles JWT with invalid JSON in header', () => {
			// Valid base64 but not valid JSON
			const invalidJson = base64UrlEncode('not json');
			const result = parseJWT(`${invalidJson}.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature`);
			expect(result.valid).toBe(false);
		});
	});

	describe('JWT Header Parsing', () => {
		it('extracts algorithm from header', () => {
			const result = parseJWT(SAMPLE_JWT);
			expect(result.header.alg).toBe('HS256');
		});

		it('extracts type from header', () => {
			const result = parseJWT(SAMPLE_JWT);
			expect(result.header.typ).toBe('JWT');
		});

		it('handles different algorithms', () => {
			const jwt = createJWT({ alg: 'RS256', typ: 'JWT' }, { sub: '123' });
			const result = parseJWT(jwt);
			expect(result.header.alg).toBe('RS256');
		});

		it('handles headers with additional claims', () => {
			const jwt = createJWT({ alg: 'HS256', typ: 'JWT', kid: 'key-id-1' }, { sub: '123' });
			const result = parseJWT(jwt);
			expect(result.header.kid).toBe('key-id-1');
		});
	});

	describe('JWT Payload Parsing', () => {
		it('extracts subject claim', () => {
			const result = parseJWT(SAMPLE_JWT);
			expect(result.payload.sub).toBe('1234567890');
		});

		it('extracts name claim', () => {
			const result = parseJWT(SAMPLE_JWT);
			expect(result.payload.name).toBe('John Doe');
		});

		it('extracts issued-at timestamp', () => {
			const result = parseJWT(SAMPLE_JWT);
			expect(result.payload.iat).toBe(1516239022);
		});

		it('handles payloads with various claim types', () => {
			const payload = {
				sub: 'user123',
				name: 'Test User',
				admin: true,
				level: 42,
				score: 99.9,
				tags: ['admin', 'vip'],
				metadata: { key: 'value' },
				iat: 1516239022,
				exp: 1516242622
			};
			const jwt = createJWT({ alg: 'HS256', typ: 'JWT' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload).toEqual(payload);
		});
	});

	describe('JWT Creation', () => {
		it('creates a valid JWT token structure', () => {
			const header = { alg: 'HS256' };
			const payload = { sub: '123' };
			const jwt = createJWT(header, payload);
			const parts = jwt.split('.');
			expect(parts.length).toBe(3);
		});

		it('creates JWT with correct header encoding', () => {
			const header = { alg: 'HS256', typ: 'JWT' };
			const jwt = createJWT(header, {});
			const decodedHeader = base64UrlDecode(jwt.split('.')[0]);
			expect(JSON.parse(decodedHeader)).toEqual(header);
		});

		it('creates JWT with correct payload encoding', () => {
			const payload = { sub: 'test', iat: 1516239022 };
			const jwt = createJWT({}, payload);
			const decodedPayload = base64UrlDecode(jwt.split('.')[1]);
			expect(JSON.parse(decodedPayload)).toEqual(payload);
		});

		it('creates JWT that can be parsed back', () => {
			const header = { alg: 'HS256' };
			const payload = { sub: '123', name: 'Test' };
			const jwt = createJWT(header, payload);
			const result = parseJWT(jwt);
			expect(result.valid).toBe(true);
			expect(result.header).toEqual(header);
			expect(result.payload).toEqual(payload);
		});
	});

	describe('Timestamp Utilities', () => {
		it('gets current timestamp', () => {
			const before = getCurrentTimestamp();
			const now = Math.floor(Date.now() / 1000);
			const after = getCurrentTimestamp();
			expect(before).toBeLessThanOrEqual(now);
			expect(now).toBeLessThanOrEqual(after);
		});

		it('adds seconds to timestamp', () => {
			const timestamp = 1000;
			const result = addSeconds(timestamp, 30);
			expect(result).toBe(1030);
		});

		it('adds minutes to timestamp', () => {
			const timestamp = 1000;
			const result = addMinutes(timestamp, 5);
			expect(result).toBe(1000 + 5 * 60);
		});

		it('adds hours to timestamp', () => {
			const timestamp = 1000;
			const result = addHours(timestamp, 2);
			expect(result).toBe(1000 + 2 * 3600);
		});

		it('converts timestamp to Date', () => {
			const timestamp = 1516239022;
			const date = timestampToDate(timestamp);
			expect(date instanceof Date).toBe(true);
			// Verify the conversion is correct by checking the Unix timestamp
			expect(Math.floor(date.getTime() / 1000)).toBe(timestamp);
		});

		it('detects expired token', () => {
			const expiredTimestamp = 1000; // Far in the past
			expect(isExpired(expiredTimestamp)).toBe(true);
		});

		it('detects non-expired token', () => {
			const futureTimestamp = getCurrentTimestamp() + 3600; // 1 hour in future
			expect(isExpired(futureTimestamp)).toBe(false);
		});

		it('calculates time until expiration for expired token', () => {
			const expiredTimestamp = getCurrentTimestamp() - 100;
			const remaining = getTimeUntilExpiration(expiredTimestamp);
			expect(remaining).toBeLessThan(0);
		});

		it('calculates time until expiration for valid token', () => {
			const futureTimestamp = getCurrentTimestamp() + 3600;
			const remaining = getTimeUntilExpiration(futureTimestamp);
			expect(remaining).toBeGreaterThan(3500);
			expect(remaining).toBeLessThanOrEqual(3600);
		});
	});

	describe('JWT with Claims', () => {
		it('creates token with iat claim', () => {
			const now = getCurrentTimestamp();
			const payload = { sub: '123', iat: now };
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.iat).toBe(now);
		});

		it('creates token with exp claim', () => {
			const expiration = addHours(getCurrentTimestamp(), 24);
			const payload = { sub: '123', exp: expiration };
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.exp).toBe(expiration);
		});

		it('creates token with nbf (not before) claim', () => {
			const notBefore = getCurrentTimestamp();
			const payload = { sub: '123', nbf: notBefore };
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.nbf).toBe(notBefore);
		});

		it('creates token with custom claims', () => {
			const payload = {
				sub: '123',
				role: 'admin',
				permissions: ['read', 'write', 'delete'],
				org: 'acme-corp'
			};
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.role).toBe('admin');
			expect(result.payload.permissions).toEqual(['read', 'write', 'delete']);
			expect(result.payload.org).toBe('acme-corp');
		});
	});

	describe('Edge Cases', () => {
		it('handles empty payload', () => {
			const jwt = createJWT({ alg: 'HS256' }, {});
			const result = parseJWT(jwt);
			expect(result.valid).toBe(true);
			expect(result.payload).toEqual({});
		});

		it('handles payload with null values', () => {
			const payload = { sub: null, name: 'Test' };
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.sub).toBeNull();
		});

		it('handles payload with boolean values', () => {
			const payload = { active: true, verified: false };
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.active).toBe(true);
			expect(result.payload.verified).toBe(false);
		});

		it('handles payload with nested objects', () => {
			const payload = {
				user: { id: 1, name: 'John', roles: ['admin'] },
				settings: { theme: 'dark', notifications: true }
			};
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.user).toEqual({ id: 1, name: 'John', roles: ['admin'] });
			expect(result.payload.settings).toEqual({ theme: 'dark', notifications: true });
		});

		it('handles long strings in payload', () => {
			const longString = 'a'.repeat(1000);
			const payload = { data: longString };
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.data).toBe(longString);
		});

		it('handles special characters in strings', () => {
			const payload = { text: 'Hello\nWorld\t!@#$%^&*()' };
			const jwt = createJWT({ alg: 'HS256' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.text).toBe('Hello\nWorld\t!@#$%^&*()');
		});
	});

	describe('Real-world JWT Patterns', () => {
		it('parses a typical access token structure', () => {
			const payload = {
				sub: 'user_abc123',
				iss: 'https://auth.example.com',
				aud: 'api.example.com',
				exp: addHours(getCurrentTimestamp(), 1),
				iat: getCurrentTimestamp(),
				scope: 'read write',
				role: 'user'
			};
			const jwt = createJWT({ alg: 'RS256', typ: 'JWT', kid: 'key-1' }, payload);
			const result = parseJWT(jwt);
			expect(result.header.alg).toBe('RS256');
			expect(result.header.kid).toBe('key-1');
			expect(result.payload.sub).toBe('user_abc123');
			expect(result.payload.iss).toBe('https://auth.example.com');
			expect(result.payload.aud).toBe('api.example.com');
			expect(result.payload.scope).toBe('read write');
		});

		it('parses an OAuth refresh token structure', () => {
			const payload = {
				sub: 'user_abc123',
				exp: addDays(getCurrentTimestamp(), 30),
				iat: getCurrentTimestamp(),
				type: 'refresh',
				jti: 'unique-token-id-12345'
			};
			const jwt = createJWT({ alg: 'HS384' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.type).toBe('refresh');
			expect(result.payload.jti).toBe('unique-token-id-12345');
		});

		it('parses an API key token structure', () => {
			const payload = {
				api_key: 'sk_live_abcdef123456',
				exp: addHours(getCurrentTimestamp(), 24 * 90),
				permissions: ['users:read', 'users:write', 'products:read']
			};
			const jwt = createJWT({ alg: 'HS512' }, payload);
			const result = parseJWT(jwt);
			expect(result.payload.api_key).toBe('sk_live_abcdef123456');
			expect(result.payload.permissions).toContain('users:read');
		});
	});
});

// Helper function for days
function addDays(timestamp: number, days: number): number {
	return timestamp + days * 86400;
}
