// ===== Official login page =====
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const loginBtn = document.getElementById("loginBtn");

function setMsg(text, type = "") {
  loginMsg.textContent = text;
  loginMsg.className = "message " + type;
}

// Already logged in? Go straight to the dashboard.
(async function checkExisting() {
  const official = await getCurrentOfficial();
  if (official && official.approved) goToDashboard(official);
})();

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();                       // stop the page from reloading
  loginBtn.disabled = true;
  setMsg("Signing in…");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    setMsg("Wrong email or password.", "error");
    loginBtn.disabled = false;
    return;
  }

  // Logged in, but is this person an activated official?
  const official = await getCurrentOfficial();
  if (!official) {
    await db.auth.signOut();
    setMsg("This account is not an official account.", "error");
    loginBtn.disabled = false;
  } else if (!official.approved) {
    await db.auth.signOut();
    setMsg("Your account is not activated yet. Please contact the administrator.", "error");
    loginBtn.disabled = false;
  } else {
    goToDashboard(official);
  }
});