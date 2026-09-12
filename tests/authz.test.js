import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { authorizeRole } from "../middleware/authMiddleware.js";
import { generateToken } from "../controllers/authController.js";
import { generateOrgToken } from "../controllers/orgAuthController.js";

process.env.JWT_SECRET ??= "test-secret-for-authz";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("authorizeRole", () => {
  it("rejects requests with no employee", () => {
    const req = {};
    const res = mockRes();
    let nextCalled = false;
    authorizeRole("areaManager")(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  it("rejects an MR on area-manager routes", () => {
    const req = { employee: { role: "mr" } };
    const res = mockRes();
    let nextCalled = false;
    authorizeRole("areaManager", "zonalManager")(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  it("allows an areaManager", () => {
    const req = { employee: { role: "areaManager" } };
    const res = mockRes();
    let nextCalled = false;
    authorizeRole("areaManager", "zonalManager")(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it("allows a zonalManager", () => {
    const req = { employee: { role: "zonalManager" } };
    const res = mockRes();
    let nextCalled = false;
    authorizeRole("areaManager", "zonalManager")(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });
});

describe("JWT claims", () => {
  it("employee tokens include typ and role and do not expire", () => {
    const token = generateToken("emp-id", "mr", []);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(decoded.typ, "employee");
    assert.equal(decoded.id, "emp-id");
    assert.equal(decoded.role, "mr");
    assert.equal(decoded.exp, undefined);
  });

  it("org tokens include typ org and an expiry", () => {
    const token = generateOrgToken("org-id");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.equal(decoded.typ, "org");
    assert.equal(decoded.id, "org-id");
    assert.ok(decoded.exp);
  });

  it("an employee token is not an org token", () => {
    const token = generateToken("emp-id", "mr", []);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert.notEqual(decoded.typ, "org");
  });
});
