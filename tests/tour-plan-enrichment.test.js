import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";
import { enrichDayPlans } from "../utils/tourPlanEnrichment.js";
import { parseListFilters } from "../utils/tourPlanManagerQuery.js";
import { stub, queryChain } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("parseListFilters", () => {
  it("rejects invalid role", () => {
    assert.ok(parseListFilters({ role: "boss" }).error);
  });

  it("accepts search alias name", () => {
    const parsed = parseListFilters({ name: "Rahul", role: "mr" });
    assert.equal(parsed.search, "Rahul");
    assert.equal(parsed.role, "mr");
  });
});

describe("enrichDayPlans", () => {
  it("populates area and doctor labels per day", async () => {
    const orgId = oid();
    const areaId = oid();
    const doctorId = oid();
    const hqId = oid();

    restores.push(
      stub(Area, "find", () =>
        queryChain([
          {
            _id: areaId,
            name: "Ambernath",
            headQuarterId: { headQuarterName: "KalyanHQ" },
          },
        ]),
      ),
    );
    restores.push(
      stub(Doctor, "find", () =>
        queryChain([
          {
            _id: doctorId,
            name: "DR ARCHANA PATIL",
            specialty: "GP",
            areaId,
          },
        ]),
      ),
    );

    const { days, dayPlans } = await enrichDayPlans(orgId, {
      "2024-10-18": {
        date: "2024-10-18",
        areaIds: [String(areaId)],
        doctorIds: [String(doctorId)],
      },
    });

    assert.equal(days.length, 1);
    assert.equal(days[0].areas[0].displayLabel, "Ambernath (KalyanHQ)");
    assert.equal(days[0].doctors[0].name, "DR ARCHANA PATIL");
    assert.ok(dayPlans["2024-10-18"]);
  });
});
