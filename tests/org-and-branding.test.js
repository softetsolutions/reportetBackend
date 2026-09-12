import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import {
  editBranding,
  getMyOrganization,
} from "../controllers/logoController.js";
import { orgLogin } from "../controllers/orgAuthController.js";
import { mockReq, mockRes, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("editBranding", () => {
  it("returns 401 without an organization", async () => {
    const res = mockRes();
    await editBranding(mockReq({ body: { brandName: "X" } }), res);
    assert.equal(res.statusCode, 401);
  });

  it("does not include password in the response", async () => {
    const orgId = oid();
    restores.push(
      stub(Organization, "findByIdAndUpdate", async () => ({
        _id: orgId,
        organizationName: "Acme",
        brandName: "NewBrand",
        logoUrl: null,
        email: "a@b.c",
        code: "ACME",
        password: "$2b$10$secret-hash",
      })),
    );
    const res = mockRes();
    await editBranding(
      mockReq({
        organization: { _id: orgId },
        body: { brandName: "NewBrand" },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.brandName, "NewBrand");
    assert.equal(res.body.data.password, undefined);
  });
});

describe("getMyOrganization", () => {
  it("selects a safe field list", async () => {
    const orgId = oid();
    let selected;
    restores.push(
      stub(Organization, "findById", () => ({
        select(fields) {
          selected = fields;
          return Promise.resolve({
            _id: orgId,
            organizationName: "Acme",
            brandName: "ReportET",
            logoUrl: null,
            email: "a@b.c",
            code: "ACME",
          });
        },
      })),
    );
    const res = mockRes();
    await getMyOrganization(mockReq({ organization: { _id: orgId } }), res);
    assert.equal(res.statusCode, 200);
    assert.match(String(selected), /brandName/);
    assert.doesNotMatch(String(selected), /password/);
  });
});

describe("orgLogin", () => {
  it("returns 401 for unknown email", async () => {
    restores.push(stub(Organization, "findOne", async () => null));
    const res = mockRes();
    await orgLogin(
      mockReq({ body: { email: "no@one.com", password: "x" } }),
      res,
    );
    assert.equal(res.statusCode, 401);
  });
});
