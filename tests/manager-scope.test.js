import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseApprovalAction,
  canApproveApplicantRole,
} from "../utils/managerScope.js";

describe("managerScope", () => {
  it("parseApprovalAction validates reject reason", () => {
    assert.equal(parseApprovalAction({ action: "approved" }).action, "approved");
    assert.ok(parseApprovalAction({ action: "rejected" }).error);
    assert.equal(
      parseApprovalAction({ action: "rejected", rejectionReason: "no" })
        .rejectionReason,
      "no",
    );
  });

  it("canApproveApplicantRole matches leave hierarchy", () => {
    assert.equal(canApproveApplicantRole("areaManager", "mr"), true);
    assert.equal(canApproveApplicantRole("areaManager", "zonalManager"), false);
    assert.equal(canApproveApplicantRole("admin", "zonalManager"), true);
  });
});
