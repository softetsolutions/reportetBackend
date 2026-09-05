import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Stockist from "../models/Stockist.js";
import Zone from "../models/Zone.js";
import HeadQuarterBudget from "../models/HeadQuarterBudget.js";
import Notification from "../models/Notification.js";
import { createStockist, getStockistOptions } from "../controllers/stockistController.js";
import { getAllZoneOptions } from "../controllers/zoneController.js";
import {
  setHeadQuarterBudget,
  getConfiguredFinancialYears,
} from "../controllers/headQuarterBudgetController.js";
import {
  getNotifications,
  markAsRead,
} from "../controllers/notificationContoller.js";
import { addHeadquarter } from "../controllers/headQuarterController.js";
import { mockReq, mockRes, queryChain, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("stockists", () => {
  it("createStockist uses the authenticated org id", async () => {
    const orgId = oid();
    let created;
    restores.push(
      stub(Stockist, "create", async (doc) => {
        created = doc;
        return doc;
      }),
    );
    const res = mockRes();
    await createStockist(
      mockReq({
        organization: { _id: orgId },
        body: { name: "S1", address: "a", state: "UP", headQuarter: oid() },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(created.organizationId, orgId);
  });

  it("getStockistOptions returns 200 empty-HQ message for employees without HQs", async () => {
    const res = mockRes();
    await getStockistOptions(
      mockReq({
        employee: { organizationId: oid(), assignedHeadQuarters: [] },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, false);
  });
});

describe("zones", () => {
  it("lists zones for the organization", async () => {
    const orgId = oid();
    let filter;
    restores.push(
      stub(Zone, "find", async (f) => {
        filter = f;
        return [{ _id: oid(), name: "East" }];
      }),
    );
    const res = mockRes();
    await getAllZoneOptions(mockReq({ organization: { id: orgId } }), res);
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.statusCode, 200);
  });
});

describe("budget", () => {
  it("rejects an invalid financial year", async () => {
    const res = mockRes();
    await setHeadQuarterBudget(
      mockReq({
        params: { headQuarterId: String(oid()) },
        organization: { _id: oid() },
        body: { financialYear: "2025", months: [] },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });

  it("lists distinct years for the org", async () => {
    const orgId = oid();
    let filter;
    restores.push(
      stub(HeadQuarterBudget, "distinct", async (_field, f) => {
        filter = f;
        return ["2024-2025", "2025-2026"];
      }),
    );
    const res = mockRes();
    await getConfiguredFinancialYears(
      mockReq({ organization: { _id: orgId } }),
      res,
    );
    assert.equal(String(filter.organizationId), String(orgId));
    assert.deepEqual(res.body.financialYears, ["2025-2026", "2024-2025"]);
  });
});

describe("notifications", () => {
  it("lists notifications for the organization", async () => {
    const orgId = oid();
    let filter;
    restores.push(
      stub(Notification, "find", (f) => {
        filter = f;
        return queryChain([]);
      }),
    );
    restores.push(stub(Notification, "countDocuments", async () => 0));
    const res = mockRes();
    await getNotifications(
      mockReq({ organization: { _id: orgId }, query: {} }),
      res,
    );
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.statusCode, 200);
  });

  it("markAsRead is org-scoped", async () => {
    const orgId = oid();
    const id = String(oid());
    let filter;
    restores.push(
      stub(Notification, "findOneAndUpdate", async (f) => {
        filter = f;
        return { _id: id, isRead: true };
      }),
    );
    const res = mockRes();
    await markAsRead(
      mockReq({ params: { id }, organization: { _id: orgId } }),
      res,
    );
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.statusCode, 200);
  });
});

describe("addHeadquarter", () => {
  it("rejects an empty hierarchy", async () => {
    const res = mockRes();
    await addHeadquarter(
      mockReq({
        organization: { _id: oid() },
        body: { hierrarchy: { headquarters: [] } },
      }),
      res,
    );
    assert.equal(res.body.success, false);
  });

  it("returns 401 when the org is missing", async () => {
    const res = mockRes();
    await addHeadquarter(
      mockReq({
        body: { hierrarchy: { headquarters: [{ headQuarterName: "HQ1" }] } },
      }),
      res,
    );
    assert.equal(res.statusCode, 401);
  });
});
