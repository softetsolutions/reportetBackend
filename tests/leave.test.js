import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Leave from "../models/Leave.js";
import Employee from "../models/Employee.js";
import LeaveType from "../models/LeaveType.js";
import EmployeeLeaveBalance from "../models/EmployeeLeaveBalance.js";
import {
  applyLeave,
  getMyLeaves,
  getSubordinateLeaves,
  actionOnLeave,
} from "../controllers/leaveController.js";
import { mockReq, mockRes, queryChain, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("applyLeave", () => {
  it("requires leaveType, date, and reason", async () => {
    const res = mockRes();
    await applyLeave(
      mockReq({
        employee: { _id: oid(), organizationId: oid() },
        body: { leaveType: oid() },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });

  it("rejects invalid leave date", async () => {
    const res = mockRes();
    await applyLeave(
      mockReq({
        employee: { _id: oid(), organizationId: oid() },
        body: {
          leaveType: oid(),
          date: "not-a-date",
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
    const leaveType = oid();
    let created;

    restores.push(
      stub(LeaveType, "findOne", async () => ({
        _id: leaveType,
        annualQuota: 12,
        active: true,
      })),
    );
    restores.push(
      stub(EmployeeLeaveBalance, "findOne", () => {
        const doc = { leaveType, balance: 5 };
        return {
          lean: async () => doc,
          then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
        };
      }),
    );
    restores.push(stub(Leave, "countDocuments", async () => 0));
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
          leaveType: String(leaveType),
          date: "2026-05-01",
          reason: "fever",
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(created.employeeId, employeeId);
    assert.equal(created.organizationId, orgId);
    assert.equal(String(created.leaveType), String(leaveType));
    assert.equal(created.leaveDate, "2026-05-01");
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
    assert.equal(String(filter.employeeId.$in[0]), String(employeeId));
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.statusCode, 200);
  });
});

describe("getSubordinateLeaves", () => {
  it("returns empty lists for MR", async () => {
    const res = mockRes();
    await getSubordinateLeaves(
      mockReq({
        employee: {
          _id: oid(),
          organizationId: oid(),
          role: "mr",
          assignedHeadQuarters: [oid()],
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.directReports, []);
    assert.deepEqual(res.body.otherReports, []);
  });

  it("splits admin leaves into zonal direct and other reports", async () => {
    const orgId = oid();
    const zmId = oid();
    const amId = oid();
    const mrId = oid();

    restores.push(
      stub(Employee, "find", (filter) => {
        const roles = filter.role.$in;
        if (roles.includes("zonalManager")) {
          return {
            select: () => ({
              lean: async () => [{ _id: zmId, role: "zonalManager" }],
            }),
          };
        }
        return {
          select: () => ({
            lean: async () => [
              { _id: amId, role: "areaManager" },
              { _id: mrId, role: "mr" },
            ],
          }),
        };
      }),
    );

    let leaveFilters = [];
    restores.push(
      stub(Leave, "find", (filter) => {
        leaveFilters.push(filter);
        return queryChain([]);
      }),
    );

    const res = mockRes();
    await getSubordinateLeaves(
      mockReq({
        organization: { _id: orgId },
        query: { status: "pending" },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(leaveFilters.length, 2);
    assert.equal(String(leaveFilters[0].employeeId.$in[0]), String(zmId));
    assert.equal(leaveFilters[0].status, "pending");
    assert.equal(leaveFilters[1].employeeId.$in.length, 2);
  });
});

describe("actionOnLeave", () => {
  it("allows area manager to approve MR leave in HQ scope", async () => {
    const orgId = oid();
    const amId = oid();
    const mrId = oid();
    const hqId = oid();
    const leaveId = oid();
    const leaveTypeId = oid();

    const leaveDoc = {
      _id: leaveId,
      status: "pending",
      organizationId: orgId,
      leaveType: leaveTypeId,
      employeeId: {
        _id: mrId,
        role: "mr",
        organizationId: orgId,
        assignedHeadQuarters: [hqId],
      },
      save: async function () {
        return this;
      },
    };

    restores.push(
      stub(Leave, "findOne", () => ({
        populate: async () => leaveDoc,
      })),
    );
    restores.push(
      stub(LeaveType, "findOne", async () => ({
        _id: leaveTypeId,
        annualQuota: 12,
      })),
    );
    restores.push(
      stub(EmployeeLeaveBalance, "findOne", async () => ({
        balance: 5,
      })),
    );
    restores.push(
      stub(EmployeeLeaveBalance, "findOneAndUpdate", async () => ({
        balance: 4,
      })),
    );
    restores.push(
      stub(Leave, "findById", () => ({
        populate: async () => ({ ...leaveDoc, status: "approved" }),
      })),
    );

    const res = mockRes();
    await actionOnLeave(
      mockReq({
        employee: {
          _id: amId,
          role: "areaManager",
          organizationId: orgId,
          assignedHeadQuarters: [hqId],
        },
        params: { id: String(leaveId) },
        body: { action: "approved" },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(leaveDoc.status, "approved");
    assert.equal(String(leaveDoc.approvedBy), String(amId));
    assert.equal(leaveDoc.approvedByRole, "areaManager");
  });

  it("rejects action when leave is outside manager HQ scope", async () => {
    const orgId = oid();
    const leaveId = oid();

    restores.push(
      stub(Leave, "findOne", () => ({
        populate: async () => ({
          _id: leaveId,
          status: "pending",
          organizationId: orgId,
          employeeId: {
            role: "mr",
            organizationId: orgId,
            assignedHeadQuarters: [oid()],
          },
        }),
      })),
    );

    const res = mockRes();
    await actionOnLeave(
      mockReq({
        employee: {
          _id: oid(),
          role: "areaManager",
          organizationId: orgId,
          assignedHeadQuarters: [oid()],
        },
        params: { id: String(leaveId) },
        body: { action: "approved" },
      }),
      res,
    );

    assert.equal(res.statusCode, 403);
  });
});

describe("getLeaveReport", () => {
  it("requires month and year", async () => {
    const res = mockRes();
    const { getLeaveReport } = await import(
      "../controllers/leaveReportController.js"
    );

    await getLeaveReport(
      mockReq({
        organization: { id: oid() },
        query: { pageNo: 1, limit: 10 },
      }),
      res,
    );

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /month and year/i);
  });

  it("returns paginated leave report rows", async () => {
    const orgId = oid();
    const employeeObjectId = oid();
    const leaveTypeId = oid();
    const hqId = oid();
    const res = mockRes();
    const { getLeaveReport } = await import(
      "../controllers/leaveReportController.js"
    );

    restores.push(
      stub(Employee, "countDocuments", async () => 1),
      stub(Employee, "find", (filter) => {
        if (filter?.role?.$in) {
          return queryChain([
            {
              _id: oid(),
              firstName: "Priya",
              lastName: "Mehta",
              role: "areaManager",
              assignedHeadQuarters: [hqId],
            },
          ]);
        }

        return queryChain([
          {
            _id: employeeObjectId,
            employeeId: "emp-001",
            firstName: "Rahul",
            lastName: "Sharma",
            displayName: "Rahul Sharma",
            role: "mr",
            organizationId: orgId,
            assignedHeadQuarters: [hqId],
          },
        ]);
      }),
      stub(LeaveType, "find", () =>
        queryChain([
          { _id: leaveTypeId, name: "Casual Leave", code: "CL" },
        ]),
      ),
      stub(Leave, "aggregate", async () => [
        {
          _id: { employeeId: employeeObjectId, leaveType: leaveTypeId },
          days: 2,
        },
      ]),
    );

    await getLeaveReport(
      mockReq({
        organization: { id: orgId },
        query: { month: 9, year: 2026, pageNo: 1, limit: 10 },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].employeeId, "emp-001");
    assert.equal(res.body.data[0].totalLeaves, 2);
    assert.equal(res.body.data[0].leaveBreakdown[0].code, "CL");
    assert.equal(res.body.pagination.total, 1);
  });
});
