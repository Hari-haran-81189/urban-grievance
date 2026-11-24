// ===== Step 3: live camera + GPS (no gallery upload on purpose) =====

// Grab the page elements we need
const video = document.getElementById("video");
const preview = document.getElementById("preview");
const canvas = document.getElementById("canvas");
const message = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const detailsBox = document.getElementById("detailsBox");
const info = document.getElementById("info");

let stream = null;            // the running camera
let previewUrl = null;        // temporary link to show the captured photo

// Step 4 will read the result from here: { blob, lat, lng, accuracy, takenAt }
window.capturedReport = null;

// Show a message to the user. type = "", "error" or "warn"
function showMessage(text, type = "") {
  message.textContent = text;
  message.className = "message " + type;
}

// ---------- CAMERA ----------
async function startCamera() {
  // Camera and GPS only work on https:// or localhost
  if (!window.isSecureContext) {
    showMessage("Camera needs a secure (https) connection.", "error");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage("This browser does not support the camera.", "error");
    return;
  }
  try {
    // "environment" = back camera on phones (laptops use their webcam)
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
    video.hidden = false;
    preview.hidden = true;
    startBtn.hidden = true;
    captureBtn.hidden = false;
    retakeBtn.hidden = true;
    info.hidden = true;
    showMessage("Point the camera at the problem, then tap Capture.");
  } catch (err) {
    if (err.name === "NotAllowedError") {
      showMessage("Camera permission was blocked. Click the 🔒 icon near the address bar, allow Camera, then try again.", "error");
    } else if (err.name === "NotFoundError") {
      showMessage("No camera found on this device.", "error");
    } else {
      showMessage("Could not open the camera: " + err.message, "error");
    }
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
}

// ---------- GPS ----------
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject({ code: 0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, // use real GPS when available
      timeout: 15000,           // wait up to 15 seconds
      maximumAge: 0,            // never reuse an old location
    });
  });
}

function gpsErrorText(err) {
  if (err.code === 1) return "Location permission was blocked. Allow Location for this site and try again. A report needs its GPS location.";
  if (err.code === 2) return "Your location is not available. Turn on Location/GPS on your device and try again.";
  if (err.code === 3) return "Getting your location took too long. Move to an open area and try again.";
  return "This browser does not support location.";
}

// ---------- CAPTURE ----------
async function capturePhoto() {
  if (!stream || !video.videoWidth) {
    showMessage("Camera is not ready yet. Wait a second and try again.", "warn");
    return;
  }
  captureBtn.disabled = true;
  showMessage("Getting your location…");

  // 1) Freeze the current camera frame right now (max width 1280 keeps the file small)
  const scale = Math.min(1, 1280 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const takenAt = new Date();

  // 2) Read the GPS location (if this fails we keep the camera open)
  let pos;
  try {
    pos = await getLocation();
  } catch (err) {
    showMessage(gpsErrorText(err), "error");
    captureBtn.disabled = false;
    return;
  }

  // 3) Turn the frozen frame into a JPEG file
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));

  // 4) Save everything for Step 4
  window.capturedReport = {
    blob: blob,
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy, // in metres
    takenAt: takenAt.toISOString(),
  };

  // 5) Show the photo and the location details
  stopCamera();
  previewUrl = URL.createObjectURL(blob);
  preview.src = previewUrl;
  preview.hidden = false;
  video.hidden = true;
  captureBtn.hidden = true;
  captureBtn.disabled = false;
  retakeBtn.hidden = false;
  detailsBox.hidden = false;

  const c = window.capturedReport;
  info.hidden = false;
  info.innerHTML =
    "<strong>📍 Location captured</strong><br>" +
    "Latitude: " + c.lat.toFixed(6) + "<br>" +
    "Longitude: " + c.lng.toFixed(6) + "<br>" +
    "Accuracy: about " + Math.round(c.accuracy) + " m<br>" +
    "Time: " + takenAt.toLocaleString();

  if (c.accuracy > 50) {
    showMessage("Photo captured, but the location is not very accurate. For a better result, go outside or near the spot and Retake.", "warn");
  } else {
    showMessage("Photo and location captured ✅");
  }
}

// ---------- RETAKE ----------
function retake() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  window.capturedReport = null;
  preview.hidden = true;
  detailsBox.hidden = true;

  // ---- NEW LINES (Step 7b) ----
  document.getElementById("nearbyBox").hidden = true;   // close the "same issue?" panel
  const sb = document.getElementById("submitBtn");      // find the Submit button
  sb.disabled = false;                                  // switch it back on
  sb.textContent = "Submit report";                     // reset its text
  // -----------------------------
  
  startCamera();
}

// ---------- Connect buttons ----------
startBtn.addEventListener("click", startCamera);
captureBtn.addEventListener("click", capturePhoto);
retakeBtn.addEventListener("click", retake);
// Turn the camera off if the user leaves the page
window.addEventListener("pagehide", stopCamera);