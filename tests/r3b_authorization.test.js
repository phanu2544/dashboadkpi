const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..");
const CODE_PATH = path.join(REPO_ROOT, "Code.js");
const CODE = fs.readFileSync(CODE_PATH, "utf8");

const LOGIN_ROWS = [
  ["ID", "name", "username", "password", "role", "startdatetime"],
  ["1", "User One", "user1", "user-password", "user", ""],
  ["2", "Admin One", "admin1", "admin-password", "admin", ""],
  ["3", "Super One", "super1", "super-password", "superadmin", ""]
];

const SCOPE_ROWS = [
  ["UserId", "Department", "WorkGroup", "SubDep", "Active"],
  ["1", "Dept A", "WG 1", "Sub 1", true],
  ["1", "Dept A", "WG 2", "", false],
  ["2", "Dept A", "", "", true],
  ["", "Dept A", "", "", true],
  ["1", "", "", "", true]
];

function cloneRows(rows) {
  return rows ? rows.map((row) => row.slice()) : null;
}

function createSheet(rows) {
  return {
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
}

function createHarness(options = {}) {
  const loginRows = cloneRows(options.loginRows || LOGIN_ROWS);
  const scopeRows = options.scopeRows === null
    ? null
    : cloneRows(options.scopeRows || SCOPE_ROWS);
  const loginSheet = createSheet(loginRows);
  const scopeSheet = scopeRows ? createSheet(scopeRows) : null;
  const store = {};
  let uuidCounter = 0;
  let clock = Date.parse("2026-06-21T00:00:00.000Z");

  class TestDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }

    static now() {
      return clock++;
    }
  }

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
            if (name === "login") return loginSheet;
            if (name === "UserScope") return scopeSheet;
            return null;
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
        return [
          ...crypto.createHash("sha256").update(String(value), "utf8").digest()
        ].map((byte) => (byte > 127 ? byte - 256 : byte));
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(
    `${CODE}
      globalThis.__r3bApi = {
        AUTH_PERMISSIONS,
        AUTH_TASK_ACTIONS,
        loginCheck,
        requirePermission_,
        getUserScopeRecords_,
        getActorScopes_,
        taskMatchesActorScope_,
        canReadTask_,
        canMutateTask_,
        filterTasksForActor_,
        requireTaskAccess_,
        requireExportPermission_
      };
    `,
    sandbox
  );

  return {
    api: sandbox.__r3bApi,
    loginRows,
    scopeRows,
    store
  };
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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function task(overrides = {}) {
  return {
    ID: "task-1",
    Department: "Dept A",
    WorkGroup: "WG 1",
    SubDep: "Sub 1",
    AssigneeUserId: "1",
    ...overrides
  };
}

const tests = [];

function test(name, callback) {
  tests.push({ name, callback });
}

test("R3 role grants remain least privilege", () => {
  const { api } = createHarness();
  const user = api.loginCheck("user1", "user-password");
  const admin = api.loginCheck("admin1", "admin-password");
  const superadmin = api.loginCheck("super1", "super-password");

  for (const permission of [
    api.AUTH_PERMISSIONS.TASK_READ,
    api.AUTH_PERMISSIONS.TASK_MUTATE
  ]) {
    assert.equal(
      api.requirePermission_(user.sessionToken, permission).actor.role,
      "user"
    );
  }
  assert.equal(
    captureError(() =>
      api.requireExportPermission_(user.sessionToken, "summary")
    ).code,
    "AUTH_FORBIDDEN"
  );

  assert.equal(
    api.requireExportPermission_(admin.sessionToken, "summary").actor.role,
    "admin"
  );
  assert.equal(
    captureError(() =>
      api.requireExportPermission_(admin.sessionToken, "raw")
    ).code,
    "AUTH_FORBIDDEN"
  );

  assert.equal(
    api.requireExportPermission_(superadmin.sessionToken, "raw").actor.role,
    "superadmin"
  );
  assert.equal(
    captureError(() =>
      api.requireExportPermission_(superadmin.sessionToken, "unknown")
    ).code,
    "AUTH_EXPORT_MODE_INVALID"
  );
});

test("admin summary export requires a valid organizational scope", () => {
  const { api } = createHarness({ scopeRows: null });
  const admin = api.loginCheck("admin1", "admin-password");
  const superadmin = api.loginCheck("super1", "super-password");

  assert.equal(
    captureError(() =>
      api.requireExportPermission_(admin.sessionToken, "summary")
    ).code,
    "AUTH_RESOURCE_FORBIDDEN"
  );
  assert.equal(
    api.requireExportPermission_(superadmin.sessionToken, "summary").actor.role,
    "superadmin"
  );
});

test("UserScope loads active valid rows only", () => {
  const { api } = createHarness();
  const records = plain(api.getUserScopeRecords_());

  assert.deepEqual(records, [
    {
      userId: "1",
      department: "dept a",
      workGroup: "wg 1",
      subDep: "sub 1"
    },
    {
      userId: "2",
      department: "dept a",
      workGroup: "",
      subDep: ""
    }
  ]);
});

test("missing and invalid scope schema fail closed", () => {
  const missingHarness = createHarness({ scopeRows: null });
  assert.deepEqual(plain(missingHarness.api.getUserScopeRecords_()), []);

  const invalidHarness = createHarness({
    scopeRows: [
      ["UserId", "Department", "Active"],
      ["1", "Dept A", true]
    ]
  });
  assert.equal(
    captureError(() => invalidHarness.api.getUserScopeRecords_()).code,
    "AUTH_SCOPE_SCHEMA_INVALID"
  );

  const duplicateHeaderHarness = createHarness({
    scopeRows: [
      [
        "UserId",
        "UserId",
        "Department",
        "WorkGroup",
        "SubDep",
        "Active"
      ],
      ["1", "1", "Dept A", "", "", true]
    ]
  });
  assert.equal(
    captureError(() =>
      duplicateHeaderHarness.api.getUserScopeRecords_()
    ).code,
    "AUTH_SCOPE_SCHEMA_INVALID"
  );
});

test("scope matching and filtering never include cross-scope tasks", () => {
  const { api } = createHarness();
  const actor = { id: "1", role: "user" };
  const scopes = plain(api.getActorScopes_(actor));
  const tasks = [
    task({ ID: "allowed" }),
    task({ ID: "wrong-workgroup", WorkGroup: "WG 2" }),
    task({ ID: "wrong-subdep", SubDep: "Sub 2" }),
    task({ ID: "wrong-department", Department: "Dept B" })
  ];

  assert.deepEqual(
    plain(api.filterTasksForActor_(actor, tasks, scopes)).map((row) => row.ID),
    ["allowed"]
  );
  assert.equal(api.canReadTask_(actor, tasks[1], scopes), false);
});

test("user mutation requires scope, immutable assignee ID and allowed action", () => {
  const { api } = createHarness();
  const actor = { id: "1", role: "user" };
  const scopes = plain(api.getActorScopes_(actor));
  const assignedTask = task();

  for (const action of [
    api.AUTH_TASK_ACTIONS.MONTHLY_INPUT,
    api.AUTH_TASK_ACTIONS.SUBMIT,
    api.AUTH_TASK_ACTIONS.CANCEL_SUBMISSION
  ]) {
    assert.equal(
      api.canMutateTask_(actor, assignedTask, action, scopes),
      true
    );
  }

  for (const action of [
    api.AUTH_TASK_ACTIONS.CREATE,
    api.AUTH_TASK_ACTIONS.UPDATE_METADATA,
    api.AUTH_TASK_ACTIONS.ASSIGN,
    api.AUTH_TASK_ACTIONS.DELETE,
    "unknown"
  ]) {
    assert.equal(
      api.canMutateTask_(actor, assignedTask, action, scopes),
      false
    );
  }

  assert.equal(
    api.canMutateTask_(
      actor,
      task({ AssigneeUserId: "" }),
      api.AUTH_TASK_ACTIONS.SUBMIT,
      scopes
    ),
    false
  );
  assert.equal(
    api.canMutateTask_(
      actor,
      task({ AssigneeUserId: "2" }),
      api.AUTH_TASK_ACTIONS.SUBMIT,
      scopes
    ),
    false
  );
  assert.equal(
    api.canMutateTask_(
      actor,
      task({ Department: "Dept B" }),
      api.AUTH_TASK_ACTIONS.SUBMIT,
      scopes
    ),
    false
  );
});

test("admin manages in-scope tasks but cannot delete in first rollout", () => {
  const { api } = createHarness();
  const actor = { id: "2", role: "admin" };
  const scopes = plain(api.getActorScopes_(actor));

  for (const action of [
    api.AUTH_TASK_ACTIONS.MONTHLY_INPUT,
    api.AUTH_TASK_ACTIONS.SUBMIT,
    api.AUTH_TASK_ACTIONS.CANCEL_SUBMISSION,
    api.AUTH_TASK_ACTIONS.CREATE,
    api.AUTH_TASK_ACTIONS.UPDATE_METADATA,
    api.AUTH_TASK_ACTIONS.ASSIGN
  ]) {
    assert.equal(api.canMutateTask_(actor, task(), action, scopes), true);
  }

  assert.equal(
    api.canMutateTask_(
      actor,
      task(),
      api.AUTH_TASK_ACTIONS.DELETE,
      scopes
    ),
    false
  );
  assert.equal(
    api.canMutateTask_(
      actor,
      task({ Department: "Dept B" }),
      api.AUTH_TASK_ACTIONS.UPDATE_METADATA,
      scopes
    ),
    false
  );
});

test("superadmin has global task access but unknown actions still fail", () => {
  const { api } = createHarness({ scopeRows: null });
  const actor = { id: "3", role: "superadmin" };

  assert.equal(api.canReadTask_(actor, task({ Department: "Dept Z" }), []), true);
  assert.equal(
    api.canMutateTask_(
      actor,
      task({ AssigneeUserId: "" }),
      api.AUTH_TASK_ACTIONS.DELETE,
      []
    ),
    true
  );
  assert.equal(api.canMutateTask_(actor, task(), "unknown", []), false);
  assert.equal(api.canReadTask_(actor, {}, []), false);
  assert.equal(
    api.canMutateTask_(
      actor,
      {},
      api.AUTH_TASK_ACTIONS.DELETE,
      []
    ),
    false
  );
  assert.equal(
    api.canMutateTask_(
      actor,
      task({ ID: "" }),
      api.AUTH_TASK_ACTIONS.CREATE,
      []
    ),
    true
  );
});

test("requireTaskAccess derives actor from session and enforces resource scope", () => {
  const { api } = createHarness();
  const user = api.loginCheck("user1", "user-password");

  const allowed = api.requireTaskAccess_(
    user.sessionToken,
    task(),
    api.AUTH_TASK_ACTIONS.SUBMIT
  );
  assert.equal(allowed.actor.id, "1");
  assert.equal(allowed.action, api.AUTH_TASK_ACTIONS.SUBMIT);

  assert.equal(
    captureError(() =>
      api.requireTaskAccess_(
        user.sessionToken,
        task({ Department: "Dept B" }),
        api.AUTH_TASK_ACTIONS.SUBMIT
      )
    ).code,
    "AUTH_RESOURCE_FORBIDDEN"
  );
  assert.equal(
    captureError(() =>
      api.requireTaskAccess_(
        "forged-token",
        task(),
        api.AUTH_TASK_ACTIONS.SUBMIT
      )
    ).code,
    "AUTH_SESSION_INVALID"
  );
});

test("R3B remains private and R1 protected endpoints stay contained", () => {
  const helperNames = [
    "getUserScopeRecords_",
    "getActorScopes_",
    "taskMatchesActorScope_",
    "canReadTask_",
    "canMutateTask_",
    "filterTasksForActor_",
    "requireTaskAccess_",
    "requireExportPermission_"
  ];

  for (const name of helperNames) {
    assert.match(CODE, new RegExp(`function\\s+${name}\\s*\\(`));
  }

  for (const [name, guard] of [
    ["deleteTask", "securityMaintenanceJsonResponse_"],
    ["addTask", "securityMaintenanceJsonResponse_"],
    ["updateTaskDetails", "securityMaintenanceJsonResponse_"],
    ["cancelTaskMonthlySubmission", "securityMaintenanceJsonResponse_"],
    ["exportTasksToCSV", "securityMaintenanceResponse_"],
    ["createCSVDownloadUrl", "throwSecurityMaintenance_"],
    ["exportMonthlyClosedReportCsv", "securityMaintenanceResponse_"],
    ["exportMonthlyClosedRawDataCsv", "securityMaintenanceResponse_"]
  ]) {
    const pattern = new RegExp(
      `function\\s+${name}\\s*\\([^)]*\\)\\s*\\{\\s*return\\s+${guard}\\(\\)`
    );
    assert.match(CODE, pattern, `${name} must retain its R1 guard`);
  }
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

console.log(`\nR3B authorization tests: ${tests.length - failures}/${tests.length} passed`);

if (failures > 0) {
  process.exit(1);
}
