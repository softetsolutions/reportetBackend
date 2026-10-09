import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import TourPlanMonth from "../models/TourPlanMonth.js";
import Employee from "../models/Employee.js";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";
import OrgHoliday from "../models/OrgHoliday.js";
import PayrollSettings from "../models/PayrollSettings.js";
import {
  getSubordinateTourPlans,
  actionOnTourPlan,
} from "../controllers/tourPlanManagerController.js";
import { mockReq, mockRes, stub, queryChain } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("getSubordinateTourPlans", () => {
  it("returns empty lists for MR", async () => {
    const res = mockRes();
    await getSubordinateTourPlans(
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
    assert.deepEqual(res.body.plans, []);
    assert.deepEqual(res.body.directReports, []);
    assert.deepEqual(res.body.otherReports, []);
    assert.equal(res.body.pagination.total, 0);
  });

  it("filters submitted plans for area manager direct reports", async () => {
    const orgId = oid();
    const hqId = oid();
    const mrId = oid();

    restores.push(
      stub(Employee, "find", (filter) => {
        const roles = filter.role.$in;
        if (roles.includes("mr")) {
          return {
            select: () => ({
              lean: async () => [{ _id: mrId, role: "mr" }],
            }),
          };
        }
        return { select: () => ({ lean: async () => [] }) };
      }),
    );

    let planFilter;
    let skipValue;
    let limitValue;
    restores.push(
      stub(TourPlanMonth, "find", (filter) => {
        planFilter = filter;
        const chain = queryChain([]);
        chain.skip = (n) => {
          skipValue = n;
          return chain;
        };
        chain.limit = (n) => {
          limitValue = n;
          return chain;
        };
        return chain;
      }),
    );
    restores.push(stub(TourPlanMonth, "countDocuments", async () => 3));

    const res = mockRes();
    await getSubordinateTourPlans(
      mockReq({
        employee: {
          _id: oid(),
          role: "areaManager",
          organizationId: orgId,
          assignedHeadQuarters: [hqId],
        },
        query: {
          status: "submitted",
          year: "2024",
          month: "10",
          pageNo: "2",
          limit: "5",
        },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(planFilter.status, "submitted");
    assert.equal(planFilter.year, 2024);
    assert.equal(planFilter.month, 10);
    assert.equal(String(planFilter.employeeId.$in[0]), String(mrId));
    assert.equal(skipValue, 5);
    assert.equal(limitValue, 5);
    assert.equal(res.body.pagination.pageNo, 2);
    assert.equal(res.body.pagination.total, 3);
    assert.equal(res.body.pagination.hasMore, false);
  });

  it("returns 422 for invalid role filter", async () => {
    const res = mockRes();
    await getSubordinateTourPlans(
      mockReq({
        employee: {
          _id: oid(),
          role: "areaManager",
          organizationId: oid(),
          assignedHeadQuarters: [oid()],
        },
        query: { role: "invalid" },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });
});

describe("actionOnTourPlan", () => {
  it("allows area manager to approve submitted MR plan in HQ scope", async () => {
    const orgId = oid();
    const amId = oid();
    const hqId = oid();
    const planId = oid();

    const planDoc = {
      _id: planId,
      status: "submitted",
      organizationId: orgId,
      year: 2024,
      month: 10,
      days: [{ date: "2024-10-18", areaIds: [oid()], doctorIds: [oid()] }],
      employeeId: {
        _id: oid(),
        role: "mr",
        organizationId: orgId,
        assignedHeadQuarters: [hqId],
      },
      save: async function () {
        return this;
      },
    };

    restores.push(
      stub(TourPlanMonth, "findOne", () => ({
        populate: async () => planDoc,
      })),
    );
    restores.push(
      stub(TourPlanMonth, "findById", () => ({
        populate: () => ({
          lean: async () => ({ ...planDoc, status: "approved" }),
        }),
      })),
    );
    restores.push(
      stub(PayrollSettings, "findOne", () => queryChain({ weeklyOffWeekdays: [0] })),
    );
    restores.push(stub(PayrollSettings, "create", async (doc) => doc));
    restores.push(stub(OrgHoliday, "find", () => queryChain([])));
    restores.push(stub(Area, "find", () => queryChain([])));
    restores.push(stub(Doctor, "find", () => queryChain([])));

    const res = mockRes();
    await actionOnTourPlan(
      mockReq({
        employee: {
          _id: amId,
          role: "areaManager",
          organizationId: orgId,
          assignedHeadQuarters: [hqId],
        },
        params: { planId: String(planId) },
        body: { action: "approved" },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(planDoc.status, "approved");
    assert.equal(String(planDoc.reviewedBy), String(amId));
    assert.equal(planDoc.reviewedByRole, "areaManager");
  });

  it("requires rejectionReason when rejecting", async () => {
    const res = mockRes();
    await actionOnTourPlan(
      mockReq({
        employee: {
          _id: oid(),
          role: "areaManager",
          organizationId: oid(),
          assignedHeadQuarters: [oid()],
        },
        params: { planId: String(oid()) },
        body: { action: "rejected" },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });
});
