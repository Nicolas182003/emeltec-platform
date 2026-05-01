const UTC_MINUS_3_MS = 3 * 60 * 60 * 1000;

function toDate(value) {
  if (value instanceof Date) return value;
  return new Date(value);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatUtcMinus3(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;

  const shifted = new Date(date.getTime() - UTC_MINUS_3_MS);

  const year = shifted.getUTCFullYear();
  const month = pad(shifted.getUTCMonth() + 1);
  const day = pad(shifted.getUTCDate());
  const hour = pad(shifted.getUTCHours());
  const minute = pad(shifted.getUTCMinutes());
  const second = pad(shifted.getUTCSeconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function parseUtcMinus3(rawValue) {
  if (!rawValue) return null;

  const value = String(rawValue).trim().replace("T", " ").replace("Z", "");
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) return null;

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) + 3,
      Number(minute),
      Number(second)
    )
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = {
  formatUtcMinus3,
  parseUtcMinus3,
};
