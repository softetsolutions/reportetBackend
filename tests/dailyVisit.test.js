import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import DailyVisit from "../models/Daily-Visit.js";
import {
  createDailyVisit,
  updateDailyVisit,
  getDailyVisitList,
} from "../controllers/dailyVisit.js";
import { mockReq, mockRes, queryChain, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("createDailyVisit", () => {
  it("requires area, doctor, and visitDate", async () => {
    const res = mockRes();
    await createDailyVisit(
      mockReq({
        employee: { _id: oid(), organizationId: oid() },
        body: { areaId: [], doctorId: [], visitDate: "" },
      }),
      res,
    );
    assert.equal(res.statusCode, 400);
  });

  it("stores organizationId from the employee", async () => {
    const orgId = oid();
    const employeeId = oid();
    let created;
    restores.push(
      stub(DailyVisit, "create", async (doc) => {
        created = doc;
        return doc;
      }),
    );
    const res = mockRes();
    await createDailyVisit(
      mockReq({
        employee: { _id: employeeId, organizationId: orgId },
        body: {
          areaId: [oid()],
          doctorId: [oid()],
          visitDate: "2026-05-01",
          remark: "ok",
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(created.organizationId, orgId);
    assert.equal(created.employeeId, employeeId);
  });
});

describe("updateDailyVisit", () => {
  it("does not apply organizationId or employeeId from the body", async () => {
    let captured;
    restores.push(
      stub(DailyVisit, "findOneAndUpdate", (filter, update) => {
        captured = { filter, update };
        return queryChain({ _id: filter._id, remark: "x" });
      }),
    );
    const orgId = oid();
    const res = mockRes();
    await updateDailyVisit(
      mockReq({
        params: { id: String(oid()) },
        organization: { id: orgId },
        body: {
          remark: "updated",
          organizationId: oid(),
          employeeId: oid(),
        },
      }),
      res,
    );
    assert.deepEqual(Object.keys(captured.update.$set), ["remark"]);
    assert.equal(String(captured.filter.organizationId), String(orgId));
  });
});

describe("getDailyVisitList", () => {
  it("scopes the list to the employee organization", async () => {
    const employeeId = oid();
    const orgId = oid();
    let filter;
    restores.push(
      stub(DailyVisit, "find", (f) => {
        filter = f;
        return queryChain([]);
      }),
    );
    const res = mockRes();
    await getDailyVisitList(
      mockReq({
        employee: { _id: employeeId, organizationId: orgId },
        body: { pageNumber: 1, rowsPerPage: 10 },
      }),
      res,
    );
    assert.equal(String(filter.employeeId), String(employeeId));
    assert.equal(String(filter.organizationId), String(orgId));
  });
});
