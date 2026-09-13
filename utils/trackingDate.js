/** IST calendar day as YYYY-MM-DD (contract date key). */
export const todayKey = (d = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
};

export const isValidDateKey = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || "");
