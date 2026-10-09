import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import OrgHoliday from "../models/OrgHoliday.js";
import {
  buildIndiaHolidayPreset,
  listIndiaHolidayPresetMeta,
} from "../utils/indiaHolidayPresets.js";
import {
  bulkCreateHolidays,
  copyHolidaysYear,
  applyHolidayPreset,
  normalizeHolidayInput,
} from "../controllers/payrollHolidayController.js";
import payrollRoutes from "../routes/payrollRoutes.js";
import { mockReq, mockRes, stub, routeEntries, queryChain } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("holiday routes order", () => {
  it("registers static holiday paths before :holidayId", () => {
    const paths = routeEntries(payrollRoutes).map((r) => r.path);
    assert.ok(paths.includes("/holidays/template"));
    assert.ok(paths.includes("/holidays/import"));
    assert.ok(paths.includes("/holidays/bulk"));
    assert.ok(paths.includes("/holidays/copy-year"));
    assert.ok(paths.includes("/holidays/presets/apply"));
    assert.ok(
      paths.indexOf("/holidays/template") < paths.indexOf("/holidays/:holidayId"),
    );
  });
});

describe("india holiday presets", () => {
  it("exposes metadata and builds 2026 pack with national days", () => {
    const meta = listIndiaHolidayPresetMeta();
    assert.equal(meta.packId, "india_national");
    assert.ok(meta.supportedYears.includes(2026));

    const preset = buildIndiaHolidayPreset(2026);
    assert.equal(preset.hasYearPack, true);
    const dates = preset.holidays.map((h) => h.date);
    assert.ok(dates.includes("2026-01-26"));
    assert.ok(dates.includes("2026-08-15"));
    assert.ok(dates.includes("2026-10-02"));
  });

  it("falls back to fixed dates for unsupported years", () => {
    const preset = buildIndiaHolidayPreset(2030);
    assert.equal(preset.hasYearPack, false);
    assert.ok(preset.holidays.some((h) => h.date === "2030-01-26"));
  });
});

describe("normalizeHolidayInput", () => {
  it("rejects invalid dates", () => {
    assert.ok(normalizeHolidayInput("2026-02-30", "X").error);
    assert.ok(normalizeHolidayInput("26-01-2026", "X").error);
  });
});

describe("holiday bulk controllers", () => {
  it("bulk creates holidays", async () => {
    const orgId = oid();
    const saved = [];
    restores.push(stub(OrgHoliday, "findOne", () => queryChain(null)));
    restores.push(
      stub(OrgHoliday, "findOneAndUpdate", async (filter, update) => {
        const doc = {
          _id: oid(),
          organizationId: orgId,
          date: filter.date,
          name: update.$set.name,
        };
        saved.push(doc);
        return doc;
      }),
    );

    const res = mockRes();
    await bulkCreateHolidays(
      mockReq({
        organization: { _id: orgId },
        body: {
          holidays: [
            { date: "2026-01-26", name: "Republic Day" },
            { date: "2026-08-15", name: "Independence Day" },
          ],
        },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.created, 2);
    assert.equal(saved.length, 2);
  });

  it("copy-year maps MM-DD into target year", async () => {
    const orgId = oid();
    restores.push(
      stub(OrgHoliday, "find", () => ({
        sort() {
          return {
            lean: async () => [
              { date: "2025-01-26", name: "Republic Day" },
              { date: "2025-03-14", name: "Holi" },
            ],
          };
        },
      })),
    );
    restores.push(stub(OrgHoliday, "findOne", () => queryChain(null)));
    const dates = [];
    restores.push(
      stub(OrgHoliday, "findOneAndUpdate", async (filter, update) => {
        dates.push(filter.date);
        return {
          _id: oid(),
          date: filter.date,
          name: update.$set.name,
        };
      }),
    );

    const res = mockRes();
    await copyHolidaysYear(
      mockReq({
        organization: { _id: orgId },
        body: { fromYear: 2025, toYear: 2026, overwrite: false },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(dates.sort(), ["2026-01-26", "2026-03-14"]);
    assert.match(res.body.warning, /Festival dates/i);
  });

  it("applies india preset for a year", async () => {
    const orgId = oid();
    restores.push(stub(OrgHoliday, "findOne", () => queryChain(null)));
    let count = 0;
    restores.push(
      stub(OrgHoliday, "findOneAndUpdate", async (filter, update) => {
        count += 1;
        return { _id: oid(), date: filter.date, name: update.$set.name };
      }),
    );

    const res = mockRes();
    await applyHolidayPreset(
      mockReq({
        organization: { _id: orgId },
        body: { year: 2026, packId: "india_national", overwrite: false },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.ok(count >= 3);
    assert.equal(res.body.hasYearPack, true);
  });
});
