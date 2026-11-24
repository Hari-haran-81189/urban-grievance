// ===== Step 5: public map =====

// 1) Create the map, centred on Tamil Nadu
const map = L.map("map").setView([11.13, 78.66], 7);

// OpenStreetMap tiles (the credit line is required by their rules)
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const countBox = document.getElementById("count");

// How many days since the report was made
function daysSince(dateText) {
  return Math.floor((Date.now() - new Date(dateText).getTime()) / 86400000);
}

// Build the small window shown when a pin is tapped.
// We use textContent (not innerHTML) because titles are typed by the public.
function buildPopup(r, categoryLabel) {
  const box = document.createElement("div");
  box.className = "popup";

  const photoUrl = db.storage.from("report-photos").getPublicUrl(r.photo_path).data.publicUrl;
  const img = document.createElement("img");
  img.src = photoUrl;
  img.alt = "Photo of the problem";
  if (isBlurred(r)) img.classList.add("blurred");
  box.appendChild(img);

  const title = document.createElement("strong");
  title.textContent = r.title;
  box.appendChild(title);

  const line = (text) => {
    const p = document.createElement("div");
    p.textContent = text;
    box.appendChild(p);
  };

  line("📂 " + categoryLabel);
  line("👥 Reported by " + r.severity + (r.severity === 1 ? " person" : " people"));

  if (r.status === "done") {
    line("✅ Solved");
  } else {
    const d = daysSince(r.created_at);
    line("⏳ " + (d === 0 ? "Reported today" : d + (d === 1 ? " day" : " days") + " unresolved"));
  }

  // The details page is built in Step 7 (this link will not work until then)
  const link = document.createElement("a");
  link.href = "detail.html?id=" + encodeURIComponent(r.id);
  link.textContent = "View details →";
  box.appendChild(link);

  return box;
}

// 2) Load reports and draw the pins
async function loadMap() {
  const [repRes, catRes] = await Promise.all([
    db.from("reports").select("id,title,category,lat,lng,status,severity,photo_path,flag_count,created_at"),
    db.from("departments").select("category,label"),
  ]);

  if (repRes.error || catRes.error) {
    console.error(repRes.error || catRes.error);
    countBox.textContent = "Could not load reports.";
    return;
  }

  // category code -> readable label (e.g. water -> Water & waterbodies)
  const labels = {};
  catRes.data.forEach((c) => (labels[c.category] = c.label));

  const markerById = {};   // remember each pin by its report id
  const markers = [];
  repRes.data.forEach((r) => {
    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 8 + Math.min(r.severity - 1, 6) * 2,         // bigger = more people reported
      color: "#ffffff",
      weight: 2,
      fillColor: r.status === "done" ? "#2e7d32" : "#d32f2f", // green = solved, red = unsolved
      fillOpacity: 0.9,
    }).addTo(map);
    marker.bindPopup(buildPopup(r, labels[r.category] || r.category), { minWidth: 200 });
    markers.push(marker);
    markerById[r.id] = marker;
  });

  countBox.textContent = repRes.data.length + (repRes.data.length === 1 ? " report" : " reports");

    // If the page was opened from the feed (map.html?id=...), zoom to that report
  const wantedId = new URLSearchParams(window.location.search).get("id");

  if (wantedId && markerById[wantedId]) {
    const m = markerById[wantedId];
    map.setView(m.getLatLng(), 17);   // zoom close
    m.bringToFront();                 // show it above overlapping pins
    m.openPopup();                    // open its photo window
  } else if (markers.length > 0) {
    // Otherwise zoom to fit all pins
    map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3), { maxZoom: 15 });
  } else {
    countBox.textContent = "No reports yet";
  }
}

loadMap();