import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Doctor from "../models/Doctor.js";
import Area from "../models/Area.js";
import { getDoctorsByAreaId } from "../controllers/doctorController.js";
import { getAssignedDoctorAndArea } from "../controllers/employeeController.js";
import { mockReq, mockRes, queryChain, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("getDoctorsByAreaId", () => {
  it("returns 401 without an organization", async () => {
    const res = mockRes();
    await getDoctorsByAreaId(mockReq({ params: { areaId: String(oid()) } }), res);
    assert.equal(res.statusCode, 401);
  });

  it("filters doctors by areaId and organizationId", async () => {
    const orgId = oid();
    const areaId = String(oid());
    let filter;
    restores.push(
      stub(Doctor, "find", (f) => {
        filter = f;
        return queryChain([{ _id: oid(), name: "Dr A", specialty: "GP" }]);
      }),
    );
    const res = mockRes();
    await getDoctorsByAreaId(
      mockReq({
        params: { areaId },
        employee: { organizationId: orgId },
      }),
      res,
    );
    assert.equal(String(filter.areaId), areaId);
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.statusCode, 200);
  });
});

describe("getAssignedDoctorAndArea", () => {
  it("scopes areas and doctors to the employee organization", async () => {
    const orgId = oid();
    const hqId = oid();
    let areaFilter;
    let doctorFilter;
    restores.push(
      stub(Area, "find", async (f) => {
        areaFilter = f;
        return [{ _id: oid(), name: "A1" }];
      }),
    );
    restores.push(
      stub(Doctor, "find", async (f) => {
        doctorFilter = f;
        return [];
      }),
    );
    const res = mockRes();
    await getAssignedDoctorAndArea(
      mockReq({
        employee: {
          role: "mr",
          organizationId: orgId,
          assignedHeadQuarters: [hqId],
        },
      }),
      res,
    );
    assert.equal(String(areaFilter.organizationId), String(orgId));
    assert.equal(String(doctorFilter.organizationId), String(orgId));
    assert.equal(res.statusCode, 200);
  });
});
