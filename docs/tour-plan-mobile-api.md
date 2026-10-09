# Tour Plan (MTP) — Mobile Integration Guide

Monthly Tour Plan for MR (`role: mr`). **Employee JWT** on all tour-plan endpoints.

Area/doctor pickers use **existing** `GET /api/employee/getAssignedDetails` — no new master-data APIs.

---

## Screen load

```
1. GET /api/employee/getAssignedDetails          → cache areas + doctors
2. GET /api/tour-plans/me/month?year=&month=     → calendar + dayPlans (whole month)
```

**Date tap:** read `data.dayPlans[date]` locally — **no extra API call**.

---

## Month response shape (all month endpoints)

`GET /month`, `PUT /month/days`, `POST /copy-previous-month`, and `POST /submit` all return this core shape:

```json
{
  "success": true,
  "data": {
    "year": 2024,
    "month": 10,
    "status": "draft",
    "canEdit": true,
    "submittedAt": null,
    "rejectionReason": null,
    "summary": {
      "totalWorkingDays": 22,
      "plannedDaysCount": 18
    },
    "calendar": {
      "days": [
        {
          "date": "2024-10-18",
          "dayOfMonth": 18,
          "dayOfWeek": 5,
          "isSelectable": true,
          "isWeeklyOff": false,
          "isHoliday": false,
          "holidayName": null,
          "planStatus": "planned"
        }
      ]
    },
    "selectedDate": "2024-10-18",
    "dayPlans": {
      "2024-10-01": {
        "date": "2024-10-01",
        "areaIds": ["..."],
        "doctorIds": ["..."]
      },
      "2024-10-18": {
        "date": "2024-10-18",
        "areaIds": ["..."],
        "doctorIds": ["..."]
      }
    },
    "dayPlan": {
      "date": "2024-10-18",
      "areaIds": ["..."],
      "doctorIds": ["..."]
    }
  }
}
```

| Field | Use |
|-------|-----|
| `dayPlans` | **Primary** — map of all planned days; use on date tap |
| `dayPlan` | Convenience = `dayPlans[selectedDate]` |
| `calendar.days[].planStatus` | Blue / gray dots |
| `summary` | **`18 / 22 Days Planned`** header |

Missing key in `dayPlans` → empty pickers for that date.

---

## 1. Assigned areas & doctors (existing)

**`GET /api/employee/getAssignedDetails`**

Build area chips: `` `${name} (${headQuarterId.headQuarterName})` ``  
Filter doctors: `assignedDoctors.filter(d => selectedAreaIds.includes(d.areaId))`

---

## 2. Load month

**`GET /api/tour-plans/me/month?year=2024&month=10&selectedDate=2024-10-18`**

| Query | Required |
|-------|----------|
| `year`, `month` | yes |
| `selectedDate` | no — defaults to today (if working) or first unplanned day |

---

## 3. Bulk save days

**`PUT /api/tour-plans/me/month/days`**

```json
{
  "year": 2024,
  "month": 10,
  "selectedDate": "2024-10-18",
  "days": [
    {
      "date": "2024-10-18",
      "areaIds": ["areaId1", "areaId2"],
      "doctorIds": ["doctorId1", "doctorId2"]
    },
    {
      "date": "2024-10-22",
      "areaIds": ["areaId1"],
      "doctorIds": ["doctorId3"]
    }
  ]
}
```

- **One entry per date** — each item replaces that day's plan.
- Dates **not** in `days[]` are left unchanged.
- Clear a day: `"areaIds": [], "doctorIds": []`.
- Response: full month view + `savedDaysCount`.

---

## 4. Save single day (optional shortcut)

**`PUT /api/tour-plans/me/days/:date`**

```json
{
  "areaIds": ["..."],
  "doctorIds": ["..."]
}
```

Returns full month view (same shape as §2). Prefer bulk save when saving multiple days or on submit.

---

## 5. Copy previous month

**`POST /api/tour-plans/me/copy-previous-month`**

```json
{
  "year": 2024,
  "month": 10,
  "overwrite": false,
  "selectedDate": "2024-10-18"
}
```

Response includes full `dayPlans` plus:

```json
{
  "copy": {
    "copiedFrom": { "year": 2024, "month": 9 },
    "daysCopied": 15,
    "daysSkipped": 3,
    "skipped": [{ "date": "2024-10-02", "reason": "already_planned" }]
  }
}
```

---

## 6. Submit (optional save + submit in one call)

**`POST /api/tour-plans/me/submit`**

```json
{
  "year": 2024,
  "month": 10,
  "selectedDate": "2024-10-18",
  "days": [
    {
      "date": "2024-10-18",
      "areaIds": ["..."],
      "doctorIds": ["..."]
    }
  ]
}
```

- Omit `days` to submit the already-saved month.
- Include `days` to **bulk save then submit** in one request (typical **Submit for Approval** button flow).
- Response: full month view + `validationWarnings` (informational; partial submit allowed).

---

## Recommended mobile flows

| Action | API |
|--------|-----|
| Open screen | `GET /month` |
| Tap date | Local: `dayPlans[date]` |
| Edit + debounced save | `PUT /month/days` with changed day(s) |
| Submit button | `POST /submit` with full `days[]` for the month |
| Copy prev month | `POST /copy-previous-month` |

---

## Quick reference

| Action | Method | Path |
|--------|--------|------|
| Areas + doctors | GET | `/api/employee/getAssignedDetails` |
| Month + dayPlans | GET | `/api/tour-plans/me/month?year=&month=` |
| Plan for one date (reporting prefill) | GET | `/api/tour-plans/me/day?date=YYYY-MM-DD` |
| Bulk save | PUT | `/api/tour-plans/me/month/days` |
| Single day save | PUT | `/api/tour-plans/me/days/:date` |
| Copy prev month | POST | `/api/tour-plans/me/copy-previous-month` |
| Submit (+ optional save) | POST | `/api/tour-plans/me/submit` |

Swagger: `/api-docs` → **TourPlan**.

---

## Reporting screen — plan prefill (separate from daily visit APIs)

Tour plan and reporting are **different entities**. Do **not** change daily visit APIs.

When the user **selects a date** on the reporting screen, call:

**`GET /api/tour-plans/me/day?date=2024-10-18`**

**With plan:**

```json
{
  "success": true,
  "data": {
    "date": "2024-10-18",
    "hasPlan": true,
    "areaIds": ["...", "..."],
    "doctorIds": ["...", "..."]
  }
}
```

**No plan:**

```json
{
  "success": true,
  "data": {
    "date": "2024-10-18",
    "hasPlan": false,
    "areaIds": [],
    "doctorIds": []
  }
}
```

Mobile prefills area/doctor pickers from this response. Reporting submit stays **`POST /api/daily-visit/create`** unchanged.

---

## Manager / admin approval (AM / ZM / org admin)

### 1. Paginated list (all subordinate tour plans)

**`GET /api/tour-plans/subordinates`**

Auth: `authOrOrg` (AM, ZM employee JWT, or org admin token).

**Example:**
```
GET /api/tour-plans/subordinates?status=submitted&year=2026&month=9&role=mr&search=Rahul&pageNo=1&limit=10
```

| Query | Description |
|-------|-------------|
| `status` | `draft` / `submitted` / `approved` / `rejected` |
| `year`, `month` | Month filter |
| `role` | `mr` / `areaManager` / `zonalManager` |
| `search` or `name` | Employee first name, last name, or employeeId |
| `pageNo` | Default `1` |
| `limit` | Default `10`, max `50` |

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "_id": "planId",
      "reportGroup": "direct",
      "employee": {
        "_id": "...",
        "firstName": "Rahul",
        "lastName": "Sharma",
        "employeeId": "EMP001",
        "role": "mr",
        "displayName": "Rahul Sharma"
      },
      "year": 2026,
      "month": 9,
      "status": "submitted",
      "summary": { "totalWorkingDays": 22, "plannedDaysCount": 18 }
    }
  ],
  "pagination": { "pageNo": 1, "limit": 10, "total": 48, "totalPages": 5, "hasMore": true }
}
```

Org admin sees **all employees** (MR + AM + ZM) scoped to the org.

---

### 2. Full detail (tap a row)

**`GET /api/tour-plans/subordinates/:planId`**

Returns every planned day with **populated areas and doctors** (no extra lookup needed).

```json
{
  "success": true,
  "data": {
    "_id": "planId",
    "year": 2026,
    "month": 9,
    "status": "submitted",
    "employee": {
      "displayName": "Rahul Sharma",
      "role": "mr",
      "employeeId": "EMP001"
    },
    "calendar": { "days": [ "...working day flags..." ] },
    "summary": { "totalWorkingDays": 22, "plannedDaysCount": 18 },
    "days": [
      {
        "date": "2026-09-05",
        "areas": [
          {
            "areaId": "...",
            "name": "Ambernath",
            "headQuarterName": "KalyanHQ",
            "displayLabel": "Ambernath (KalyanHQ)"
          }
        ],
        "doctors": [
          {
            "doctorId": "...",
            "name": "DR ARCHANA PATIL",
            "specialty": "GP",
            "areaId": "..."
          }
        ]
      }
    ],
    "dayPlans": { "2026-09-05": { "...same as days[] entry..." } }
  }
}
```

Use **`days[]`** to render the day-by-day review UI.

---

### 3. Approve / reject

**`POST /api/tour-plans/:planId/action`**

**Approve:**
```json
{ "action": "approved" }
```

**Reject (reason required):**
```json
{
  "action": "rejected",
  "rejectionReason": "Please replan week 2 doctors"
}
```

- Only when `status === "submitted"`.
- Response returns the same enriched detail shape as GET detail.
- Reject → employee can edit and resubmit.
