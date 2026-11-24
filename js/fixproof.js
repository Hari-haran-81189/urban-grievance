// ===== Steps 11+12: fix proof (after photo) =====
const fixBox = document.getElementById("fixBox");
const afterList = document.getElementById("afterList");
const fixNotice = document.getElementById("fixNotice");
const uploadBox = document.getElementById("uploadBox");
const fixVideo = document.getElementById("fixVideo");
const fixPreview = document.getElementById("fixPreview");
const fixCanvas = document.getElementById("fixCanvas");
const fixMsg = document.getElementById("fixMsg");
const fixStartBtn = document.getElementById("fixStartBtn");
const fixCaptureBtn = document.getElementById("fixCaptureBtn");
const fixRetakeBtn = document.getElementById("fixRetakeBtn");
const fixSubmitBtn = document.getElementById("fixSubmitBtn");

let fixReport = null;      // the report being viewed
let fixStream = null;      // running camera
let fixCapture = null;     // { blob, lat, lng }
let fixPreviewUrl = null;

function fixSay(text, type = "") {
  fixMsg.textContent = text;
  fixMsg.className = "message " + type;
}

// Called from detail.js once the report is loaded
async function initFixProof(report) {
  fixReport = report;
  await showAfterPhotos();
  await decideUploadBox();
  // Came from the officer dashboard (detail.html?id=...#fix)? Scroll to the upload area
  if (window.location.hash === "#fix") {
    const target = !uploadBox.hidden ? uploadBox : fixBox;
    target.scrollIntoView({ behavior: "smooth" });
  }
}

// ---------- Show existing Before / After photos ----------
function buildAfterCard(a) {
  const card = document.createElement("div");
  card.className = "after-card";

  const pair = document.createElement("div");
  pair.className = "before-after";

  const makeSide = (label, path, blurred) => {
    const side = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "ba-label";
    tag.textContent = label;
    const img = document.createElement("img");
    img.src = photoUrl(path);
    img.alt = label + " photo";
    if (blurred) img.classList.add("blurred");
    side.appendChild(tag);
    side.appendChild(img);
    return side;
  };
  pair.appendChild(makeSide("Before", fixReport.photo_path, isBlurred(fixReport)));
  pair.appendChild(makeSide("After", a.photo_path, false));
  card.appendChild(pair);

  const addLine = (text) => {
    const d = document.createElement("div");
    d.textContent = text;
    card.appendChild(d);
  };
  addLine("🛠️ " + a.full_name + " – " + a.designation);
  addLine("🏛️ " + a.department);
  addLine("📅 " + new Date(a.created_at).toLocaleString());
  addLine(a.confirmed
    ? "✅ Location verified (" + a.distance_m + " m from the original spot)"
    : "⚠️ Location did not match (" + a.distance_m + " m away) – issue stays unsolved");
  return card;
}

async function showAfterPhotos() {
  const { data, error } = await db.rpc("get_after_photos", { p_report: fixReport.id });
  if (error) { console.error(error); return; }
  afterList.innerHTML = "";
  if (data.length > 0) fixBox.hidden = true;           // hide the "no photo yet" placeholder
  data.forEach((a) => afterList.appendChild(buildAfterCard(a)));
}

// ---------- Who may upload? ----------
async function decideUploadBox() {
  if (fixReport.status === "done") return;              // already solved

  const official = await getCurrentOfficial();
  if (!official || !official.approved) {
    fixNotice.textContent = "Only government officials can upload fix proof. ";
    const link = document.createElement("a");
    link.href = "official-login.html";
    link.textContent = "Official login";
    fixNotice.appendChild(link);
    fixNotice.hidden = false;
    return;
  }
  if (!official.categories.includes(fixReport.category)) {
    fixNotice.textContent = "This report is outside your department.";
    fixNotice.hidden = false;
    return;
  }
  const away = haversineMeters(official.center_lat, official.center_lng, fixReport.lat, fixReport.lng);
  if (away > official.radius_km * 1000) {
    fixNotice.textContent = "This report is outside your area.";
    fixNotice.hidden = false;
    return;
  }
  uploadBox.hidden = false;                             // allowed!
}

// ---------- Camera ----------
async function fixStartCamera() {
  if (!window.isSecureContext || !navigator.mediaDevices) {
    fixSay("The camera needs https or localhost.", "error");
    return;
  }
  try {
    fixStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false,
    });
    fixVideo.srcObject = fixStream;
    fixVideo.hidden = false;
    fixPreview.hidden = true;
    fixStartBtn.hidden = true;
    fixCaptureBtn.hidden = false;
    fixRetakeBtn.hidden = true;
    fixSubmitBtn.hidden = true;
    fixSay("Stand at the original spot, match the angle, then tap Capture.");
  } catch (err) {
    fixSay("Could not open the camera: " + err.message, "error");
  }
}

function fixStopCamera() {
  if (fixStream) {
    fixStream.getTracks().forEach((t) => t.stop());
    fixStream = null;
  }
  fixVideo.srcObject = null;
}

async function fixCapturePhoto() {
  if (!fixStream || !fixVideo.videoWidth) {
    fixSay("Camera is not ready yet. Try again in a second.", "warn");
    return;
  }
  fixCaptureBtn.disabled = true;
  fixSay("Getting your location…");

  // Freeze the frame now
  const scale = Math.min(1, 1280 / fixVideo.videoWidth);
  fixCanvas.width = Math.round(fixVideo.videoWidth * scale);
  fixCanvas.height = Math.round(fixVideo.videoHeight * scale);
  fixCanvas.getContext("2d").drawImage(fixVideo, 0, 0, fixCanvas.width, fixCanvas.height);

  // Read GPS
  let pos;
  try {
    pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 15000, maximumAge: 0,
      }));
  } catch (err) {
    fixSay("Could not read your location. Allow location access and try again.", "error");
    fixCaptureBtn.disabled = false;
    return;
  }

  const blob = await new Promise((resolve) => fixCanvas.toBlob(resolve, "image/jpeg", 0.85));
  fixCapture = { blob, lat: pos.coords.latitude, lng: pos.coords.longitude };

  fixStopCamera();
  fixPreviewUrl = URL.createObjectURL(blob);
  fixPreview.src = fixPreviewUrl;
  fixPreview.hidden = false;
  fixVideo.hidden = true;
  fixCaptureBtn.hidden = true;
  fixCaptureBtn.disabled = false;
  fixRetakeBtn.hidden = false;
  fixSubmitBtn.hidden = false;
  fixSubmitBtn.disabled = false;

  const d = Math.round(haversineMeters(fixCapture.lat, fixCapture.lng, fixReport.lat, fixReport.lng));
  fixSay("Photo captured. You are about " + d + " m from the original spot. It must be within the allowed distance to count as solved.");
}

function fixRetake() {
  if (fixPreviewUrl) URL.revokeObjectURL(fixPreviewUrl);
  fixCapture = null;
  fixStartCamera();
}

// ---------- Submit ----------
async function fixSubmit() {
  if (!fixCapture) return;
  fixSubmitBtn.disabled = true;
  fixRetakeBtn.disabled = true;
  fixSay("Uploading…");

  const path = "after-" + fixReport.id + "-" + Date.now() + ".jpg";
  const up = await db.storage.from("report-photos").upload(path, fixCapture.blob, {
    contentType: "image/jpeg", upsert: false,
  });
  if (up.error) {
    console.error(up.error);
    fixSay("Photo upload failed: " + up.error.message, "error");
    fixSubmitBtn.disabled = false;
    fixRetakeBtn.disabled = false;
    return;
  }

  const { data, error } = await db.rpc("submit_after_photo", {
    p_report: fixReport.id, p_photo_path: path, p_lat: fixCapture.lat, p_lng: fixCapture.lng,
  });
  fixRetakeBtn.disabled = false;

  if (error) {
    console.error(error);
    fixSay("Could not save: " + error.message, "error");
    fixSubmitBtn.disabled = false;
    return;
  }

  fixCapture = null;
  fixSubmitBtn.hidden = true;
  await showAfterPhotos();

  if (data.confirmed) {
    fixSay("✅ Verified! You were " + data.distance_m + " m from the original spot. The report is now marked Solved.");
    uploadBox.hidden = true;
    setTimeout(() => window.location.reload(), 2500);   // refresh to show the Solved badge
  } else {
    fixSay("⚠️ You were " + data.distance_m + " m away, so it is NOT verified and the issue stays unsolved. Retake closer to the original spot.", "warn");
  }
}

fixStartBtn.addEventListener("click", fixStartCamera);
fixCaptureBtn.addEventListener("click", fixCapturePhoto);
fixRetakeBtn.addEventListener("click", fixRetake);
fixSubmitBtn.addEventListener("click", fixSubmit);
window.addEventListener("pagehide", fixStopCamera);