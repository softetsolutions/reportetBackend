import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import TourPlanMonth from "../models/TourPlanMonth.js";
import OrgHoliday from "../models/OrgHoliday.js";
import PayrollSettings from "../models/PayrollSettings.js";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";
import {
  parseDateKey,
  parseYearMonth,
  isPlannedDay,
  countPlannedWorkingDays,
  buildCalendarWithPlanStatus,
  canEditTourPlan,
  dayPlansObjectFromMap,
} from "../utils/tourPlanCalendar.js";
import { normalizeIdList, validateDayPlanPayload } from "../utils/tourPlanValidation.js";
import {
  getMyTourPlanMonth,
  getMyTourPlanDay,
  upsertMyTourPlanDay,
} from "../controllers/tourPlanController.js";
import tourPlanRoutes from "../routes/tourPlanRoutes.js";
import { mockReq, mockRes, stub, routeEntries, queryChain } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("tour plan routes", () => {
  it("registers static paths before parameterized routes", () => {
    const paths = routeEntries(tourPlanRoutes).map((r) => r.path);
    assert.ok(paths.includes("/me/month"));
    assert.ok(paths.includes("/me/day"));
    assert.ok(paths.includes("/me/month/days"));
    assert.ok(paths.includes("/me/copy-previous-month"));
    assert.ok(paths.includes("/me/submit"));
    assert.ok(paths.includes("/me/days/:date"));
    assert.ok(
      paths.indexOf("/me/month/days") < paths.indexOf("/me/days/:date"),
    );
  });
});

describe("tourPlanCalendar helpers", () => {
  it("parses year and month", () => {
    assert.deepEqual(parseYearMonth("2024", "10"), { year: 2024, month: 10 });
    assert.ok(parseYearMonth("x", "10").error);
  });

  it("parses date keys", () => {
    assert.deepEqual(parseDateKey("2024-10-18"), {
      date: "2024-10-18",
      year: 2024,
      month: 10,
      day: 18,
    });
    assert.ok(parseDateKey("2024-13-01").error);
  });

  it("counts planned working days", () => {
    const calendarDays = [
      { date: "2024-10-01", isSelectable: true },
      { date: "2024-10-02", isSelectable: true },
      { date: "2024-10-06", isSelectable: false },
    ];
    const planMap = new Map([
      ["2024-10-01", { areaIds: ["a"], doctorIds: ["d"] }],
      ["2024-10-02", { areaIds: [], doctorIds: [] }],
    ]);
    assert.equal(countPlannedWorkingDays(calendarDays, planMap), 1);
    assert.equal(
      buildCalendarWithPlanStatus(calendarDays, planMap)[0].planStatus,
      "planned",
    );
  });

  it("knows editable statuses", () => {
    assert.equal(canEditTourPlan("draft"), true);
    assert.equal(canEditTourPlan("rejected"), true);
    assert.equal(canEditTourPlan("submitted"), false);
  });

  it("builds dayPlans object from map", () => {
    const map = new Map([
      ["2024-10-01", { date: "2024-10-01", areaIds: ["a"], doctorIds: ["d"] }],
      ["2024-10-02", { date: "2024-10-02", areaIds: [], doctorIds: [] }],
    ]);
    const dayPlans = dayPlansObjectFromMap(map);
    assert.ok(dayPlans["2024-10-01"]);
    assert.equal(dayPlans["2024-10-02"], undefined);
  });
});

describe("validateDayPlanPayload", () => {
  it("requires both areas and doctors when planning", async () => {
    const employee = { organizationId: oid(), assignedHeadQuarters: [oid()] };
    restores.push(
      stub(Area, "find", () => queryChain([])),
    );
    const result = await validateDayPlanPayload({
      employee,
      areaIds: [String(oid())],
      doctorIds: [],
    });
    assert.ok(result.error);
  });

  it("allows clearing with empty arrays", async () => {
    const employee = { organizationId: oid(), assignedHeadQuarters: [oid()] };
    const result = await validateDayPlanPayload({
      employee,
      areaIds: [],
      doctorIds: [],
    });
    assert.equal(result.clear, true);
  });
});

describe("getMyTourPlanMonth", () => {
  it("returns 422 for invalid month", async () => {
    const res = mockRes();
    await getMyTourPlanMonth(
      mockReq({ query: { year: "2024", month: "13" }, employee: { organizationId: oid(), _id: oid() } }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });
});

describe("getMyTourPlanDay", () => {
  it("returns 422 when date is missing", async () => {
    const res = mockRes();
    await getMyTourPlanDay(
      mockReq({ query: {}, employee: { organizationId: oid(), _id: oid() } }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });

  it("returns plan areaIds and doctorIds for a date", async () => {
    const areaId = oid();
    const doctorId = oid();
    restores.push(
      stub(TourPlanMonth, "findOne", () =>
        queryChain({
          days: [
            {
              date: "2024-10-18",
              areaIds: [areaId],
              doctorIds: [doctorId],
            },
          ],
        }),
      ),
    );
    const res = mockRes();
    await getMyTourPlanDay(
      mockReq({
        query: { date: "2024-10-18" },
        employee: { organizationId: oid(), _id: oid() },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.hasPlan, true);
    assert.equal(res.body.data.areaIds[0], String(areaId));
  });
});

describe("upsertMyTourPlanDay", () => {
  it("rejects non-working days", async () => {
    const orgId = oid();
    const employeeId = oid();
    restores.push(
      stub(PayrollSettings, "findOne", () =>
        queryChain({ weeklyOffWeekdays: [0] }),
      ),
    );
    restores.push(
      stub(PayrollSettings, "create", async (doc) => doc),
    );
    restores.push(
      stub(OrgHoliday, "find", () => queryChain([])),
    );

    const sunday = "2024-10-06";
    const res = mockRes();
    await upsertMyTourPlanDay(
      mockReq({
        params: { date: sunday },
        body: { areaIds: [String(oid())], doctorIds: [String(oid())] },
        employee: {
          _id: employeeId,
          organizationId: orgId,
          assignedHeadQuarters: [oid()],
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });
});

describe("isPlannedDay", () => {
  it("requires areas and doctors", () => {
    assert.equal(isPlannedDay({ areaIds: ["a"], doctorIds: ["d"] }), true);
    assert.equal(isPlannedDay({ areaIds: ["a"], doctorIds: [] }), false);
    assert.equal(normalizeIdList(["x"]).error, "invalid id: x");
  });
});
