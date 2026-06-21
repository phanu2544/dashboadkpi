const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");
const CODE_PATH = path.join(REPO_ROOT, "Code.js");
const CODE = fs.readFileSync(CODE_PATH, "utf8");

const DEFAULT_ROWS = [
  ["ID", "name", "username", "password", "role", "startdatetime"],
  ["1", "User One", "user1", "user-password", "user", ""],
  ["2", "Admin One", "admin1", "admin-password", "admin", ""],
  ["3", "Super One", "super1", "super-password", "superadmin", ""]
];

function cloneRows(rows) {
  return rows.map((row) => row.slice());
}

function createHarness(initialRows = DEFAULT_ROWS) {
  const store = {};
  const rows = cloneRows(initialRows);
  let digestCalls = 0;
  let uuidCounter = 0;
  let clock = Date.parse("2026-06-19T00:00:00.000Z");

  class TestDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }

    static now() {
      return clock++;
    }
  }

  const loginSheet = {
    getDataRange() {
      return {
        getValues() {
          return cloneRows(rows);
        }
      };
    },
    getRange(row, column) {
      return {
        setValue(value) {
          rows[row - 1][column - 1] = value;
          return this;
        }
      };
    }
  };

  const sandbox = {
    console,
    Date: TestDate,
    JSON,
    String,
    Number,
    Object,
    Array,
    Error,
    Math,
    rows,
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return Object.prototype.hasOwnProperty.call(store, key)
              ? store[key]
              : null;
          },
          setProperty(key, value) {
            store[key] = String(value);
            return this;
          },
          deleteProperty(key) {
            delete store[key];
            return this;
          },
          getProperties() {
            return { ...store };
          }
        };
      }
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {},
          releaseLock() {}
        };
      }
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName(name) {
            return name === "login" ? loginSheet : null;
          }
        };
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      getUuid() {
        uuidCounter++;
        return `00000000-0000-4000-8000-${String(uuidCounter).padStart(
          12,
          "0"
        )}`;
      },
      computeDigest(_algorithm, value) {
        digestCalls++;
        return [
          ...crypto.createHash("sha256").update(String(value), "utf8").digest()
        ].map((byte) => (byte > 127 ? byte - 256 : byte));
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(
    `${CODE}
      globalThis.__r2dApi = {
        AUTH_SESSION_PROPERTY_PREFIX,
        AUTH_SESSION_IDLE_TIMEOUT_MS,
        AUTH_SESSION_MAX_PER_USER,
        AUTH_LOGIN_THROTTLE_PROPERTY_PREFIX,
        AUTH_LOGIN_THROTTLE_VERSION,
        AUTH_LOGIN_THROTTLE_MAX_RECORDS,
        AUTH_LOGIN_MAX_FAILURES,
        AUTH_LOGIN_LOCKOUT_MS,
        AUTH_LOGIN_UNKNOWN_SUBJECT,
        AUTH_PERMISSIONS,
        loginCheck,
        getSessionContext,
        logoutSession,
        validateSession_,
        requirePermission_,
        getLoginThrottlePropertyKey_,
        hashSessionToken_
      };
    `,
    sandbox
  );

  return {
    api: sandbox.__r2dApi,
    rows,
    store,
    getDigestCalls() {
      return digestCalls;
    }
  };
}

function getPropertiesByPrefix(store, prefix) {
  return Object.entries(store).filter(([key]) => key.startsWith(prefix));
}

function captureError(callback) {
  try {
    return { ok: true, value: callback() };
  } catch (error) {
    return {
      ok: false,
      code: error.name,
      message: error.message
    };
  }
}

function extractFunctionBody(source, functionName) {
  const pattern = new RegExp(`function\\s+${functionName}\\s*\\(`);
  const match = pattern.exec(source);
  assert.ok(match, `Missing function ${functionName}`);

  const bodyStart = source.indexOf("{", match.index);
  assert.notEqual(bodyStart, -1, `Missing body for ${functionName}`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    const character = source[index];
    if (character === "{") depth++;
    if (character === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(bodyStart + 1, index);
      }
    }
  }

  throw new Error(`Unclosed function body for ${functionName}`);
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test("session lifecycle stores only token hash and supports logout", () => {
  const harness = createHarness();
  const { api, rows, store } = harness;

  const login = api.loginCheck("user1", "user-password");
  assert.equal(login.success, true);
  assert.equal(login.sessionToken.length, 64);
  assert.equal(login.username, "user1");
  assert.equal(Object.hasOwn(login, "password"), false);
  assert.equal(Object.hasOwn(login.user, "password"), false);
  assert.ok(rows[1][5] instanceof Date);

  const sessionEntries = getPropertiesByPrefix(
    store,
    api.AUTH_SESSION_PROPERTY_PREFIX
  );
  assert.equal(sessionEntries.length, 1);
  assert.equal(
    sessionEntries.some(
      ([key, value]) =>
        key.includes(login.sessionToken) || value.includes(login.sessionToken)
    ),
    false
  );

  assert.equal(api.getSessionContext(login.sessionToken).success, true);
  assert.equal(api.logoutSession(login.sessionToken).success, true);
  assert.equal(api.logoutSession(login.sessionToken).success, true);
  assert.equal(api.getSessionContext(login.sessionToken).success, false);
});

test("forged, expired and revoked tokens are rejected", () => {
  const harness = createHarness();
  const { api, store } = harness;
  const login = api.loginCheck("user1", "user-password");

  assert.equal(api.getSessionContext("forged-token").success, false);

  const tokenHash = api.hashSessionToken_(login.sessionToken);
  const propertyKey = api.AUTH_SESSION_PROPERTY_PREFIX + tokenHash;
  const record = JSON.parse(store[propertyKey]);
  record.lastSeenAt = 0;
  record.expiresAt = 0;
  store[propertyKey] = JSON.stringify(record);

  const expired = api.getSessionContext(login.sessionToken);
  assert.equal(expired.success, false);
  assert.equal(store[propertyKey], undefined);

  const secondLogin = api.loginCheck("user1", "user-password");
  api.logoutSession(secondLogin.sessionToken);
  assert.equal(
    api.getSessionContext(secondLogin.sessionToken).success,
    false
  );
});

test("session limit revokes the oldest session", () => {
  const harness = createHarness();
  const { api, store } = harness;
  const sessions = [];

  for (let index = 0; index < api.AUTH_SESSION_MAX_PER_USER + 1; index++) {
    sessions.push(api.loginCheck("user1", "user-password"));
  }

  assert.equal(
    getPropertiesByPrefix(
      store,
      api.AUTH_SESSION_PROPERTY_PREFIX
    ).length,
    api.AUTH_SESSION_MAX_PER_USER
  );
  assert.equal(
    api.getSessionContext(sessions[0].sessionToken).success,
    false
  );
  assert.equal(
    api.getSessionContext(
      sessions[sessions.length - 1].sessionToken
    ).success,
    true
  );
});

test("role changes are read from the server on every validation", () => {
  const harness = createHarness();
  const { api, rows } = harness;
  const login = api.loginCheck("user1", "user-password");

  const denied = captureError(() =>
    api.requirePermission_(
      login.sessionToken,
      api.AUTH_PERMISSIONS.ADMIN_CONSOLE_VIEW
    )
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "AUTH_FORBIDDEN");

  rows[1][4] = "admin";
  const allowed = api.requirePermission_(
    login.sessionToken,
    api.AUTH_PERMISSIONS.ADMIN_CONSOLE_VIEW
  );
  assert.equal(allowed.actor.id, "1");
  assert.equal(allowed.actor.role, "admin");
});

test("permission matrix is default deny and least privilege", () => {
  const harness = createHarness();
  const { api } = harness;
  const user = api.loginCheck("user1", "user-password");
  const admin = api.loginCheck("admin1", "admin-password");
  const superadmin = api.loginCheck("super1", "super-password");

  assert.equal(
    api.requirePermission_(
      user.sessionToken,
      api.AUTH_PERMISSIONS.SESSION_SELF
    ).actor.role,
    "user"
  );

  assert.equal(
    captureError(() =>
      api.requirePermission_(
        user.sessionToken,
        api.AUTH_PERMISSIONS.ADMIN_CONSOLE_VIEW
      )
    ).code,
    "AUTH_FORBIDDEN"
  );
  assert.equal(
    api.requirePermission_(
      user.sessionToken,
      api.AUTH_PERMISSIONS.TASK_READ
    ).actor.role,
    "user"
  );
  assert.equal(
    api.requirePermission_(
      user.sessionToken,
      api.AUTH_PERMISSIONS.TASK_MUTATE
    ).actor.role,
    "user"
  );
  assert.equal(
    captureError(() =>
      api.requirePermission_(
        user.sessionToken,
        api.AUTH_PERMISSIONS.EXPORT_SUMMARY
      )
    ).code,
    "AUTH_FORBIDDEN"
  );

  assert.equal(
    api.requirePermission_(
      admin.sessionToken,
      api.AUTH_PERMISSIONS.MONTHLY_CLOSE_DRY_RUN
    ).actor.role,
    "admin"
  );

  for (const permission of [
    api.AUTH_PERMISSIONS.SYSTEM_CONFIG_VIEW,
    api.AUTH_PERMISSIONS.SNAPSHOT_VIEW,
    api.AUTH_PERMISSIONS.MONTHLY_CLOSE_EXECUTE,
    api.AUTH_PERMISSIONS.EXPORT_RAW
  ]) {
    assert.equal(
      captureError(() =>
        api.requirePermission_(admin.sessionToken, permission)
      ).code,
      "AUTH_FORBIDDEN"
    );
  }
  for (const permission of [
    api.AUTH_PERMISSIONS.TASK_READ,
    api.AUTH_PERMISSIONS.TASK_MUTATE,
    api.AUTH_PERMISSIONS.EXPORT_SUMMARY
  ]) {
    assert.equal(
      api.requirePermission_(admin.sessionToken, permission).actor.role,
      "admin"
    );
  }

  assert.equal(
    api.requirePermission_(
      superadmin.sessionToken,
      api.AUTH_PERMISSIONS.SYSTEM_CONFIG_MANAGE
    ).actor.role,
    "superadmin"
  );
  assert.equal(
    api.requirePermission_(
      superadmin.sessionToken,
      api.AUTH_PERMISSIONS.MONTHLY_CLOSE_EXECUTE
    ).actor.role,
    "superadmin"
  );

  for (const permission of [
    api.AUTH_PERMISSIONS.TASK_READ,
    api.AUTH_PERMISSIONS.TASK_MUTATE,
    api.AUTH_PERMISSIONS.EXPORT_SUMMARY,
    api.AUTH_PERMISSIONS.EXPORT_RAW
  ]) {
    assert.equal(
      api.requirePermission_(superadmin.sessionToken, permission).actor.role,
      "superadmin"
    );
  }

  assert.equal(
    captureError(() =>
      api.requirePermission_(superadmin.sessionToken, "unknown:permission")
    ).code,
    "AUTH_PERMISSION_UNKNOWN"
  );
});

test("duplicate username and immutable ID fail closed", () => {
  const duplicateUsernameRows = cloneRows(DEFAULT_ROWS);
  duplicateUsernameRows.push([
    "4",
    "Duplicate User",
    "USER1",
    "user-password",
    "admin",
    ""
  ]);
  const duplicateUsernameHarness = createHarness(duplicateUsernameRows);
  assert.equal(
    duplicateUsernameHarness.api.loginCheck(
      "user1",
      "user-password"
    ).success,
    false
  );

  const duplicateIdRows = cloneRows(DEFAULT_ROWS);
  duplicateIdRows.push([
    "1",
    "Duplicate ID",
    "other-user",
    "other-password",
    "user",
    ""
  ]);
  const duplicateIdHarness = createHarness(duplicateIdRows);
  const result = duplicateIdHarness.api.loginCheck(
    "user1",
    "user-password"
  );
  assert.equal(result.success, false);
  assert.equal(result.code, "AUTH_LOGIN_UNAVAILABLE");
});

test("login failures are generic and successful login resets throttle", () => {
  const harness = createHarness();
  const { api, store } = harness;

  const knownFailure = api.loginCheck("user1", "wrong-password");
  const unknownFailure = api.loginCheck("not-a-user", "wrong-password");
  assert.equal(knownFailure.code, "AUTH_LOGIN_FAILED");
  assert.equal(knownFailure.message, unknownFailure.message);

  const userThrottleKey = api.getLoginThrottlePropertyKey_("user-id:1");
  assert.notEqual(store[userThrottleKey], undefined);

  assert.equal(
    api.loginCheck("user1", "user-password").success,
    true
  );
  assert.equal(store[userThrottleKey], undefined);
});

test("five failures lock a known account for the configured window", () => {
  const harness = createHarness();
  const { api } = harness;
  const failures = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    failures.push(api.loginCheck("admin1", "wrong-password"));
  }

  assert.equal(failures[0].code, "AUTH_LOGIN_FAILED");
  assert.equal(failures[4].code, "AUTH_LOGIN_THROTTLED");
  assert.equal(
    api.loginCheck("admin1", "admin-password").code,
    "AUTH_LOGIN_THROTTLED"
  );
});

test("random unknown usernames share one bounded throttle bucket", () => {
  const harness = createHarness();
  const { api, store } = harness;

  for (let index = 0; index < 100; index++) {
    api.loginCheck(`random-${index}`, "wrong-password");
  }

  const entries = getPropertiesByPrefix(
    store,
    api.AUTH_LOGIN_THROTTLE_PROPERTY_PREFIX
  );
  assert.equal(entries.length, 1);

  const unknownKey = api.getLoginThrottlePropertyKey_(
    api.AUTH_LOGIN_UNKNOWN_SUBJECT
  );
  assert.notEqual(store[unknownKey], undefined);
});

test("throttle record count is capped even on a locked request", () => {
  const harness = createHarness();
  const { api, store } = harness;
  const now = Date.now();

  for (let index = 0; index < 300; index++) {
    store[
      api.AUTH_LOGIN_THROTTLE_PROPERTY_PREFIX + `seed-${index}`
    ] = JSON.stringify({
      version: api.AUTH_LOGIN_THROTTLE_VERSION,
      failureCount: 1,
      windowStartedAt: now + index,
      lockedUntil: 0
    });
  }

  const unknownKey = api.getLoginThrottlePropertyKey_(
    api.AUTH_LOGIN_UNKNOWN_SUBJECT
  );
  store[unknownKey] = JSON.stringify({
    version: api.AUTH_LOGIN_THROTTLE_VERSION,
    failureCount: api.AUTH_LOGIN_MAX_FAILURES,
    windowStartedAt: now,
    lockedUntil: now + api.AUTH_LOGIN_LOCKOUT_MS
  });

  assert.equal(
    api.loginCheck("another-unknown", "wrong-password").code,
    "AUTH_LOGIN_THROTTLED"
  );
  assert.ok(
    getPropertiesByPrefix(
      store,
      api.AUTH_LOGIN_THROTTLE_PROPERTY_PREFIX
    ).length <= api.AUTH_LOGIN_THROTTLE_MAX_RECORDS
  );
});

test("known and unknown usernames execute the same digest count", () => {
  const harness = createHarness();
  const { api } = harness;

  const knownStart = harness.getDigestCalls();
  api.loginCheck("user1", "wrong-password");
  const knownCount = harness.getDigestCalls() - knownStart;

  const unknownStart = harness.getDigestCalls();
  api.loginCheck("unknown-user", "wrong-password");
  const unknownCount = harness.getDigestCalls() - unknownStart;

  assert.equal(knownCount, unknownCount);
});

test("R1 containment remains present on critical endpoints", () => {
  const protectedFunctions = [
    "addTask",
    "deleteTask",
    "updateTaskStatus",
    "updateTaskProgress",
    "updateTaskProgressOutcome",
    "updateTaskDetails",
    "updateTaskProgressAndStatus",
    "cancelTaskMonthlySubmission",
    "getAllUsers",
    "updateUserRole",
    "deleteUser",
    "getMonthlyCloseManagementConsoleData",
    "runDryRunSnapshotForMonthlyCloseConsole",
    "getDataQualityBeforeClosePeriodForUI",
    "closeMonthlyPeriod",
    "runClosePeriodFromMonthlyCloseConsole",
    "resetMonthlyTaskProgress",
    "resetPeriodControlToCurrentMonth",
    "openPreviousMonthInputPeriod",
    "getBulkReportingScheduleSetupData",
    "updateBulkReportingSchedules",
    "saveSnapshotConfig",
    "snapshotNow",
    "getSystemConfig",
    "getSnapshotConfig",
    "getClosePeriodDataQualityPreview",
    "previewSnapshotQualityBeforeClosePeriod",
    "exportTasksToCSV",
    "createHTMLDownloadUrl",
    "createCSVDownloadUrl",
    "exportMonthlyClosedReportCsv",
    "exportMonthlyClosedRawDataCsv"
  ];

  for (const functionName of protectedFunctions) {
    const body = extractFunctionBody(CODE, functionName);
    assert.match(
      body.slice(0, 500),
      /(securityMaintenance(Response_|JsonResponse_|TextResponse_)|throwSecurityMaintenance_)/,
      `${functionName} lost its R1 maintenance guard`
    );
  }

  const registerBody = extractFunctionBody(CODE, "registerUser");
  assert.match(registerBody.slice(0, 500), /isSelfRegistrationEnabled_/);
  assert.match(registerBody.slice(0, 500), /securityMaintenanceResponse_/);
});

test("R1 static safety invariants remain intact", () => {
  assert.doesNotMatch(CODE, /ANYONE_WITH_LINK/);
  assert.equal(
    (CODE.match(/return securityMaintenance/g) || []).length,
    31
  );

  for (const publicName of [
    "sendMessage",
    "sendLongMessage",
    "notifyGroup",
    "createSnapshotFileInDrive",
    "testNotify"
  ]) {
    assert.doesNotMatch(
      CODE,
      new RegExp(`function\\s+${publicName}\\s*\\(`),
      `${publicName} became public`
    );
  }

  const doGetBody = extractFunctionBody(CODE, "doGet");
  assert.doesNotMatch(
    doGetBody,
    /(setup|repair|migrat|appendRow|insertColumn|setValue)\s*\(/i
  );
});

test("no public test RPC is introduced", () => {
  const publicTestFunctions = [
    ...CODE.matchAll(/function\s+(test[A-Za-z0-9]*|runSecurity[A-Za-z0-9]*)\s*\(/g)
  ].map((match) => match[1]);

  assert.deepEqual(publicTestFunctions, []);
});

let failures = 0;

for (const { name, callback } of tests) {
  try {
    callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message);
  }
}

console.log(`\nR2D security tests: ${tests.length - failures}/${tests.length} passed`);

if (failures > 0) {
  process.exit(1);
}
