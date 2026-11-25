// ===== Step 16: landing page (counters + latest reports) =====

// Count a number up from 0 (small animation)
function animateNumber(el, target) {
  const duration = 900, start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    el.textContent = Math.round(target * p);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Live numbers from the database
async function loadCounters() {
  const { data, error } = await db.from("reports").select("status,severity").limit(5000);
  if (error) { console.error(error); return; }

  const total = data.length;
  const solved = data.filter((r) => r.status === "done").length;
  const citizens = data.reduce((sum, r) => sum + (r.severity || 1), 0);   // every reporter/supporter counts

  animateNumber(document.getElementById("cTotal"), total);
  animateNumber(document.getElementById("cSolved"), solved);
  animateNumber(document.getElementById("cPending"), total - solved);
  animateNumber(document.getElementById("cCitizens"), citizens);
}

// One card in the "Latest reports" strip (textContent is used for public text)
function buildRecentCard(r, labels) {
  const card = document.createElement("a");
  card.className = "recent-card";
  card.href = "detail.html?id=" + encodeURIComponent(r.id);

  const img = document.createElement("img");
  img.src = photoUrl(r.photo_path);
  img.alt = "Photo of the problem";
  img.loading = "lazy";
  if (isBlurred(r)) img.classList.add("blurred");
  card.appendChild(img);

  const body = document.createElement("div");
  body.className = "recent-body";

  const title = document.createElement("strong");
  title.textContent = r.title;
  body.appendChild(title);

  const pp = publicProgress(r);
  const badge = document.createElement("span");
  badge.className = "badge " + pp.cls;
  badge.textContent = pp.label;
  body.appendChild(badge);

  const addLine = (text) => {
    const d = document.createElement("div");
    d.textContent = text;
    body.appendChild(d);
  };
  addLine("📂 " + (labels[r.category] || r.category));
  addLine("👥 Reported by " + r.severity + (r.severity === 1 ? " person" : " people"));
  addLine(daysText(r));

  card.appendChild(body);
  return card;
}

async function loadRecent() {
  const grid = document.getElementById("recentGrid");
  const labels = {};
  try {
    (await loadCategoryList()).forEach((c) => (labels[c.category] = c.label));
  } catch (e) { console.error(e); }

  const { data, error } = await db.from("reports")
    .select("id,title,category,status,progress,severity,photo_path,flag_count,created_at")
    .order("created_at", { ascending: false })
    .limit(6);

  grid.innerHTML = "";
  if (error || !data) {
    grid.textContent = "Could not load reports right now.";
    return;
  }
  if (data.length === 0) {
    grid.textContent = "No reports yet. Be the first to report an issue!";
    return;
  }
  data.forEach((r) => grid.appendChild(buildRecentCard(r, labels)));
}

loadCounters();
loadRecent();