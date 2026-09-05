import assert from "node:assert/strict";
import { describe, it } from "node:test";
import areaRoutes from "../routes/areaRoutes.js";
import budgetRoutes from "../routes/headQuarterBudgetRoutes.js";
import dailyVisitRoutes from "../routes/daily-visit.js";
import saleRoutes from "../routes/saleRoutes.js";
import leaveRoutes from "../routes/leaveRoutes.js";
import employeeRoutes from "../routes/employeeRoutes.js";
import doctorRoutes from "../routes/doctorRoutes.js";
import headQuarterRoutes from "../routes/headQuarterRoutes.js";
import { routeEntries } from "./helpers.js";

describe("route order", () => {
  it("registers /headquarter/:id before /:id on areas", () => {
    const paths = routeEntries(areaRoutes).map((r) => r.path);
    assert.ok(paths.indexOf("/headquarter/:id") < paths.indexOf("/:id"));
  });

  it("registers /meta/years before /:headQuarterId on budgets", () => {
    const paths = routeEntries(budgetRoutes).map((r) => r.path);
    assert.ok(
      paths.indexOf("/meta/years") < paths.indexOf("/:headQuarterId"),
    );
  });

  it("registers /workingReporting before /:id on daily visits", () => {
    const paths = routeEntries(dailyVisitRoutes).map((r) => r.path);
    assert.ok(paths.indexOf("/workingReporting") < paths.indexOf("/:id"));
  });

  it("protects headQuarterSales with a named path", () => {
    const hq = routeEntries(saleRoutes).find(
      (r) => r.path === "/headQuarterSales/:headQuarterId",
    );
    assert.ok(hq);
    assert.ok(hq.methods.includes("post"));
  });

  it("mounts manager leave actions on a distinct path", () => {
    const paths = routeEntries(leaveRoutes).map((r) => r.path);
    assert.ok(paths.includes("/team"));
    assert.ok(paths.includes("/:leaveId/action/manager"));
  });
});

describe("route surface", () => {
  it("exposes employee assigned-details before /:employeeId", () => {
    const paths = routeEntries(employeeRoutes).map((r) => r.path);
    assert.ok(
      paths.indexOf("/getAssignedDetails") < paths.indexOf("/:employeeId"),
    );
  });

  it("exposes doctor getByAreaId", () => {
    const paths = routeEntries(doctorRoutes).map((r) => r.path);
    assert.ok(paths.includes("/getByAreaId/:areaId"));
  });

  it("exposes HQ static GET paths before /:headquarterId/assignments", () => {
    const paths = routeEntries(headQuarterRoutes)
      .filter((r) => r.methods.includes("get"))
      .map((r) => r.path);
    assert.ok(paths.includes("/unassigned"));
    assert.ok(paths.includes("/zones"));
    assert.ok(
      paths.indexOf("/unassigned") <
        paths.indexOf("/:headquarterId/assignments"),
    );
    assert.ok(
      paths.indexOf("/zones") < paths.indexOf("/:headquarterId/assignments"),
    );
  });
});
