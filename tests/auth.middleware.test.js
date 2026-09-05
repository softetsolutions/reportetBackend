import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";
import Organization from "../models/Organization.js";
import { auth, orgAuth, authOrOrg } from "../middleware/authMiddleware.js";
import { login, logout } from "../controllers/authController.js";
import { mockReq, mockRes, queryChain, stub } from "./helpers.js";

process.env.JWT_SECRET ??= "test-secret-for-authz";

const restores = [];
function track(restore) {
  restores.push(restore);
}

afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("auth middleware", () => {
  it("rejects a missing token", async () => {
    const res = mockRes();
    await auth(mockReq({ cookies: {}, headers: {} }), res, () => {});
    assert.equal(res.statusCode, 401);
  });

  it("rejects an org token on employee auth", async () => {
    const token = jwt.sign({ id: "o1", typ: "org" }, process.env.JWT_SECRET);
    const res = mockRes();
    await auth(
      mockReq({ cookies: { token }, headers: {} }),
      res,
      () => {},
    );
    assert.equal(res.statusCode, 401);
  });

  it("rejects a deactivated employee", async () => {
    const token = jwt.sign(
      { id: "e1", typ: "employee" },
      process.env.JWT_SECRET,
    );
    track(
      stub(Employee, "findById", async () => ({
        _id: "e1",
        isActive: false,
        role: "mr",
      })),
    );
    const res = mockRes();
    await auth(
      mockReq({
        cookies: { token },
        headers: { authorization: `Bearer ${token}` },
      }),
      res,
      () => {},
    );
    assert.equal(res.statusCode, 403);
  });

  it("attaches an active employee and calls next", async () => {
    const token = jwt.sign(
      { id: "e1", typ: "employee" },
      process.env.JWT_SECRET,
    );
    const employee = { _id: "e1", isActive: true, role: "mr" };
    track(stub(Employee, "findById", async () => employee));
    const req = mockReq({
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    });
    const res = mockRes();
    let nextCalled = false;
    await auth(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.employee, employee);
  });
});

describe("orgAuth middleware", () => {
  it("rejects an employee token", async () => {
    const token = jwt.sign(
      { id: "e1", typ: "employee" },
      process.env.JWT_SECRET,
    );
    const res = mockRes();
    await orgAuth(
      mockReq({ cookies: { orgToken: token }, headers: {} }),
      res,
      () => {},
    );
    assert.equal(res.statusCode, 401);
  });

  it("loads the org without password", async () => {
    const token = jwt.sign({ id: "o1", typ: "org" }, process.env.JWT_SECRET);
    const org = { _id: "o1", organizationName: "Acme" };
    let selected;
    track(
      stub(Organization, "findById", () => ({
        select(fields) {
          selected = fields;
          return Promise.resolve(org);
        },
      })),
    );
    const req = mockReq({ cookies: { orgToken: token }, headers: {} });
    const res = mockRes();
    let nextCalled = false;
    await orgAuth(req, res, () => {
      nextCalled = true;
    });
    assert.equal(selected, "-password");
    assert.equal(nextCalled, true);
    assert.equal(req.organization, org);
  });
});

describe("authOrOrg middleware", () => {
  it("uses typ to load an employee without probing org", async () => {
    const token = jwt.sign(
      { id: "e1", typ: "employee" },
      process.env.JWT_SECRET,
    );
    track(
      stub(Employee, "findById", async () => ({
        _id: "e1",
        isActive: true,
        role: "mr",
      })),
    );
    let orgLookedUp = false;
    track(
      stub(Organization, "findById", () => {
        orgLookedUp = true;
        return { select: async () => null };
      }),
    );
    const req = mockReq({
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    });
    const res = mockRes();
    let nextCalled = false;
    await authOrOrg(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(orgLookedUp, false);
    assert.equal(req.employee._id, "e1");
  });
});

describe("employee login", () => {
  it("returns 401 when the user does not exist", async () => {
    track(stub(Employee, "findOne", () => queryChain(null)));
    const res = mockRes();
    await login(mockReq({ body: { userName: "x", password: "y" } }), res);
    assert.equal(res.statusCode, 401);
  });

  it("returns 403 when the account is deactivated", async () => {
    track(
      stub(Employee, "findOne", () =>
        queryChain({
          _id: "e1",
          isActive: false,
          password: "hash",
          role: "mr",
          assignedHeadQuarters: [],
        }),
      ),
    );
    const res = mockRes();
    await login(mockReq({ body: { userName: "x", password: "y" } }), res);
    assert.equal(res.statusCode, 403);
  });

  it("logout succeeds", () => {
    const res = mockRes();
    logout(mockReq(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Logout successful");
  });
});
