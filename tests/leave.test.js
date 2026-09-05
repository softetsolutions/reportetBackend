import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Leave from "../models/Leave.js";
import {
  applyLeave,
  getMyLeaves,
} from "../controllers/leaveController.js";
import { mockReq, mockRes, queryChain, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("applyLeave", () => {
  it("requires leaveType, dates, and reason", async () => {
    const res = mockRes();
    await applyLeave(
      mockReq({
        employee: { _id: oid(), organizationId: oid() },
        body: { leaveType: "casual" },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });

  it("rejects startDate after endDate", async () => {
    const res = mockRes();
    await applyLeave(
      mockReq({
        employee: { _id: oid(), organizationId: oid() },
        body: {
          leaveType: "casual",
          startDate: "2026-05-10",
          endDate: "2026-05-01",
          reason: "x",
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });

  it("creates a leave for the authenticated employee org", async () => {
    const employeeId = oid();
    const orgId = oid();
    let created;
    restores.push(
      stub(Leave, "create", async (doc) => {
        created = doc;
        return doc;
      }),
    );
    const res = mockRes();
    await applyLeave(
      mockReq({
        employee: { _id: employeeId, organizationId: orgId },
        body: {
          leaveType: "casual",
          startDate: "2026-05-01",
          endDate: "2026-05-02",
          reason: "fever",
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(created.employeeId, employeeId);
    assert.equal(created.organizationId, orgId);
  });
});

describe("getMyLeaves", () => {
  it("filters by employee and organization", async () => {
    const employeeId = oid();
    const orgId = oid();
    let filter;
    restores.push(
      stub(Leave, "find", (f) => {
        filter = f;
        return queryChain([]);
      }),
    );
    const res = mockRes();
    await getMyLeaves(
      mockReq({ employee: { _id: employeeId, organizationId: orgId } }),
      res,
    );
    assert.equal(String(filter.employeeId), String(employeeId));
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.statusCode, 200);
  });
});
