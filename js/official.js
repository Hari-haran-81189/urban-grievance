// ===== Shared helpers for official (government) pages =====

// Who is logged in? Returns their officers row, or null (not logged in / not an official)
async function getCurrentOfficial() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const { data, error } = await db.from("officers")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}

// Send each role to its own dashboard
function goToDashboard(official) {
  window.location.href = official.role === "higher" ? "authority.html" : "officer.html";
}

async function logout() {
  await db.auth.signOut();
  window.location.href = "official-login.html";
}