// ===== Step 14: Local officer dashboard =====
const PROGRESS_LABEL = { submitted: "New", acknowledged: "Acknowledged", in_progress: "In progress", solved: "Solved" };
const PROGRESS_CLASS = { submitted: "red", acknowledged: "amber", in_progress: "blue", solved: "green" };

let official = null;        // the logged-in official
let allReports = [];        // reports inside this official's area + categories
let labels = {};            // category code -> readable name
let currentFilter = "all";
let chartStatus = null;
let chartCat = null;

const taskList = document.getElementById("taskList");

// A solved report always counts as "solved"
function progressOf(r) {
  return r.status === "done" ? "solved" : (r.progress || "submitted");
}

// ---------- Start ----------
async function startDashboard() {
  official = await getCurrentOfficial();
  if (!official || !official.approved) { window.location.href = "official-login.html"; return; }
  if (official.role !== "local") { goToDashboard(official); return; }

  try {
    (await loadCategoryList()).forEach((c) => (labels[c.category] = c.label));
  } catch (e) { console.error(e); }

  document.getElementById("offName").textContent = "Welcome, " + official.full_name;
  document.getElementById("offLine1").textContent = "🎖️ " + official.designation + "  ·  🏛️ " + official.department;
  document.getElementById("offLine2").textContent =
    "📍 " + (official.area_name || "-") + " (" + official.radius_km + " km radius)  ·  📂 " +
    official.categories.map((c) => labels[c] || c).join(", ");

  const ok = await loadReports();
  document.getElementById("homeMsg").hidden = ok;
  if (ok) {
    document.getElementById("dash").hidden = false;
    render();
  }
}

// ---------- Load only the reports for this official ----------
async function loadReports() {
  const { data, error } = await db.from("reports")
    .select("id,title,category,lat,lng,status,progress,severity,photo_path,flag_count,created_at")
    .in("category", official.categories)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    document.getElementById("homeMsg").textContent = "Could not load your reports. Please refresh.";
    document.getElementById("homeMsg").className = "message error";
    return false;
  }
  // keep only reports inside the official's area (radius)
  allReports = data.filter((r) =>
    haversineMeters(official.center_lat, official.center_lng, r.lat, r.lng) <= official.radius_km * 1000);
  return true;
}

// ---------- Numbers, bar and charts ----------
function render() {
  const total = allReports.length;
  const count = (p) => allReports.filter((r) => progressOf(r) === p).length;
  const fresh = count("submitted"), acknowledged = count("acknowledged");
  const inProgress = count("in_progress"), solved = count("solved");

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statPending").textContent = total - solved;
  document.getElementById("statProgress").textContent = inProgress;
  document.getElementById("statSolved").textContent = solved;

  const rate = total === 0 ? 0 : Math.round((solved * 100) / total);
  document.getElementById("rate").textContent = rate + "%";
  document.getElementById("rateFill").style.width = rate + "%";

  // Most repeated problem types
  const byCat = {};
  allReports.forEach((r) => {
    const name = labels[r.category] || r.category;
    byCat[name] = (byCat[name] || 0) + 1;
  });
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  document.getElementById("topProblem").textContent = sorted.length
    ? "🔁 Most repeated: " + sorted[0][0] + " (" + sorted[0][1] + ")"
    : "No reports in your area yet";

  drawCharts([fresh, acknowledged, inProgress, solved], sorted.slice(0, 6));
  renderTasks();
}

function drawCharts(statusCounts, topCats) {
  if (typeof Chart === "undefined") return;       // chart library did not load
  if (chartStatus) chartStatus.destroy();
  if (chartCat) chartCat.destroy();

  chartStatus = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: ["New", "Acknowledged", "In progress", "Solved"],
      datasets: [{ data: statusCounts, backgroundColor: ["#d32f2f", "#f9a825", "#1565c0", "#2e7d32"] }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
  });

  chartCat = new Chart(document.getElementById("catChart"), {
    type: "bar",
    data: {
      labels: topCats.map((c) => c[0]),
      datasets: [{ label: "Reports", data: topCats.map((c) => c[1]), backgroundColor: "#1565c0" }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

// ---------- Task list ----------
function makeBtn(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "task-btn " + cls;
  b.textContent = text;
  b.addEventListener("click", () => onClick(b));
  return b;
}

function makeLink(text, href, cls, newTab) {
  const a = document.createElement("a");
  a.className = "task-btn " + cls;
  a.href = href;
  a.textContent = text;
  if (newTab) { a.target = "_blank"; a.rel = "noopener"; }
  return a;
}

async function changeProgress(r, newProgress, btn) {
  btn.disabled = true;
  const { error } = await db.rpc("set_progress", { p_report: r.id, p_progress: newProgress });
  if (error) {
    console.error(error);
    alert("Could not update: " + error.message);
    btn.disabled = false;
    return;
  }
  r.progress = newProgress;
  render();
}

function buildTask(r) {
  const prog = progressOf(r);
  const card = document.createElement("div");
  card.className = "task-card";

  const top = document.createElement("div");
  top.className = "task-top";

  const img = document.createElement("img");
  img.src = photoUrl(r.photo_path);
  img.alt = "Photo of the problem";
  img.loading = "lazy";
  if (isBlurred(r)) img.classList.add("blurred");
  top.appendChild(img);

  const body = document.createElement("div");
  body.className = "card-body";
  const title = document.createElement("strong");
  title.textContent = r.title;                        // textContent: safe for public text
  body.appendChild(title);

  const badge = document.createElement("span");
  badge.className = "badge " + PROGRESS_CLASS[prog];
  badge.textContent = PROGRESS_LABEL[prog];
  body.appendChild(badge);

  const addLine = (text) => {
    const d = document.createElement("div");
    d.textContent = text;
    body.appendChild(d);
  };
  addLine("📂 " + (labels[r.category] || r.category));
  addLine("👥 Reported by " + r.severity + (r.severity === 1 ? " person" : " people"));
  addLine(daysText(r));
  top.appendChild(body);
  card.appendChild(top);

  // Buttons
  const actions = document.createElement("div");
  actions.className = "task-actions";

  // Opens Google Maps with directions to the exact spot
  actions.appendChild(makeLink("🧭 Navigate",
    "https://www.google.com/maps/dir/?api=1&destination=" + r.lat + "," + r.lng + "&travelmode=driving",
    "primary", true));

  if (prog !== "solved") {
    if (prog === "submitted") {
      actions.appendChild(makeBtn("✔ Acknowledge", "", (b) => changeProgress(r, "acknowledged", b)));
    }
    if (prog !== "in_progress") {
      actions.appendChild(makeBtn("🔧 Start work", "", (b) => changeProgress(r, "in_progress", b)));
    }
    actions.appendChild(makeLink("📷 Upload proof", "detail.html?id=" + encodeURIComponent(r.id) + "#fix", "", false));
  }
  actions.appendChild(makeLink("👁 View", "detail.html?id=" + encodeURIComponent(r.id), "", false));
  card.appendChild(actions);
  return card;
}

function renderTasks() {
  taskList.innerHTML = "";
  let list = allReports.slice();

  if (currentFilter === "pending") list = list.filter((r) => progressOf(r) !== "solved");
  else if (currentFilter === "in_progress") list = list.filter((r) => progressOf(r) === "in_progress");
  else if (currentFilter === "solved") list = list.filter((r) => progressOf(r) === "solved");

  // Most urgent first: unsolved before solved, then most reporters, then oldest
  list.sort((a, b) => {
    const sa = progressOf(a) === "solved" ? 1 : 0;
    const sb = progressOf(b) === "solved" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (b.severity !== a.severity) return b.severity - a.severity;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.textContent = "Nothing here. 🎉";
    taskList.appendChild(empty);
    return;
  }
  list.forEach((r) => taskList.appendChild(buildTask(r)));
}

// ---------- Tabs and log out ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

document.getElementById("logoutBtn").addEventListener("click", (e) => {
  e.preventDefault();
  logout();
});

startDashboard();