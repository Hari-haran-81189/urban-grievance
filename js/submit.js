// ===== Step 4: details form + anonymous submit =====
// Uses showMessage() and window.capturedReport from report.js, and "db" from config.js

const categorySelect = document.getElementById("category");
const titleInput = document.getElementById("title");
const descInput = document.getElementById("description");
const submitBtn = document.getElementById("submitBtn");
const successBox = document.getElementById("successBox");

// ---------- Load categories from the database ----------
async function loadCategories() {
  const { data, error } = await db.from("departments").select("category,label").order("label");
  if (error) {
    showMessage("Could not load categories. Check your internet and refresh.", "error");
    return;
  }
  categorySelect.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Select a category…";
  categorySelect.appendChild(first);
  data.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.category;
    opt.textContent = d.label;
    categorySelect.appendChild(opt);
  });
}

// ---------- Character counters ----------
titleInput.addEventListener("input", () => {
  document.getElementById("titleCount").textContent = titleInput.value.length + "/100";
});
descInput.addEventListener("input", () => {
  document.getElementById("descCount").textContent = descInput.value.length + "/1000";
});

// ---------- Hidden device id (used only for spam control, never shown) ----------
function getDeviceId() {
  let id = null;
  try { id = localStorage.getItem("deviceId"); } catch (e) {}
  if (!id) {
    id = crypto.randomUUID();
    try { localStorage.setItem("deviceId", id); } catch (e) {}
  }
  return id;
}

// ---------- Submit ----------
const nearbyBox = document.getElementById("nearbyBox");
const nearbyList = document.getElementById("nearbyList");
const newIssueBtn = document.getElementById("newIssueBtn");
const supportBox = document.getElementById("supportBox");
const NEAR_METERS = 50;   // same category + closer than this = "maybe the same issue"

// Distance between two GPS points in metres (haversine formula)
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Find open reports of the SAME category close to this spot
async function findNearby(category, lat, lng) {
  const box = 0.0006;   // about 65 m in degrees: a quick first filter in the database
  const { data, error } = await db.from("reports")
    .select("id,title,lat,lng,photo_path,severity,status,flag_count,created_at")
    .eq("category", category)
    .eq("status", "unsolved")
    .gte("lat", lat - box).lte("lat", lat + box)
    .gte("lng", lng - box).lte("lng", lng + box);
  if (error) { console.error(error); return []; }   // if the check fails, continue as a new report

  return data
    .map((r) => ({ ...r, dist: distanceMeters(lat, lng, r.lat, r.lng) }))
    .filter((r) => r.dist <= NEAR_METERS)           // exact 50 m check
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);                                   // show at most 3
}

// Hide the camera and forms after a success
function hideReportUi() {
  window.capturedReport = null;
  document.getElementById("detailsBox").hidden = true;
  nearbyBox.hidden = true;
  document.querySelector(".camera-box").hidden = true;
  document.querySelector(".buttons").hidden = true;
  document.getElementById("info").hidden = true;
  showMessage("");
}

// Show the "Is this the same issue?" panel
function showNearby(list) {
  nearbyList.innerHTML = "";
  list.forEach((r) => {
    const item = document.createElement("div");
    item.className = "nearby-item";

    const img = document.createElement("img");
    img.src = photoUrl(r.photo_path);
    img.alt = "Photo of the existing report";
    if (isBlurred(r)) img.classList.add("blurred");
    item.appendChild(img);

    const text = document.createElement("div");
    text.className = "nearby-text";

    const title = document.createElement("strong");
    title.textContent = r.title;                     // textContent: safe for public text
    text.appendChild(title);

    const addLine = (s) => {
      const d = document.createElement("div");
      d.textContent = s;
      text.appendChild(d);
    };
    addLine("📏 about " + Math.round(r.dist) + " m from you");
    addLine("👥 Reported by " + r.severity + (r.severity === 1 ? " person" : " people"));
    addLine(daysText(r));

    const view = document.createElement("a");
    view.href = "detail.html?id=" + encodeURIComponent(r.id);
    view.target = "_blank";
    view.rel = "noopener";
    view.textContent = "View report ↗";
    text.appendChild(view);

    const yes = document.createElement("button");
    yes.type = "button";
    yes.className = "btn";
    yes.textContent = "Yes, same issue – support it";
    yes.addEventListener("click", () => supportReport(r.id, yes));
    text.appendChild(yes);

    item.appendChild(text);
    nearbyList.appendChild(item);
  });
  nearbyBox.hidden = false;
  showMessage("");
  nearbyBox.scrollIntoView({ behavior: "smooth" });
}

// "Yes, same issue": add +1 to the existing report (no new report is created)
async function supportReport(reportId, button) {
  button.disabled = true;
  button.textContent = "Saving…";

  const { data, error } = await db.rpc("add_supporter", {
    p_report: reportId, p_device: getDeviceId(),
  });

  if (error) {
    console.error(error);
    showMessage("Could not add your support. Please try again.", "error");
    button.disabled = false;
    button.textContent = "Yes, same issue – support it";
    return;
  }

  hideReportUi();
  document.getElementById("supportText").textContent = data.already_counted
    ? "You have already reported or supported this issue, so it was not counted twice. It is reported by " + data.severity + (data.severity === 1 ? " person." : " people.")
    : "Thank you! Your support was added. This issue is now reported by " + data.severity + (data.severity === 1 ? " person." : " people.");
  document.getElementById("supportLink").href = "detail.html?id=" + encodeURIComponent(reportId);
  supportBox.hidden = false;
}

// Save a brand-new report (photo + report + hidden device id)
async function saveNewReport(category, title, description) {
  const c = window.capturedReport;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  showMessage("Uploading your report, please wait…");

  const reportId = crypto.randomUUID();
  const photoPath = reportId + ".jpg";

  try {
    // 1) Upload the photo
    const up = await db.storage.from("report-photos").upload(photoPath, c.blob, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (up.error) throw up.error;

    // 2) Save the report
    const ins = await db.from("reports").insert({
      id: reportId,
      title: title,
      category: category,
      description: description,
      lat: c.lat,
      lng: c.lng,
      gps_accuracy_m: c.accuracy,
      photo_path: photoPath,
    });
    if (ins.error) throw ins.error;

    // 3) Save the hidden device id
    const priv = await db.from("report_private").insert({
      report_id: reportId,
      device_id: getDeviceId(),
    });
    if (priv.error) console.warn("Private info not saved:", priv.error);

    hideReportUi();
    successBox.hidden = false;
  } catch (err) {
    console.error(err);
    showMessage("Sorry, the report could not be sent: " + err.message + ". Please try again.", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit report";
  }
}

// Submit button: check the form, look for nearby duplicates, then save
async function submitReport() {
  const c = window.capturedReport;
  if (!c) { showMessage("Please capture a photo first.", "error"); return; }

  const category = categorySelect.value;
  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  if (!category) { showMessage("Please choose a category.", "error"); return; }
  if (title.length < 3) { showMessage("Title must be at least 3 characters.", "error"); return; }
  if (description.length < 10) { showMessage("Description must be at least 10 characters.", "error"); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking…";
  showMessage("Checking for similar reports nearby…");

  const nearby = await findNearby(category, c.lat, c.lng);
  if (nearby.length > 0) {
    showNearby(nearby);                       // the user decides: support or new issue
    submitBtn.textContent = "Submit report";  // stays disabled while the panel is open
    return;
  }
  await saveNewReport(category, title, description);
}

// "No, this is a new issue" -> save normally
newIssueBtn.addEventListener("click", () => {
  nearbyBox.hidden = true;
  saveNewReport(categorySelect.value, titleInput.value.trim(), descInput.value.trim());
});

submitBtn.addEventListener("click", submitReport);
loadCategories();