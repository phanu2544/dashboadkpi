const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(REPO_ROOT, "index.html");
const HTML = fs.readFileSync(INDEX_PATH, "utf8");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function section(startMarker, endMarker) {
  const start = HTML.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = HTML.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return HTML.slice(start, end);
}

test("all inline scripts have valid JavaScript syntax", () => {
  const inlineScripts = [
    ...HTML.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)
  ].map((match) => match[1]);

  assert.ok(inlineScripts.length > 0, "expected at least one inline script");

  inlineScripts.forEach((script, index) => {
    const sanitized = script.replace(/<\?[\s\S]*?\?>/g, "");
    assert.doesNotThrow(
      () => new Function(sanitized),
      `inline script ${index + 1} must parse`
    );
  });
});

test("session token is retained in memory only", () => {
  assert.match(HTML, /window\.currentSession\s*=\s*null/);
  assert.doesNotMatch(HTML, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
  assert.doesNotMatch(
    HTML,
    /console\.(?:log|info|debug|warn|error)\([^)]*(?:currentSession|sessionToken)/s
  );
});

test("login fails closed when a secure server session is missing", () => {
  const loginFlow = section("function login()", "function openRegister()");
  assert.match(loginFlow, /establishClientSession_\(res\)/);
  assert.match(loginFlow, /if\s*\(!establishClientSession_/);
  assert.match(loginFlow, /ไม่สามารถเริ่มเซสชันที่ปลอดภัยได้/);
});

test("authenticated identity is derived from the server response", () => {
  const normalizationFlow = section(
    "function normalizeServerSessionUser_",
    "function establishClientSession_"
  );
  const establishFlow = section(
    "function establishClientSession_",
    "function clearClientSessionState_"
  );

  assert.match(normalizationFlow, /rawUser\?\.id/);
  assert.match(normalizationFlow, /rawUser\?\.username/);
  assert.match(normalizationFlow, /rawUser\?\.role/);
  assert.match(normalizationFlow, /if\s*\(!id\s*\|\|\s*!username\s*\|\|\s*!role\)/);
  assert.match(
    establishFlow,
    /normalizeServerSessionUser_\(response\?\.user\)/
  );
  assert.match(establishFlow, /if\s*\(!token\s*\|\|\s*!serverUser/);
  assert.match(establishFlow, /window\.currentUser\s*=\s*serverUser/);
  assert.doesNotMatch(establishFlow, /fallbackUsername|response\?\.username/);
});

test("client validates session context and ignores stale responses", () => {
  const refreshFlow = section(
    "function refreshClientSessionContext_",
    "['pointerdown', 'keydown']"
  );

  assert.match(refreshFlow, /\.getSessionContext\(sessionToken\)/);
  assert.match(
    refreshFlow,
    /getCurrentSessionToken_\(\)\s*!==\s*sessionToken/
  );
  assert.match(refreshFlow, /if\s*\(!response\?\.success\s*\|\|\s*!serverUser\)/);
  assert.match(HTML, /window\.addEventListener\('focus',\s*refreshClientSessionContext_\)/);
});

test("client enforces absolute and idle session expiry", () => {
  assert.match(
    HTML,
    /CLIENT_SESSION_IDLE_TIMEOUT_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/
  );
  assert.match(HTML, /expiresAt\s*<=\s*now/);
  assert.match(
    HTML,
    /lastActivityAt\s*\+\s*CLIENT_SESSION_IDLE_TIMEOUT_MS\s*<=\s*now/
  );
  assert.match(HTML, /handleClientSessionExpired_/);
});

test("active clients periodically touch the server session", () => {
  const activityFlow = section(
    "function recordClientSessionActivity_",
    "function normalizeServerSessionUser_"
  );
  const refreshFlow = section(
    "function refreshClientSessionContext_",
    "['pointerdown', 'keydown']"
  );

  assert.match(
    HTML,
    /CLIENT_SESSION_REVALIDATE_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/
  );
  assert.match(activityFlow, /refreshClientSessionContext_\(\)/);
  assert.match(refreshFlow, /clientSessionRefreshInFlight_/);
  assert.match(refreshFlow, /lastValidationAttemptAt/);
  assert.match(refreshFlow, /lastValidatedAt\s*=\s*Date\.now\(\)/);
});

test("logout revokes the server session and always clears local state", () => {
  const logoutFlow = section("function logout()", "// ✅ บันทึกกลับ Google Sheet");
  assert.match(logoutFlow, /\.logoutSession\(sessionToken\)/);
  assert.match(logoutFlow, /resetAuthenticatedUi_\(\)/);
  assert.match(logoutFlow, /\.withSuccessHandler\(finishLogout\)/);
  assert.match(logoutFlow, /\.withFailureHandler\(\(\)\s*=>/);
});

test("session token is not yet sent to protected business RPCs", () => {
  const tokenRpcCalls = [
    ...HTML.matchAll(/\.\s*([A-Za-z0-9_]+)\(sessionToken\)/g)
  ].map((match) => match[1]);

  assert.deepEqual(
    [...new Set(tokenRpcCalls)].sort(),
    ["getSessionContext", "logoutSession"]
  );
});

let failures = 0;

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} tests passed`);

if (failures > 0) {
  process.exitCode = 1;
}
