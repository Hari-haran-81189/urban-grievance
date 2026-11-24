// ===== Shared helper functions (used by feed, and later by the detail page) =====

// How many days since a date
function daysSince(dateText) {
  return Math.floor((Date.now() - new Date(dateText).getTime()) / 86400000);
}

// Public link to a photo stored in the "report-photos" bucket
function photoUrl(path) {
  return db.storage.from("report-photos").getPublicUrl(path).data.publicUrl;
}

// Text like "⏳ 3 days unresolved" or "✅ Solved"
function daysText(report) {
  if (report.status === "done") return "✅ Solved";
  const d = daysSince(report.created_at);
  if (d === 0) return "⏳ Reported today";
  return "⏳ " + d + (d === 1 ? " day" : " days") + " unresolved";
}

// Loads the category list [{category, label}, ...] from the database
async function loadCategoryList() {
  const { data, error } = await db.from("departments").select("category,label").order("label");
  if (error) throw error;
  return data;
}

// Hidden device id (same key "deviceId" that submit.js uses)
function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem("deviceId"); } catch (e) {}
  if (!id) {
    id = crypto.randomUUID();
    try { localStorage.setItem("deviceId", id); } catch (e) {}
  }
  return id;
}

// Photos flagged by this many different devices are shown blurred (never deleted)
const BLUR_AT = 3;

function isBlurred(report) {
  return (report.flag_count || 0) >= BLUR_AT;
}

// Distance between two GPS points in metres
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}