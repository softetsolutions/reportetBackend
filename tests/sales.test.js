import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import mongoose from "mongoose";
import Sale from "../models/Sale.js";
import Stockist from "../models/Stockist.js";
import {
  createSale,
  updateSale,
  deleteSale,
  getHeadQuarterSales,
  alreadySubmitedSale,
} from "../controllers/saleController.js";
import { createSaleByAdmin } from "../controllers/adminSaleController.js";
import { mockReq, mockRes, queryChain, stub } from "./helpers.js";

const oid = () => new mongoose.Types.ObjectId();
const restores = [];
afterEach(() => {
  while (restores.length) restores.pop()();
});

describe("createSale", () => {
  it("returns 404 when the stockist is not in the employee org", async () => {
    restores.push(stub(Stockist, "findOne", async () => null));
    const res = mockRes();
    await createSale(
      mockReq({
        employee: { _id: oid(), organizationId: oid() },
        body: { stockist: oid(), month: "January", saleAmount: 10 },
      }),
      res,
    );
    assert.equal(res.statusCode, 404);
  });

  it("sets saleByModel to Employee", async () => {
    const stockistId = oid();
    const orgId = oid();
    const employeeId = oid();
    restores.push(
      stub(Stockist, "findOne", async () => ({ _id: stockistId })),
    );
    let created;
    restores.push(
      stub(Sale, "create", async (doc) => {
        created = doc;
        return doc;
      }),
    );
    const res = mockRes();
    await createSale(
      mockReq({
        employee: { _id: employeeId, organizationId: orgId },
        body: { stockist: stockistId, month: "March", saleAmount: 99 },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(created.saleByModel, "Employee");
    assert.equal(created.organizationId, orgId);
    assert.equal(created.month, "march");
  });
});

describe("updateSale", () => {
  it("rejects an empty whitelist", async () => {
    const res = mockRes();
    await updateSale(
      mockReq({
        params: { id: String(oid()) },
        organization: { id: oid() },
        body: { organizationId: oid(), saleBy: oid() },
      }),
      res,
    );
    assert.equal(res.statusCode, 400);
  });

  it("only $sets saleAmount, month, and stockist", async () => {
    let captured;
    restores.push(
      stub(Sale, "findOneAndUpdate", (filter, update) => {
        captured = { filter, update };
        return queryChain({ _id: filter._id, saleAmount: 5 });
      }),
    );
    const res = mockRes();
    const id = String(oid());
    const orgId = oid();
    await updateSale(
      mockReq({
        params: { id },
        organization: { id: orgId },
        body: {
          saleAmount: 5,
          month: "April",
          organizationId: oid(),
          saleBy: oid(),
        },
      }),
      res,
    );
    assert.deepEqual(Object.keys(captured.update.$set).sort(), [
      "month",
      "saleAmount",
    ]);
    assert.equal(captured.update.$set.month, "april");
    assert.equal(String(captured.filter.organizationId), String(orgId));
  });
});

describe("getHeadQuarterSales", () => {
  it("returns 401 without an organization", async () => {
    const res = mockRes();
    await getHeadQuarterSales(
      mockReq({ params: { headQuarterId: String(oid()) }, body: {} }),
      res,
    );
    assert.equal(res.statusCode, 401);
  });

  it("filters stockists and sales by organizationId", async () => {
    const orgId = oid();
    const hqId = String(oid());
    const stockistId = oid();
    let stockistFilter;
    let saleFilter;
    restores.push(
      stub(Stockist, "find", async (filter) => {
        stockistFilter = filter;
        return [{ _id: stockistId }];
      }),
    );
    restores.push(
      stub(Sale, "find", (filter) => {
        saleFilter = filter;
        return queryChain([]);
      }),
    );
    const res = mockRes();
    await getHeadQuarterSales(
      mockReq({
        params: { headQuarterId: hqId },
        organization: { _id: orgId },
        body: {},
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(String(stockistFilter.organizationId), String(orgId));
    assert.equal(String(saleFilter.organizationId), String(orgId));
  });
});

describe("deleteSale", () => {
  it("scopes delete to the organization", async () => {
    const orgId = oid();
    const id = String(oid());
    let filter;
    restores.push(
      stub(Sale, "findOneAndDelete", async (f) => {
        filter = f;
        return { _id: id };
      }),
    );
    const res = mockRes();
    await deleteSale(
      mockReq({ params: { id }, organization: { id: orgId } }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(String(filter.organizationId), String(orgId));
  });
});

describe("alreadySubmitedSale", () => {
  it("queries by employee and organization", async () => {
    const employeeId = oid();
    const orgId = oid();
    let filter;
    restores.push(
      stub(Sale, "findOne", async (f) => {
        filter = f;
        return null;
      }),
    );
    const res = mockRes();
    await alreadySubmitedSale(
      mockReq({ employee: { _id: employeeId, organizationId: orgId } }),
      res,
    );
    assert.equal(String(filter.saleBy), String(employeeId));
    assert.equal(String(filter.organizationId), String(orgId));
    assert.equal(res.body.isAlreadySunmitedSales, false);
  });
});

describe("createSaleByAdmin", () => {
  it("sets saleByModel to Organization", async () => {
    const orgId = oid();
    const stockistId = oid();
    restores.push(
      stub(Stockist, "findOne", async () => ({ _id: stockistId })),
    );
    let created;
    restores.push(
      stub(Sale, "create", async (doc) => {
        created = doc;
        return doc;
      }),
    );
    const res = mockRes();
    await createSaleByAdmin(
      mockReq({
        organization: { id: orgId },
        body: { stockist: stockistId, month: "May", saleAmount: 20 },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(created.saleByModel, "Organization");
    assert.equal(created.saleBy, orgId);
  });
});
