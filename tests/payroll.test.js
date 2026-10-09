import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import {
  resolveDivisorDays,
  computeLopAmount,
  sumLines,
  round2,
} from "../utils/payrollAttendance.js";
import {
  createPayrollRun,
  updatePayslip,
  finalizePayrollRun,
  exportBankFile,
} from "../controllers/payrollController.js";
import PayrollRun from "../models/PayrollRun.js";
import Payslip from "../models/Payslip.js";
import PayrollSettings from "../models/PayrollSettings.js";
import DailyVisit from "../models/Daily-Visit.js";
import Leave from "../models/Leave.js";
import OrgHoliday from "../models/OrgHoliday.js";
import { mockReq, mockRes, queryChain, stub, routeEntries } from "./helpers.js";
import payrollRoutes from "../routes/payrollRoutes.js";
import { computeEmployeeMonthAttendance } from "../utils/payrollAttendance.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("payroll routes surface", () => {
  it("mounts core payroll paths", () => {
    const paths = routeEntries(payrollRoutes).map((r) => r.path);
    assert.ok(paths.includes("/settings"));
    assert.ok(paths.includes("/runs"));
    assert.ok(paths.includes("/runs/:runId/finalize"));
    assert.ok(paths.includes("/runs/:runId/export/bank-file"));
  });
});

describe("payroll math helpers", () => {
  it("computes LOP on calendar days", () => {
    const attendance = { calendarDays: 30, workingDaysInMonth: 26 };
    const divisor = resolveDivisorDays(attendance, "calendar_days");
    assert.equal(divisor, 30);
    assert.equal(computeLopAmount(30000, 2, divisor), 2000);
  });

  it("sums earning lines", () => {
    assert.equal(
      sumLines([
        { amount: 10000 },
        { amount: 5000.555 },
      ]),
      round2(15000.555),
    );
  });
});

describe("computeEmployeeMonthAttendance", () => {
  it("marks weekly offs and visits correctly", async () => {
    const orgId = oid();
    const empId = oid();
    // April 2026: starts Wednesday; Sundays = 5,12,19,26
    restores.push(
      stub(OrgHoliday, "find", () =>
        queryChain([{ date: "2026-04-14", name: "Test Holiday" }]),
      ),
    );
    restores.push(
      stub(DailyVisit, "find", () =>
        queryChain([
          { visitDate: "2026-04-01" },
          { visitDate: "2026-04-02" },
        ]),
      ),
    );
    restores.push(
      stub(Leave, "find", () =>
        queryChain([
          {
            leaveDate: new Date("2026-04-03T10:00:00.000Z"),
            leaveType: { paid: true },
          },
        ]),
      ),
    );

    const result = await computeEmployeeMonthAttendance({
      organizationId: orgId,
      employeeId: empId,
      year: 2026,
      month: 4,
      settings: { weeklyOffWeekdays: [0], lopDivisorMethod: "calendar_days" },
    });

    assert.equal(result.calendarDays, 30);
    assert.equal(result.weeklyOffDays, 4);
    assert.equal(result.holidayDays, 1);
    assert.equal(result.presentDays, 2);
    assert.equal(result.paidLeaveDays, 1);
    assert.ok(result.suggestedLopDays >= 0);
    assert.equal(
      result.weeklyOffDays +
        result.holidayDays +
        result.presentDays +
        result.paidLeaveDays +
        result.unpaidLeaveDays +
        result.absentDays,
      30,
    );
  });
});

describe("payroll run controllers", () => {
  it("rejects invalid month on create", async () => {
    const res = mockRes();
    await createPayrollRun(
      mockReq({
        organization: { _id: oid() },
        body: { month: 13, year: 2026 },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });

  it("allows admin to waive LOP on draft payslip", async () => {
    const orgId = oid();
    const runId = oid();
    const slipId = oid();

    restores.push(
      stub(PayrollRun, "findOne", async () => ({
        _id: runId,
        organizationId: orgId,
        status: "draft",
      })),
    );

    const payslipDoc = {
      _id: slipId,
      status: "draft",
      gross: 30000,
      structureDeductions: 2000,
      attendance: { calendarDays: 30, workingDaysInMonth: 26 },
      finalLopDays: 2,
      lopAmount: 2000,
      netPay: 26000,
      async save() {},
    };
    restores.push(stub(Payslip, "findOne", async () => payslipDoc));
    restores.push(
      stub(PayrollSettings, "findOne", async () => ({
        lopDivisorMethod: "calendar_days",
        weeklyOffWeekdays: [0],
      })),
    );
    // getOrCreate may create - stub create path via findOne returning settings
    restores.push(
      stub(Payslip, "find", () =>
        queryChain([
          {
            status: "draft",
            gross: 30000,
            structureDeductions: 2000,
            lopAmount: 0,
            netPay: 28000,
          },
        ]),
      ),
    );
    restores.push(stub(PayrollRun, "findByIdAndUpdate", async () => null));

    // Ensure getOrCreatePayrollSettings doesn't try to create
    restores.push(
      stub(PayrollSettings, "create", async (doc) => doc),
    );

    const res = mockRes();
    await updatePayslip(
      mockReq({
        organization: { _id: orgId },
        params: { runId: String(runId), payslipId: String(slipId) },
        body: { finalLopDays: 0 },
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(payslipDoc.finalLopDays, 0);
    assert.equal(payslipDoc.lopAmount, 0);
    assert.equal(payslipDoc.netPay, 28000);
  });

  it("blocks bank export until finalized", async () => {
    const orgId = oid();
    const runId = oid();
    restores.push(
      stub(PayrollRun, "findOne", () =>
        queryChain({ _id: runId, status: "draft", month: 4, year: 2026 }),
      ),
    );
    const res = mockRes();
    await exportBankFile(
      mockReq({
        organization: { _id: orgId },
        params: { runId: String(runId) },
      }),
      res,
    );
    assert.equal(res.statusCode, 422);
  });

  it("finalizes draft slips", async () => {
    const orgId = oid();
    const runId = oid();
    const runDoc = {
      _id: runId,
      organizationId: orgId,
      status: "draft",
      async save() {
        this.status = "finalized";
      },
    };
    restores.push(stub(PayrollRun, "findOne", async () => runDoc));
    restores.push(stub(Payslip, "updateMany", async () => ({ modifiedCount: 2 })));
    restores.push(
      stub(Payslip, "find", () =>
        queryChain([
          {
            status: "finalized",
            gross: 10,
            structureDeductions: 1,
            lopAmount: 0,
            netPay: 9,
          },
        ]),
      ),
    );
    restores.push(stub(PayrollRun, "findByIdAndUpdate", async () => null));
    restores.push(
      stub(PayrollRun, "findById", () =>
        queryChain({ ...runDoc, status: "finalized" }),
      ),
    );

    const res = mockRes();
    await finalizePayrollRun(
      mockReq({
        organization: { _id: orgId },
        params: { runId: String(runId) },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(runDoc.status, "finalized");
  });
});
