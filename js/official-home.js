// ===== Placeholder home for officials (real dashboards come in Steps 14-15) =====
const homeMsg = document.getElementById("homeMsg");

async function startOfficialHome() {
  const expectedRole = document.body.dataset.role;     // "local" or "higher"

  const official = await getCurrentOfficial();
  if (!official || !official.approved) {               // not logged in -> login page
    window.location.href = "official-login.html";
    return;
  }
  if (official.role !== expectedRole) {                // wrong dashboard -> the right one
    goToDashboard(official);
    return;
  }

  // Readable category names
  const labels = {};
  try {
    (await loadCategoryList()).forEach((c) => (labels[c.category] = c.label));
  } catch (e) { console.error(e); }

  document.getElementById("offName").textContent = official.full_name;
  document.getElementById("offTitle").textContent = "🎖️ " + official.designation;
  document.getElementById("offDept").textContent = "🏛️ " + official.department;
  document.getElementById("offArea").textContent =
    "📍 " + (official.area_name || "-") + " (radius " + official.radius_km + " km)";
  document.getElementById("offCats").textContent =
    "📂 Handles: " + official.categories.map((c) => labels[c] || c).join(", ");

  homeMsg.hidden = true;
  document.getElementById("profileBox").hidden = false;
}

document.getElementById("logoutBtn").addEventListener("click", (e) => {
  e.preventDefault();
  logout();
});

startOfficialHome();