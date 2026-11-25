// ===== Step 7a: details page + votes =====

const loadMsg = document.getElementById("loadMsg");
const reportBox = document.getElementById("report");
const likeBtn = document.getElementById("likeBtn");
const dislikeBtn = document.getElementById("dislikeBtn");
const voteMsg = document.getElementById("voteMsg");

let reportId = null;
let myVote = 0;        // 1 = I liked, -1 = I disliked, 0 = no vote
let flagCount = 0;      // how many different people reported the photo
let revealed = false;   // did the visitor choose to show a blurred photo?

// ---------- Read the id from the address (detail.html?id=...) ----------
function getIdFromUrl() {
  const id = new URLSearchParams(window.location.search).get("id");
  // must look like a uuid, otherwise ignore it
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || "");
  return ok ? id : null;
}

// ---------- Fill the page ----------
async function loadReport() {
  reportId = getIdFromUrl();
  if (!reportId) {
    loadMsg.textContent = "This report link is not valid.";
    loadMsg.className = "message error";
    return;
  }

  const { data: r, error } = await db.from("reports")
    .select("id,title,category,description,lat,lng,photo_path,status,severity,likes,dislikes,flag_count,progress,created_at")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    console.error(error);
    loadMsg.textContent = "Could not load this report. Please try again.";
    loadMsg.className = "message error";
    return;
  }
  if (!r) {
    loadMsg.textContent = "Report not found.";
    loadMsg.className = "message error";
    return;
  }

  // Category label
  let categoryLabel = r.category;
  try {
    const cats = await loadCategoryList();
    const found = cats.find((c) => c.category === r.category);
    if (found) categoryLabel = found.label;
  } catch (e) { console.error(e); }

  // textContent is used everywhere because the text is typed by the public
  document.title = r.title + " – Urban Grievance";
  document.getElementById("photo").src = photoUrl(r.photo_path);
  flagCount = r.flag_count;
  applyBlur();
  document.getElementById("title").textContent = r.title;

  const badge = document.getElementById("badge");
  const pp = publicProgress(r);
  badge.textContent = pp.label;
  badge.className = "badge " + pp.cls;

  document.getElementById("category").textContent = "📂 " + categoryLabel;
  document.getElementById("reporters").textContent =
    "👥 Reported by " + r.severity + (r.severity === 1 ? " person" : " people");
  document.getElementById("days").textContent = daysText(r);
  document.getElementById("date").textContent =
    "📅 " + new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  document.getElementById("description").textContent = r.description;
  document.getElementById("likeCount").textContent = r.likes;
  document.getElementById("dislikeCount").textContent = r.dislikes;
  document.getElementById("mapLink").href = "map.html?id=" + encodeURIComponent(r.id);

  loadMsg.hidden = true;
  reportBox.hidden = false;

  drawMiniMap(r);
  loadMyVote();
  loadMyFlag();
  initFixProof(r);
}

// ---------- Small map ----------
function drawMiniMap(r) {
  const mini = L.map("miniMap", { scrollWheelZoom: false }).setView([r.lat, r.lng], 16);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(mini);
  L.circleMarker([r.lat, r.lng], {
    radius: 10, color: "#ffffff", weight: 2,
    fillColor: r.status === "done" ? "#2e7d32" : "#d32f2f", fillOpacity: 0.9,
  }).addTo(mini);
}

// ---------- Votes ----------
function showMyVote() {
  likeBtn.classList.toggle("active", myVote === 1);
  dislikeBtn.classList.toggle("active", myVote === -1);
}

async function loadMyVote() {
  const { data, error } = await db.rpc("get_my_vote", { p_report: reportId, p_device: getDeviceId() });
  if (!error) {
    myVote = data || 0;
    showMyVote();
  }
}

async function vote(wanted) {
  // clicking the same button again removes the vote
  const newVote = myVote === wanted ? 0 : wanted;
  likeBtn.disabled = dislikeBtn.disabled = true;
  voteMsg.textContent = "";

  const { data, error } = await db.rpc("cast_vote", {
    p_report: reportId, p_device: getDeviceId(), p_vote: newVote,
  });

  likeBtn.disabled = dislikeBtn.disabled = false;
  if (error) {
    console.error(error);
    voteMsg.textContent = "Could not save your vote. Please try again.";
    voteMsg.className = "message error";
    return;
  }
  myVote = newVote;
  document.getElementById("likeCount").textContent = data.likes;
  document.getElementById("dislikeCount").textContent = data.dislikes;
  showMyVote();
}

likeBtn.addEventListener("click", () => vote(1));
dislikeBtn.addEventListener("click", () => vote(-1));

// ---------- Photo flagging ----------
const flagBtn = document.getElementById("flagBtn");
const flagMsg = document.getElementById("flagMsg");
const revealBtn = document.getElementById("revealBtn");

// Blur the photo when enough people flagged it, and show the notice
function applyBlur() {
  const photo = document.getElementById("photo");
  const notice = document.getElementById("flagNotice");
  const blurred = flagCount >= BLUR_AT;

  photo.classList.toggle("blurred", blurred && !revealed);
  revealBtn.hidden = !blurred;
  revealBtn.textContent = revealed ? "🙈 Hide photo again" : "👁 Show original photo";

  notice.hidden = flagCount === 0;
  notice.textContent = "⚠️ This photo was reported by " + flagCount +
    (flagCount === 1 ? " person" : " people") +
    (blurred ? " and is blurred for safety. Nothing is deleted." : ".");
}

revealBtn.addEventListener("click", () => {
  revealed = !revealed;
  applyBlur();
});

// Did this device already flag the photo?
async function loadMyFlag() {
  const { data, error } = await db.rpc("get_my_flag", { p_report: reportId, p_device: getDeviceId() });
  if (!error && data === true) {
    flagBtn.disabled = true;
    flagBtn.textContent = "🚩 You reported this photo";
  }
}

async function flagPhoto() {
  if (!confirm("Report this photo? Use this for visible faces, number plates or inappropriate content.")) return;

  flagBtn.disabled = true;
  flagMsg.textContent = "";
  const { data, error } = await db.rpc("flag_photo", { p_report: reportId, p_device: getDeviceId() });

  if (error) {
    console.error(error);
    if (error.message.includes("your own photo")) {
      flagMsg.textContent = "You cannot report your own photo.";
    } else {
      flagMsg.textContent = "Could not send your report. Please try again.";
      flagBtn.disabled = false;
    }
    flagMsg.className = "message error";
    return;
  }

  flagCount = data.flag_count;
  applyBlur();
  flagBtn.textContent = "🚩 You reported this photo";
  flagMsg.className = "message";
  flagMsg.textContent = "Thank you. Your report was recorded.";
}

flagBtn.addEventListener("click", flagPhoto);

loadReport();