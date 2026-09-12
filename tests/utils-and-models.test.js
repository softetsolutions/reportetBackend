import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mongoose from "mongoose";
import {
  generateOrganizationCode,
  getCellStringValue,
  getSuperiorRoles,
  getSubordinateRoles,
  currentYearInIndia,
} from "../utils/helperFunction.js";
import { Roles, roleOrder } from "../config/constants.js";
import Sale from "../models/Sale.js";
import Doctor from "../models/Doctor.js";
import Employee from "../models/Employee.js";

const oid = () => new mongoose.Types.ObjectId();

describe("generateOrganizationCode", () => {
  it("uses the first six letters of a single word", () => {
    const code = generateOrganizationCode("AcmeCorp");
    assert.match(code, /^ACMECO\d{4}$/);
  });

  it("uses initials for multi-word names", () => {
    const code = generateOrganizationCode("Soft ET Solutions");
    assert.match(code, /^SES\d{4}$/);
  });
});

describe("getCellStringValue", () => {
  it("returns empty string for nullish", () => {
    assert.equal(getCellStringValue(null), "");
    assert.equal(getCellStringValue(undefined), "");
  });

  it("trims strings and stringifies numbers", () => {
    assert.equal(getCellStringValue("  Delhi  "), "Delhi");
    assert.equal(getCellStringValue(42), "42");
  });

  it("unwraps hyperlink and rich text cells", () => {
    assert.equal(
      getCellStringValue({ hyperlink: "http://x", text: " Label " }),
      "Label",
    );
    assert.equal(
      getCellStringValue({ richText: [{ text: "A" }, { text: "B" }] }),
      "AB",
    );
  });
});

describe("role helpers", () => {
  it("matches schema role strings", () => {
    assert.equal(Roles.AREA_MANAGER, "areaManager");
    assert.deepEqual(roleOrder, ["mr", "areaManager", "zonalManager"]);
  });

  it("returns superior roles from the employee upward", () => {
    assert.deepEqual(getSuperiorRoles("mr"), [
      "mr",
      "areaManager",
      "zonalManager",
    ]);
    assert.deepEqual(getSuperiorRoles("areaManager"), [
      "areaManager",
      "zonalManager",
    ]);
    assert.deepEqual(getSuperiorRoles("unknown"), []);
  });

  it("returns subordinate roles from the bottom up to the employee", () => {
    assert.deepEqual(getSubordinateRoles("zonalManager"), [
      "mr",
      "areaManager",
      "zonalManager",
    ]);
    assert.deepEqual(getSubordinateRoles("mr"), ["mr"]);
  });

  it("currentYearInIndia is a four-digit year", () => {
    assert.equal(typeof currentYearInIndia, "number");
    assert.ok(currentYearInIndia >= 2020);
  });
});

describe("schemas", () => {
  it("requires saleByModel on Sale", () => {
    const sale = new Sale({
      saleBy: oid(),
      stockist: oid(),
      month: "january",
      year: 2026,
      saleAmount: 10,
      organizationId: oid(),
    });
    const err = sale.validateSync();
    assert.ok(err?.errors?.saleByModel);
  });

  it("requires organizationId on Doctor", () => {
    const doctor = new Doctor({ name: "Dr A", areaId: oid() });
    const err = doctor.validateSync();
    assert.ok(err?.errors?.organizationId);
  });

  it("does not treat password as modified when only reset token changes", () => {
    const employee = Employee.hydrate({
      _id: oid(),
      firstName: "A",
      lastName: "B",
      userName: "org_1",
      employeeId: "1",
      email: "a@b.c",
      phoneNumber: 999,
      password: "$2b$10$abcdefghijklmnopqrstuv",
      organizationId: oid(),
      isActive: true,
    });
    employee.resetPasswordToken = "hashed";
    assert.equal(employee.isModified("password"), false);
  });
});
