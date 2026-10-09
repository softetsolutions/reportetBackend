import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import HeadQuarter from "../models/HeadQuarter.js";
import Zone from "../models/Zone.js";
import PromotionHistory from "../models/PromotionHistory.js";
import TrackingSession from "../models/TrackingSession.js";
import LiveLocation from "../models/LiveLocation.js";
import {
  promoteEmployee,
  getEmployeePromotions,
} from "../controllers/promotionController.js";
import employeeRoutes from "../routes/employeeRoutes.js";
import { mockReq, mockRes, queryChain, stub, routeEntries } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("promotion routes", () => {
  it("registers promote and promotions before bare :employeeId", () => {
    const paths = routeEntries(employeeRoutes).map((r) => r.path);
    assert.ok(
      paths.indexOf("/:employeeId/promote") < paths.indexOf("/:employeeId"),
    );
    assert.ok(
      paths.indexOf("/:employeeId/promotions") < paths.indexOf("/:employeeId"),
    );
  });
});

describe("promoteEmployee", () => {
  it("rejects invalid promotion step", async () => {
    const orgId = oid();
    const employeeId = oid();
    restores.push(
      stub(Employee, "findOne", async () => ({
        _id: employeeId,
        role: "mr",
        isActive: true,
        organizationId: orgId,
        assignedHeadQuarters: [oid()],
        assignedZones: [],
      })),
    );

    const res = mockRes();
    await promoteEmployee(
      mockReq({
        params: { employeeId: String(employeeId) },
        body: { toRole: "zonalManager" },
        organization: { _id: orgId },
      }),
      res,
    );

    assert.equal(res.statusCode, 422);
    assert.match(res.body.message, /only promote to areaManager/i);
  });

  it("rejects when HQ is already on another area manager", async () => {
    const orgId = oid();
    const employeeId = oid();
    const hqId = oid();
    const otherAmId = oid();

    restores.push(
      stub(Employee, "findOne", (filter) => {
        if (filter.role === "areaManager") {
          return queryChain({
            _id: otherAmId,
            firstName: "Suresh",
            lastName: "Kumar",
            employeeId: "AM-07",
            assignedHeadQuarters: [{ _id: hqId, headQuarterName: "Delhi" }],
          });
        }
        return {
          _id: employeeId,
          role: "mr",
          isActive: true,
          organizationId: orgId,
          assignedHeadQuarters: [hqId],
          assignedZones: [],
          liveTrackingEnabled: true,
          save: async () => {},
        };
      }),
    );
    restores.push(
      stub(HeadQuarter, "find", () =>
        queryChain([{ _id: hqId, headQuarterName: "Delhi" }]),
      ),
    );

    const res = mockRes();
    await promoteEmployee(
      mockReq({
        params: { employeeId: String(employeeId) },
        body: {
          toRole: "areaManager",
          assignedHeadQuarters: [String(hqId)],
        },
        organization: { _id: orgId },
      }),
      res,
    );

    assert.equal(res.statusCode, 422);
    assert.match(res.body.message, /already assigned to Area Manager Suresh/);
  });

  it("forbids zonal manager from promoting AM to ZM", async () => {
    const orgId = oid();
    const employeeId = oid();
    restores.push(
      stub(Employee, "findOne", async () => ({
        _id: employeeId,
        role: "areaManager",
        isActive: true,
        organizationId: orgId,
        assignedHeadQuarters: [oid()],
        assignedZones: [],
      })),
    );

    const res = mockRes();
    await promoteEmployee(
      mockReq({
        params: { employeeId: String(employeeId) },
        body: { toRole: "zonalManager", assignedZones: [String(oid())] },
        employee: {
          _id: oid(),
          role: "zonalManager",
          organizationId: orgId,
          assignedHeadQuarters: [oid()],
        },
      }),
      res,
    );

    assert.equal(res.statusCode, 403);
    assert.match(res.body.message, /only promote MR to area manager/i);
  });

  it("promotes MR to AM with replace HQs as admin", async () => {
    const orgId = oid();
    const employeeId = oid();
    const oldHq = oid();
    const newHq1 = oid();
    const newHq2 = oid();
    let saved = null;
    let historyPayload = null;

    const employeeDoc = {
      _id: employeeId,
      role: "mr",
      isActive: true,
      organizationId: orgId,
      assignedHeadQuarters: [oldHq],
      assignedZones: [],
      liveTrackingEnabled: true,
      liveTrackingEnabledAt: new Date(),
      async save() {
        saved = {
          role: this.role,
          assignedHeadQuarters: this.assignedHeadQuarters.map(String),
          assignedZones: this.assignedZones,
          liveTrackingEnabled: this.liveTrackingEnabled,
        };
      },
    };

    restores.push(
      stub(Employee, "findOne", (filter) => {
        if (filter.role === "areaManager") return queryChain(null);
        return employeeDoc;
      }),
    );
    restores.push(
      stub(HeadQuarter, "find", () =>
        queryChain([
          { _id: newHq1, headQuarterName: "Noida" },
          { _id: newHq2, headQuarterName: "Ghaziabad" },
        ]),
      ),
    );
    restores.push(stub(TrackingSession, "find", () => queryChain([])));
    restores.push(stub(LiveLocation, "findOneAndUpdate", async () => null));
    restores.push(
      stub(PromotionHistory, "create", async (payload) => {
        historyPayload = payload;
        return { ...payload, _id: oid() };
      }),
    );
    restores.push(
      stub(Employee, "findById", () =>
        queryChain({
          _id: employeeId,
          role: "areaManager",
          assignedHeadQuarters: [newHq1, newHq2],
          assignedZones: [],
        }),
      ),
    );

    const res = mockRes();
    await promoteEmployee(
      mockReq({
        params: { employeeId: String(employeeId) },
        body: {
          toRole: "areaManager",
          assignedHeadQuarters: [String(newHq1), String(newHq2)],
        },
        organization: { _id: orgId },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(saved.role, "areaManager");
    assert.deepEqual(saved.assignedHeadQuarters, [
      String(newHq1),
      String(newHq2),
    ]);
    assert.equal(saved.liveTrackingEnabled, false);
    assert.equal(historyPayload.fromRole, "mr");
    assert.equal(historyPayload.toRole, "areaManager");
    assert.equal(historyPayload.promotedByRole, "admin");
  });

  it("promotes AM to ZM and derives HQs from zones", async () => {
    const orgId = oid();
    const employeeId = oid();
    const zoneId = oid();
    const hq1 = oid();
    const hq2 = oid();
    let saved = null;

    const employeeDoc = {
      _id: employeeId,
      role: "areaManager",
      isActive: true,
      organizationId: orgId,
      assignedHeadQuarters: [hq1],
      assignedZones: [],
      async save() {
        saved = {
          role: this.role,
          assignedZones: this.assignedZones.map(String),
          assignedHeadQuarters: this.assignedHeadQuarters.map(String),
        };
      },
    };

    restores.push(stub(Employee, "findOne", async () => employeeDoc));
    restores.push(
      stub(Zone, "find", () => queryChain([{ _id: zoneId, name: "North" }])),
    );
    restores.push(
      stub(HeadQuarter, "find", () => queryChain([{ _id: hq1 }, { _id: hq2 }])),
    );
    restores.push(
      stub(PromotionHistory, "create", async (payload) => ({
        ...payload,
        _id: oid(),
      })),
    );
    restores.push(
      stub(Employee, "findById", () =>
        queryChain({
          _id: employeeId,
          role: "zonalManager",
          assignedZones: [zoneId],
          assignedHeadQuarters: [hq1, hq2],
        }),
      ),
    );

    const res = mockRes();
    await promoteEmployee(
      mockReq({
        params: { employeeId: String(employeeId) },
        body: {
          toRole: "zonalManager",
          assignedZones: [String(zoneId)],
        },
        organization: { _id: orgId },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(saved.role, "zonalManager");
    assert.deepEqual(saved.assignedZones, [String(zoneId)]);
    assert.deepEqual(
      saved.assignedHeadQuarters.sort(),
      [String(hq1), String(hq2)].sort(),
    );
  });
});

describe("getEmployeePromotions", () => {
  it("returns history for admin", async () => {
    const orgId = oid();
    const employeeId = oid();
    restores.push(
      stub(Employee, "findOne", () => queryChain({ _id: employeeId })),
    );
    restores.push(
      stub(PromotionHistory, "find", () =>
        queryChain([
          {
            fromRole: "mr",
            toRole: "areaManager",
            employeeId,
          },
        ]),
      ),
    );

    const res = mockRes();
    await getEmployeePromotions(
      mockReq({
        params: { employeeId: String(employeeId) },
        organization: { _id: orgId },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.promotions.length, 1);
  });
});
