import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";
import Employee from "../models/Employee.js";
import {
  getAreaById,
  deleteArea,
  getEmployeeAssignedAreas,
  addArea,
} from "../controllers/areaController.js";
import { mockReq, mockRes, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("getAreaById", () => {
  it("queries by id and organizationId", async () => {
    const orgId = oid();
    const areaId = String(oid());
    let filter;
    restores.push(
      stub(Area, "findOne", (f) => {
        filter = f;
        return {
          select: async () => ({ _id: areaId, name: "A" }),
        };
      }),
    );
    const res = mockRes();
    await getAreaById(
      mockReq({ params: { id: areaId }, organization: { _id: orgId } }),
      res,
    );
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.body.name, "A");
  });
});

describe("deleteArea", () => {
  it("does not delete doctors for an area outside the org", async () => {
    const orgId = oid();
    restores.push(stub(Area, "findOne", async () => null));
    let doctorsDeleted = false;
    restores.push(
      stub(Doctor, "deleteMany", async () => {
        doctorsDeleted = true;
      }),
    );
    const res = mockRes();
    await deleteArea(
      mockReq({
        params: { areaId: String(oid()) },
        query: { force: "true" },
        organization: { _id: orgId },
      }),
      res,
    );
    assert.equal(res.statusCode, 404);
    assert.equal(doctorsDeleted, false);
  });

  it("force-deletes doctors scoped to the organization", async () => {
    const orgId = oid();
    const areaId = String(oid());
    restores.push(
      stub(Area, "findOne", async () => ({
        _id: areaId,
        organizationId: orgId,
      })),
    );
    restores.push(stub(Doctor, "countDocuments", async () => 2));
    let doctorFilter;
    restores.push(
      stub(Doctor, "deleteMany", async (f) => {
        doctorFilter = f;
        return { deletedCount: 2 };
      }),
    );
    restores.push(
      stub(Area, "findOneAndDelete", async () => ({ _id: areaId })),
    );
    const res = mockRes();
    await deleteArea(
      mockReq({
        params: { areaId },
        query: { force: "true" },
        organization: { _id: orgId },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(String(doctorFilter.organizationId), String(orgId));
    assert.equal(String(doctorFilter.areaId), areaId);
  });
});

describe("getEmployeeAssignedAreas", () => {
  it("looks up areas by headQuarterId and organizationId", async () => {
    const orgId = oid();
    const hqId = oid();
    let filter;
    restores.push(
      stub(Area, "find", async (f) => {
        filter = f;
        return [{ _id: oid(), name: "North" }];
      }),
    );
    const res = mockRes();
    await getEmployeeAssignedAreas(
      mockReq({
        employee: {
          organizationId: orgId,
          assignedHeadQuarters: [hqId],
        },
      }),
      res,
    );
    assert.equal(String(filter.organizationId), String(orgId));
    assert.ok(filter.headQuarterId.$in);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.assignedAreas[0].name, "North");
  });

  it("returns empty when the employee has no HQs", async () => {
    const res = mockRes();
    await getEmployeeAssignedAreas(
      mockReq({
        employee: { organizationId: oid(), assignedHeadQuarters: [] },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.assignedAreas, []);
  });
});

describe("addArea", () => {
  it("stamps organizationId from the authenticated org", async () => {
    const orgId = oid();
    const hqId = oid();
    let inserted;
    restores.push(
      stub(Area, "insertMany", async (docs) => {
        inserted = docs;
        return docs;
      }),
    );
    const res = mockRes();
    await addArea(
      mockReq({
        organization: { _id: orgId },
        body: { areaData: { Varanasi: { headQuarterId: hqId } } },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(inserted[0].organizationId, orgId);
    assert.equal(inserted[0].name, "Varanasi");
  });
});
