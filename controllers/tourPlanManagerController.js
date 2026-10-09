import mongoose from "mongoose";
import TourPlanMonth from "../models/TourPlanMonth.js";
import { buildTourPlanMonthView } from "../utils/tourPlanResponse.js";
import {
  getActorContext,
  parseApprovalAction,
  assertCanActionEmployee,
} from "../utils/managerScope.js";
import {
  parseListFilters,
  resolveFilteredSubordinates,
} from "../utils/tourPlanManagerQuery.js";

const TOUR_PLAN_POPULATE = [
  {
    path: "employeeId",
    select: "firstName lastName employeeId role assignedHeadQuarters",
  },
  {
    path: "reviewedBy",
    select: "firstName lastName role",
  },
];

const TOUR_PLAN_SORT = { year: -1, month: -1, submittedAt: -1, updatedAt: -1 };

const parsePagination = (query) => {
  const pageNo = Math.max(1, Number.parseInt(query.pageNo, 10) || 1);
  const limit = Math.min(
    Math.max(1, Number.parseInt(query.limit, 10) || 10),
    50,
  );
  return { pageNo, limit, skip: (pageNo - 1) * limit };
};

const emptyListResponse = (pageNo, limit, message) => ({
  success: true,
  message,
  plans: [],
  directReports: [],
  otherReports: [],
  pagination: {
    pageNo,
    limit,
    total: 0,
    totalPages: 0,
    hasMore: false,
  },
});

const buildTourPlanQuery = ({
  organizationId,
  employeeIds,
  status,
  year,
  month,
}) => {
  const filter = {
    organizationId,
    employeeId: { $in: employeeIds },
  };

  if (status) filter.status = status;
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);

  return filter;
};

const fetchPaginatedPlansForEmployees = async ({
  organizationId,
  employeeIds,
  status,
  year,
  month,
  skip,
  limit,
}) => {
  if (!employeeIds.length) {
    return { plans: [], total: 0 };
  }

  const filter = buildTourPlanQuery({
    organizationId,
    employeeIds,
    status,
    year,
    month,
  });

  const [plans, total] = await Promise.all([
    TourPlanMonth.find(filter)
      .populate(TOUR_PLAN_POPULATE)
      .sort(TOUR_PLAN_SORT)
      .skip(skip)
      .limit(limit)
      .lean(),
    TourPlanMonth.countDocuments(filter),
  ]);

  return { plans, total };
};

const formatListRow = async (plan, directIdSet) => {
  const row = await buildTourPlanMonthView({ monthDoc: plan, mode: "list" });
  const employee = plan.employeeId;
  const employeeDbId = String(employee?._id ?? employee);
  const reportGroup = directIdSet.has(employeeDbId) ? "direct" : "other";

  return {
    ...row,
    reportGroup,
    employee: employee
      ? {
          _id: employee._id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId,
          role: employee.role,
          displayName: `${employee.firstName} ${employee.lastName}`.trim(),
        }
      : null,
  };
};

export const getSubordinateTourPlans = async (req, res) => {
  try {
    const actor = getActorContext(req);
    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const filters = parseListFilters(req.query);
    if (filters.error) {
      return res.status(422).json({ success: false, message: filters.error });
    }

    const { pageNo, limit, skip } = parsePagination(req.query);
    const scope = await resolveFilteredSubordinates(actor, filters);

    if (!scope.hasSubordinates) {
      return res.status(200).json(
        emptyListResponse(pageNo, limit, "You do not have any subordinates"),
      );
    }

    if (!scope.employees.length) {
      return res.status(200).json(
        emptyListResponse(pageNo, limit, "No employees match the filters"),
      );
    }

    const employeeIds = scope.employees.map((e) => e._id);
    const { plans, total } = await fetchPaginatedPlansForEmployees({
      organizationId: actor.organizationId,
      employeeIds,
      status: filters.status,
      year: filters.year,
      month: filters.month,
      skip,
      limit,
    });

    const formattedPlans = await Promise.all(
      plans.map((plan) => formatListRow(plan, scope.directIdSet)),
    );

    const directReports = formattedPlans.filter((p) => p.reportGroup === "direct");
    const otherReports = formattedPlans.filter((p) => p.reportGroup === "other");
    const totalPages = Math.ceil(total / limit) || 0;

    return res.status(200).json({
      success: true,
      plans: formattedPlans,
      directReports,
      otherReports,
      pagination: {
        pageNo,
        limit,
        total,
        totalPages,
        hasMore: pageNo < totalPages,
      },
    });
  } catch (error) {
    console.error("getSubordinateTourPlans:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subordinate tour plans",
    });
  }
};

export const getSubordinateTourPlanById = async (req, res) => {
  try {
    const actor = getActorContext(req);
    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { planId } = req.params;
    if (!mongoose.isObjectIdOrHexString(planId)) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    const planDoc = await TourPlanMonth.findOne({
      _id: planId,
      organizationId: actor.organizationId,
    })
      .populate(TOUR_PLAN_POPULATE)
      .lean();

    if (!planDoc) {
      return res.status(404).json({
        success: false,
        message: "Tour plan not found",
      });
    }

    const applicant = planDoc.employeeId;
    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Tour plan employee not found",
      });
    }

    const authError = assertCanActionEmployee(actor, applicant, "tour plan");
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    const data = await buildTourPlanMonthView({
      monthDoc: planDoc,
      mode: "managerDetail",
    });

    const employee = planDoc.employeeId;
    data.employee = {
      _id: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeId: employee.employeeId,
      role: employee.role,
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getSubordinateTourPlanById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch tour plan",
    });
  }
};

export const actionOnTourPlan = async (req, res) => {
  try {
    const actor = getActorContext(req);
    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { planId } = req.params;
    if (!mongoose.isObjectIdOrHexString(planId)) {
      return res.status(400).json({ success: false, message: "Invalid plan ID" });
    }

    const parsedAction = parseApprovalAction(req.body);
    if (parsedAction.error) {
      return res.status(422).json({ success: false, message: parsedAction.error });
    }

    const plan = await TourPlanMonth.findOne({
      _id: planId,
      organizationId: actor.organizationId,
    }).populate("employeeId", "role organizationId assignedHeadQuarters firstName lastName employeeId");

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Tour plan not found",
      });
    }

    if (plan.status !== "submitted") {
      return res.status(409).json({
        success: false,
        message: `Tour plan is already ${plan.status}`,
      });
    }

    const applicant = plan.employeeId;
    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Tour plan employee not found",
      });
    }

    const authError = assertCanActionEmployee(actor, applicant, "tour plan");
    if (authError) {
      return res.status(403).json({ success: false, message: authError });
    }

    plan.status = parsedAction.action;
    plan.reviewedBy = actor.kind === "employee" ? actor.actorId : null;
    plan.reviewedByRole = actor.role;
    plan.reviewedAt = new Date();
    plan.rejectionReason = parsedAction.rejectionReason;

    await plan.save();

    const populated = await TourPlanMonth.findById(plan._id)
      .populate(TOUR_PLAN_POPULATE)
      .lean();

    const data = await buildTourPlanMonthView({
      monthDoc: populated,
      mode: "managerDetail",
    });

    const employee = populated.employeeId;
    data.employee = {
      _id: employee._id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeId: employee.employeeId,
      role: employee.role,
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
    };

    // Fire-and-forget so approve/reject stays fast if notification infra is slow.
    void (async () => {
      try {
        const { triggerNotification } = await import(
          "../utils/NotificationService.js"
        );
        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        const periodLabel = `${monthNames[plan.month - 1] || plan.month} ${plan.year}`;
        const approved = parsedAction.action === "approved";
        await triggerNotification({
          organizationId: actor.organizationId,
          eventType: "tourPlanActionResult",
          recipient: applicant._id,
          templateData: {
            action: parsedAction.action,
            year: plan.year,
            month: plan.month,
            periodLabel,
            planId: String(plan._id),
            rejectionReason: parsedAction.rejectionReason || "",
          },
          fallbackTitle: approved
            ? "Tour plan approved"
            : "Tour plan rejected",
          fallbackMessage: approved
            ? `Your tour plan for ${periodLabel} was approved.`
            : `Your tour plan for ${periodLabel} was rejected${
                parsedAction.rejectionReason
                  ? `: ${parsedAction.rejectionReason}`
                  : "."
              }`,
        });
      } catch (notifyError) {
        console.error("tour plan action notification failed:", notifyError);
      }
    })();

    return res.status(200).json({
      success: true,
      message: `Tour plan ${parsedAction.action} successfully`,
      data,
    });
  } catch (error) {
    console.error("actionOnTourPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to action tour plan",
    });
  }
};
