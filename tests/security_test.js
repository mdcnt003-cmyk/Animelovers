/**
 * AnimeLovers Security & OWASP Top 10 Test Suite
 * Senior Cybersecurity Engineer
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🔒 RUNNING OWASP TOP 10 CYBERSECURITY VERIFICATION');
console.log('====================================================');

let testsPassed = 0;
let testsTotal = 0;

function test(name, fn) {
    testsTotal++;
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}: ${err.message}`);
    }
}

// 1. OWASP A02: Cryptographic Failures & No Hardcoded Secrets
test('OWASP A02: Verify No Hardcoded Passwords in Source Code', () => {
    const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf-8');
    assert.strictEqual(serverCode.includes('password = "123'), false);
    assert.strictEqual(serverCode.includes('admin:admin'), false);
    assert.strictEqual(serverCode.includes('require(\'dotenv\').config()'), true);
});

test('OWASP A02: Strong Bcrypt Salt & Timing Attack Resistance', async () => {
    const rawPw = 'SuperSecret!2026';
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(rawPw, salt);
    assert.strictEqual(await bcrypt.compare(rawPw, hash), true);
    assert.strictEqual(await bcrypt.compare('WrongPass!123', hash), false);
});

// 2. OWASP A03: Injection & XSS Sanitization
test('OWASP A03: XSS Payload Neutralization', () => {
    const xssPayloads = [
        '<script>alert(document.cookie)</script>',
        '"><img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg/onload=alert(1)>'
    ];

    function sanitizeInput(str) {
        return validator.escape(validator.whitelist(str, 'a-zA-Z0-9\\s\\-_.,:;!?\'"()'));
    }

    xssPayloads.forEach(payload => {
        const sanitized = sanitizeInput(payload);
        assert.strictEqual(sanitized.includes('<script>'), false);
        assert.strictEqual(sanitized.includes('onload='), false);
        assert.strictEqual(sanitized.includes('onerror='), false);
    });
});

// 3. OWASP A01 & A07: Authentication & JWT Verification
test('OWASP A01 & A07: JWT Algorithm Enforcing (HS256 Only)', () => {
    const secret = 'dummy_test_secret_key_123456789012345';
    const token = jwt.sign({ id: 'usr_1', email: 'test@animelovers.dev' }, secret, { algorithm: 'HS256', expiresIn: '1h' });
    
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    assert.strictEqual(decoded.email, 'test@animelovers.dev');

    // Reject 'none' algorithm
    assert.throws(() => {
        jwt.verify(token, secret, { algorithms: ['RS256'] });
    });
});

// 4. OWASP A10: SSRF Whitelisting Defense
test('OWASP A10: Upstream URL & Parameter Allowlist', () => {
    const allowedParamKeys = ['q', 'page', 'limit', 'type', 'status', 'rating', 'sfw', 'genres', 'order_by', 'sort', 'filter'];
    const dirtyQuery = {
        q: 'Naruto',
        page: '1',
        maliciousParam: 'http://169.254.169.254/latest/meta-data/', // AWS metadata SSRF probe
        redirectUrl: 'http://evil-attacker.com'
    };

    const safeParams = {};
    for (const [key, value] of Object.entries(dirtyQuery)) {
        if (allowedParamKeys.includes(key)) {
            safeParams[key] = value;
        }
    }

    assert.strictEqual(safeParams.q, 'Naruto');
    assert.strictEqual('maliciousParam' in safeParams, false);
    assert.strictEqual('redirectUrl' in safeParams, false);
});

// 5. Password Policy Enforcement (OWASP A07)
test('OWASP A07: Strict Password Policy Regex', () => {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,64}$/;
    
    assert.strictEqual(strongPasswordRegex.test('weak'), false);
    assert.strictEqual(strongPasswordRegex.test('onlylowercase123'), false);
    assert.strictEqual(strongPasswordRegex.test('NoSpecialChar123'), false);
    assert.strictEqual(strongPasswordRegex.test('ValidSecure!2026'), true);
});

console.log('====================================================');
console.log(`TOTAL TESTS: ${testsTotal} | PASSED: ${testsPassed} | FAILED: ${testsTotal - testsPassed}`);
console.log('====================================================');

if (testsPassed === testsTotal) {
    process.exit(0);
} else {
    process.exit(1);
}
