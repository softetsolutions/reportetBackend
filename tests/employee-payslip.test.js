import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Payslip from "../models/Payslip.js";
import Organization from "../models/Organization.js";
import PayrollSettings from "../models/PayrollSettings.js";
import {
  buildEmployeePayslipPayload,
  getPayslipLayout,
  listPayslipTemplates,
} from "../utils/payslipLayout.js";
import {
  listMyPayslips,
  getMyPayslipForDownload,
} from "../controllers/employeePayslipController.js";
import payrollRoutes from "../routes/payrollRoutes.js";
import { mockReq, mockRes, stub, queryChain, routeEntries } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("employee payslip routes", () => {
  it("registers /me/payslips before admin run routes", () => {
    const paths = routeEntries(payrollRoutes).map((r) => r.path);
    assert.ok(paths.includes("/me/payslips"));
    assert.ok(paths.includes("/me/payslips/:payslipId"));
    assert.ok(paths.includes("/payslip-templates"));
  });
});

describe("payslip layouts", () => {
  it("exposes three templates", () => {
    const list = listPayslipTemplates();
    assert.deepEqual(
      list.map((t) => t.templateId).sort(),
      ["classic", "compact", "modern"],
    );
    assert.equal(getPayslipLayout("classic").sections[0].type, "header");
    assert.equal(getPayslipLayout("modern").sections.some((s) => s.type === "heroAmount"), true);
  });

  it("builds layout+data payload with org branding and masked bank", () => {
    const payload = buildEmployeePayslipPayload({
      templateId: "classic",
      organization: {
        _id: oid(),
        organizationName: "Acme Pharma",
        brandName: "Acme",
        logoUrl: "/uploads/logos/x.png",
      },
      employee: {
        _id: oid(),
        firstName: "Ravi",
        lastName: "Kumar",
        employeeId: "EMP01",
        role: "mr",
        email: "ravi@test.com",
      },
      payslip: {
        _id: oid(),
        month: 4,
        year: 2026,
        status: "finalized",
        currency: "INR",
        earnings: [{ label: "Basic", amount: 25000 }],
        deductions: [{ label: "PF", amount: 1800 }],
        gross: 25000,
        structureDeductions: 1800,
        finalLopDays: 1,
        lopAmount: 833.33,
        netPay: 22366.67,
        attendance: { presentDays: 20, paidLeaveDays: 1 },
        bankSnapshot: {
          accountHolderName: "Ravi Kumar",
          accountNumber: "123456789012",
          ifsc: "HDFC0001",
        },
      },
    });

    assert.equal(payload.templateId, "classic");
    assert.ok(payload.layout.sections.length > 0);
    assert.equal(payload.data.organization.organizationName, "Acme Pharma");
    assert.equal(payload.data.period.label, "April 2026");
    assert.equal(payload.data.bank.accountMasked, "XXXX9012");
    assert.ok(payload.data.deductions.some((d) => d.code === "LOP"));
  });
});

describe("employee payslip controllers", () => {
  it("lists only finalized slips for the employee", async () => {
    const empId = oid();
    const orgId = oid();
    restores.push(
      stub(Payslip, "find", () =>
        queryChain([
          {
            _id: oid(),
            month: 4,
            year: 2026,
            netPay: 20000,
            gross: 25000,
            lopAmount: 0,
            finalLopDays: 0,
            currency: "INR",
            status: "finalized",
            updatedAt: new Date(),
          },
        ]),
      ),
    );

    const res = mockRes();
    await listMyPayslips(
      mockReq({
        employee: { _id: empId, organizationId: orgId },
        query: {},
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.payslips.length, 1);
    assert.equal(res.body.payslips[0].periodLabel, "April 2026");
  });

  it("returns layout payload for a finalized slip", async () => {
    const empId = oid();
    const orgId = oid();
    const slipId = oid();

    restores.push(
      stub(Payslip, "findOne", () =>
        queryChain({
          _id: slipId,
          organizationId: orgId,
          employeeId: empId,
          month: 4,
          year: 2026,
          status: "finalized",
          currency: "INR",
          earnings: [{ label: "Basic", amount: 10000 }],
          deductions: [],
          gross: 10000,
          structureDeductions: 0,
          finalLopDays: 0,
          lopAmount: 0,
          netPay: 10000,
          attendance: {},
          bankSnapshot: {},
        }),
      ),
    );
    restores.push(
      stub(PayrollSettings, "findOne", () =>
        queryChain({
          payslipTemplate: "modern",
          weeklyOffWeekdays: [0],
          lopDivisorMethod: "calendar_days",
        }),
      ),
    );
    restores.push(
      stub(Organization, "findById", () =>
        queryChain({
          _id: orgId,
          organizationName: "Org",
          brandName: "Brand",
          logoUrl: null,
        }),
      ),
    );

    const res = mockRes();
    await getMyPayslipForDownload(
      mockReq({
        employee: {
          _id: empId,
          organizationId: orgId,
          firstName: "A",
          lastName: "B",
          employeeId: "E1",
          role: "mr",
        },
        params: { payslipId: String(slipId) },
        query: {},
      }),
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.templateId, "modern");
    assert.ok(res.body.layout);
    assert.ok(res.body.data);
    assert.equal(res.body.data.totals.netPay, 10000);
  });

  it("hides draft slips from employee download", async () => {
    const slipId = oid();
    restores.push(
      stub(Payslip, "findOne", () =>
        queryChain({
          _id: slipId,
          status: "draft",
          employeeId: oid(),
          organizationId: oid(),
        }),
      ),
    );

    const res = mockRes();
    await getMyPayslipForDownload(
      mockReq({
        employee: { _id: oid(), organizationId: oid() },
        params: { payslipId: String(slipId) },
        query: {},
      }),
      res,
    );
    assert.equal(res.statusCode, 403);
  });
});
