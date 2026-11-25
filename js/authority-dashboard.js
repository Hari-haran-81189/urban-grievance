// ===== Step 15: Higher authority dashboard =====
const PROGRESS_LABEL = { submitted: "New", acknowledged: "Acknowledged", in_progress: "In progress", solved: "Solved" };
const PROGRESS_CLASS = { submitted: "red", acknowledged: "amber", in_progress: "blue", solved: "green" };

let official = null;
let allReports = [];       // reports in this authority's categories + radius
let team = [];             // local officers under this authority (from the database function)
let labels = {};
let chartStatus = null;
let chartCat = null;
let hotMapObj = null;

function progressOf(r) {
  return r.status === "done" ? "solved" : (r.progress || "submitted");
}

// ---------- Start ----------
async function startDashboard() {
  official = await getCurrentOfficial();
  if (!official || !official.approved) { window.location.href = "official-login.html"; return; }
  if (official.role !== "higher") { goToDashboard(official); return; }

  try {
    (await loadCategoryList()).forEach((c) => (labels[c.category] = c.label));
  } catch (e) { console.error(e); }

  document.getElementById("offName").textContent = "Welcome, " + official.full_name;
  document.getElementById("offLine1").textContent = "🎖️ " + official.designation + "  ·  🏛️ " + official.department;
  document.getElementById("offLine2").textContent =
    "📍 " + (official.area_name || "-") + " (" + official.radius_km + " km)  ·  📂 " +
    official.categories.map((c) => labels[c] || c).join(", ");

  const ok = await loadReports();
  await loadTeam();
  document.getElementById("homeMsg").hidden = ok;
  if (ok) {
    document.getElementById("dash").hidden = false;   // show first, so the map can measure its size
    render();
    drawHotMap();
  }
}

async function loadReports() {
  const { data, error } = await db.from("reports")
    .select("id,title,category,lat,lng,status,progress,severity,photo_path,flag_count,created_at")
    .in("category", official.categories)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error(error);
    document.getElementById("homeMsg").textContent = "Could not load reports. Please refresh.";
    document.getElementById("homeMsg").className = "message error";
    return false;
  }
  allReports = data.filter((r) =>
    haversineMeters(official.center_lat, official.center_lng, r.lat, r.lng) <= official.radius_km * 1000);
  return true;
}

async function loadTeam() {
  const { data, error } = await db.rpc("get_team_overview");
  if (error) { console.error(error); team = []; return; }
  team = data;
}

// ---------- Numbers and charts ----------
function render() {
  const total = allReports.length;
  const count = (p) => allReports.filter((r) => progressOf(r) === p).length;
  const solved = count("solved");
  const overdue = allReports.filter((r) => progressOf(r) !== "solved" && daysSince(r.created_at) >= 7).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statPending").textContent = total - solved;
  document.getElementById("statOverdue").textContent = overdue;
  document.getElementById("statSolved").textContent = solved;

  const rate = total === 0 ? 0 : Math.round((solved * 100) / total);
  document.getElementById("rate").textContent = rate + "%";
  document.getElementById("rateFill").style.width = rate + "%";

  const byCat = {};
  allReports.forEach((r) => {
    const name = labels[r.category] || r.category;
    byCat[name] = (byCat[name] || 0) + 1;
  });
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  document.getElementById("topProblem").textContent = sorted.length
    ? "🔁 Most repeated: " + sorted[0][0] + " (" + sorted[0][1] + ")"
    : "No reports yet";

  drawCharts([count("submitted"), count("acknowledged"), count("in_progress"), solved], sorted.slice(0, 6));
  renderTeam();
  renderOldest();
}

function drawCharts(statusCounts, topCats) {
  if (typeof Chart === "undefined") return;
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

// ---------- Most problematic areas ----------
function addCell(tr, text) {
  const td = document.createElement("td");
  td.textContent = text;
  tr.appendChild(td);
  return td;
}

function renderTeam() {
  const body = document.getElementById("teamBody");
  body.innerHTML = "";
  if (team.length === 0) {
    const tr = document.createElement("tr");
    const td = addCell(tr, "No local officers found under you yet.");
    td.colSpan = 7;
    body.appendChild(tr);
    return;
  }
  team.forEach((t, i) => {
    const tr = document.createElement("tr");
    if (i === 0 && t.pending > 0) tr.className = "hot-row";
    addCell(tr, (i === 0 && t.pending > 0 ? "🔥 " : "") + (i + 1));
    addCell(tr, t.area_name || "-");
    addCell(tr, t.full_name + " (" + t.designation + ")");
    addCell(tr, t.total);
    addCell(tr, t.pending);

    const rate = t.total === 0 ? 0 : Math.round((t.solved * 100) / t.total);
    const rateCell = addCell(tr, rate + "% (" + t.solved + ")");
    const bar = document.createElement("div");
    bar.className = "mini-bar";
    const fill = document.createElement("div");
    fill.style.width = rate + "%";
    bar.appendChild(fill);
    rateCell.appendChild(bar);

    addCell(tr, t.pending > 0 ? t.oldest_pending_days + " days" : "-");
    body.appendChild(tr);
  });
}

// ---------- Hotspot map ----------
function popupBox(title, lines, href) {
  const box = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title;                 // textContent: safe for public text
  box.appendChild(strong);
  lines.forEach((l) => {
    const d = document.createElement("div");
    d.textContent = l;
    box.appendChild(d);
  });
  if (href) {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = "View details →";
    box.appendChild(a);
  }
  return box;
}

function drawHotMap() {
  hotMapObj = L.map("hotMap").setView([official.center_lat, official.center_lng], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(hotMapObj);

  const shapes = [];
  // Officer zones as coloured circles
  team.forEach((t) => {
    const color = t.pending >= 5 ? "#d32f2f" : t.pending >= 2 ? "#f9a825" : "#2e7d32";
    const circle = L.circle([t.center_lat, t.center_lng], {
      radius: t.radius_km * 1000, color: color, weight: 2, fillColor: color, fillOpacity: 0.15,
    }).addTo(hotMapObj);
    circle.bindPopup(popupBox(t.area_name || "Zone",
      [t.full_name, "Pending: " + t.pending + " · Solved: " + t.solved]));
    shapes.push(circle);
  });
  // Reports as dots
  allReports.forEach((r) => {
    const dot = L.circleMarker([r.lat, r.lng], {
      radius: 6 + Math.min(r.severity - 1, 5), color: "#ffffff", weight: 1.5,
      fillColor: r.status === "done" ? "#2e7d32" : "#d32f2f", fillOpacity: 0.9,
    }).addTo(hotMapObj);
    dot.bindPopup(popupBox(r.title,
      [labels[r.category] || r.category, "Reported by " + r.severity, daysText(r)],
      "detail.html?id=" + encodeURIComponent(r.id)));
    shapes.push(dot);
  });

  if (shapes.length > 0) {
    hotMapObj.fitBounds(L.featureGroup(shapes).getBounds().pad(0.1));
  }
  setTimeout(() => hotMapObj.invalidateSize(), 200);
}

// ---------- Oldest unresolved ----------
function renderOldest() {
  const box = document.getElementById("oldList");
  box.innerHTML = "";
  const list = allReports
    .filter((r) => progressOf(r) !== "solved")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(0, 5);

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "placeholder";
    empty.textContent = "No unresolved reports. 🎉";
    box.appendChild(empty);
    return;
  }

  list.forEach((r) => {
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
    title.textContent = r.title;
    body.appendChild(title);
    const badge = document.createElement("span");
    badge.className = "badge " + PROGRESS_CLASS[prog];
    badge.textContent = PROGRESS_LABEL[prog];
    body.appendChild(badge);
    [ "📂 " + (labels[r.category] || r.category),
      "👥 Reported by " + r.severity + (r.severity === 1 ? " person" : " people"),
      daysText(r) ].forEach((t) => {
      const d = document.createElement("div");
      d.textContent = t;
      body.appendChild(d);
    });
    top.appendChild(body);
    card.appendChild(top);

    const actions = document.createElement("div");
    actions.className = "task-actions";
    const nav = document.createElement("a");
    nav.className = "task-btn primary";
    nav.href = "https://www.google.com/maps/dir/?api=1&destination=" + r.lat + "," + r.lng + "&travelmode=driving";
    nav.target = "_blank";
    nav.rel = "noopener";
    nav.textContent = "🧭 Navigate";
    actions.appendChild(nav);
    const view = document.createElement("a");
    view.className = "task-btn";
    view.href = "detail.html?id=" + encodeURIComponent(r.id);
    view.textContent = "👁 View";
    actions.appendChild(view);
    card.appendChild(actions);

    box.appendChild(card);
  });
}

document.getElementById("logoutBtn").addEventListener("click", (e) => {
  e.preventDefault();
  logout();
});

startDashboard();