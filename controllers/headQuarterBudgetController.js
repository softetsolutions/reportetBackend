import HeadQuarterBudget, {
  FINANCIAL_YEAR_MONTHS,
} from "../models/HeadQuarterBudget.js";
import HeadQuarter from "../models/HeadQuarter.js";

const FY_REGEX = /^\d{4}-\d{4}$/;

const isValidFinancialYear = (fy) => {
  if (!FY_REGEX.test(fy)) return false;
  const [start, end] = fy.split("-").map(Number);
  return end === start + 1;
};

export const setHeadQuarterBudget = async (req, res) => {
  try {
    const { headQuarterId } = req.params;
    const { financialYear, months } = req.body;
    const organizationId = req?.organization?._id;

    if (!financialYear || !isValidFinancialYear(financialYear)) {
      return res.status(422).json({
        success: false,
        message:
          "financialYear must be in the format 'YYYY-YYYY', e.g. '2025-2026'",
      });
    }

    if (!Array.isArray(months) || months.length !== 12) {
      return res.status(422).json({
        success: false,
        message: "Provide allocatedBudget for all 12 months",
      });
    }

    const providedMonths = new Set(months.map((m) => m.month));
    const missing = FINANCIAL_YEAR_MONTHS.filter((m) => !providedMonths.has(m));
    if (missing.length) {
      return res.status(422).json({
        success: false,
        message: `Missing budget entries for: ${missing.join(", ")}`,
      });
    }

    for (const m of months) {
      if (
        !FINANCIAL_YEAR_MONTHS.includes(m.month) ||
        typeof m.allocatedBudget !== "number" ||
        m.allocatedBudget < 0
      ) {
        return res.status(422).json({
          success: false,
          message: `Invalid entry for month "${m.month}". allocatedBudget must be a non-negative number.`,
        });
      }
    }

    const hq = await HeadQuarter.findOne({
      _id: headQuarterId,
      organizationId,
    });
    if (!hq) {
      return res.status(404).json({
        success: false,
        message: "Headquarter not found or access denied",
      });
    }

    const orderedMonths = FINANCIAL_YEAR_MONTHS.map((monthName) => {
      const entry = months.find((m) => m.month === monthName);
      return { month: monthName, allocatedBudget: entry.allocatedBudget };
    });

    const budget = await HeadQuarterBudget.findOneAndUpdate(
      { organizationId, headQuarterId, financialYear },
      { $set: { months: orderedMonths } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    res.status(200).json({
      success: true,
      message: "Budget saved successfully",
      data: budget,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A budget for this headquarter and financial year already exists",
      });
    }
    console.error("Error saving headquarter budget:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not save budget, try again later",
    });
  }
};

export const getHeadQuarterBudget = async (req, res) => {
  try {
    const { headQuarterId } = req.params;
    const { financialYear } = req.query;
    const organizationId = req?.organization?._id;

    if (!financialYear || !isValidFinancialYear(financialYear)) {
      return res.status(422).json({
        success: false,
        message:
          "Provide a valid financialYear query param, e.g. ?financialYear=2025-2026",
      });
    }

    const budget = await HeadQuarterBudget.findOne({
      organizationId,
      headQuarterId,
      financialYear,
    }).populate("headQuarterId", "headQuarterName location");

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "No budget found for this headquarter and financial year",
      });
    }

    res.status(200).json({ success: true, data: budget });
  } catch (error) {
    console.error("Error fetching headquarter budget:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch budget",
    });
  }
};

export const getAllHeadQuarterBudgetsForYear = async (req, res) => {
  try {
    const { financialYear } = req.query;
    const organizationId = req?.organization?._id;

    if (!financialYear || !isValidFinancialYear(financialYear)) {
      return res.status(422).json({
        success: false,
        message:
          "Provide a valid financialYear query param, e.g. ?financialYear=2025-2026",
      });
    }

    const [allHQs, budgets] = await Promise.all([
      HeadQuarter.find({ organizationId }).select(
        "_id headQuarterName location",
      ),
      HeadQuarterBudget.find({ organizationId, financialYear }),
    ]);

    const budgetByHQId = new Map(
      budgets.map((b) => [String(b.headQuarterId), b]),
    );

    const result = allHQs.map((hq) => ({
      headQuarterId: hq._id,
      headQuarterName: hq.headQuarterName,
      location: hq.location,
      budget: budgetByHQId.get(String(hq._id)) || null,
    }));

    res.status(200).json({
      success: true,
      financialYear,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching org budgets:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch budgets",
    });
  }
};

export const getConfiguredFinancialYears = async (req, res) => {
  try {
    const organizationId = req?.organization?._id;

    const years = await HeadQuarterBudget.distinct("financialYear", {
      organizationId,
    });

    res.status(200).json({
      success: true,
      financialYears: years.sort().reverse(),
    });
  } catch (error) {
    console.error("Error fetching financial years:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch financial years",
    });
  }
};

export const updateMonthlyBudget = async (req, res) => {
  try {
    const { headQuarterId } = req.params;
    const { financialYear, months } = req.body;
    const organizationId = req?.organization?._id;

    if (!financialYear || !isValidFinancialYear(financialYear)) {
      return res.status(422).json({
        success: false,
        message:
          "financialYear must be in the format 'YYYY-YYYY', e.g. '2025-2026'",
      });
    }

    if (!Array.isArray(months) || !months.length) {
      return res.status(422).json({
        success: false,
        message:
          "Provide at least one month to update, e.g. [{ month: 'June', allocatedBudget: 60000 }]",
      });
    }

    for (const m of months) {
      if (
        !FINANCIAL_YEAR_MONTHS.includes(m.month) ||
        typeof m.allocatedBudget !== "number" ||
        m.allocatedBudget < 0
      ) {
        return res.status(422).json({
          success: false,
          message: `Invalid entry for month "${m.month}". allocatedBudget must be a non-negative number.`,
        });
      }
    }

    const budget = await HeadQuarterBudget.findOne({
      organizationId,
      headQuarterId,
      financialYear,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message:
          "No budget found for this headquarter and financial year. Create it first using the full budget setup.",
      });
    }

    const updatesByMonth = new Map(
      months.map((m) => [m.month, m.allocatedBudget]),
    );

    budget.months = budget.months.map((entry) =>
      updatesByMonth.has(entry.month)
        ? {
            month: entry.month,
            allocatedBudget: updatesByMonth.get(entry.month),
          }
        : entry,
    );

    await budget.save();

    res.status(200).json({
      success: true,
      message: `Budget updated for: ${months.map((m) => m.month).join(", ")}`,
      data: budget,
    });
  } catch (error) {
    console.error("Error updating monthly budget:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update monthly budget, try again later",
    });
  }
};
