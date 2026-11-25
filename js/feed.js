// ===== Step 6: feed with filters =====
const PAGE_SIZE = 20;      // reports loaded per click
let page = 0;              // which batch we are on
let labels = {};           // category code -> readable label

const listBox = document.getElementById("list");
const moreBtn = document.getElementById("moreBtn");
const feedMessage = document.getElementById("feedMessage");
const fCategory = document.getElementById("fCategory");
const fStatus = document.getElementById("fStatus");
const fSort = document.getElementById("fSort");

function setMessage(text, type = "") {
  feedMessage.textContent = text;
  feedMessage.className = "message " + type;
}

// A small 👍 / 👎 button
function makeVoteButton(icon, count) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mini-vote";
  b.textContent = icon + " " + count;
  return b;
}

// Row under each card: 👍 👎 and the "Show on map" link
function buildActions(r, startVote) {
  let myVote = startVote;                       // 1, -1 or 0
  const likeBtn = makeVoteButton("👍", r.likes);
  const dislikeBtn = makeVoteButton("👎", r.dislikes);

  const highlight = () => {
    likeBtn.classList.toggle("active", myVote === 1);
    dislikeBtn.classList.toggle("active", myVote === -1);
  };
  highlight();

  async function vote(wanted) {
    const newVote = myVote === wanted ? 0 : wanted;   // same button again = remove vote
    likeBtn.disabled = dislikeBtn.disabled = true;
    const { data, error } = await db.rpc("cast_vote", {
      p_report: r.id, p_device: getDeviceId(), p_vote: newVote,
    });
    likeBtn.disabled = dislikeBtn.disabled = false;
    if (error) {
      console.error(error);
      setMessage("Could not save your vote. Please try again.", "error");
      return;
    }
    setMessage("");
    myVote = newVote;
    likeBtn.textContent = "👍 " + data.likes;
    dislikeBtn.textContent = "👎 " + data.dislikes;
    highlight();
  }
  likeBtn.addEventListener("click", () => vote(1));
  dislikeBtn.addEventListener("click", () => vote(-1));

  const row = document.createElement("div");
  row.className = "card-actions";
  row.appendChild(likeBtn);
  row.appendChild(dislikeBtn);

  const mapLink = document.createElement("a");
  mapLink.className = "maplink";
  mapLink.href = "map.html?id=" + encodeURIComponent(r.id);
  mapLink.textContent = "📍 Show on map";
  row.appendChild(mapLink);

  return row;
}

// Build one report card (textContent is used because titles are typed by the public)
function buildCard(r, myVote) {
  const card = document.createElement("div");
  card.className = "card";

  const main = document.createElement("a");
  main.className = "card-main";
  main.href = "detail.html?id=" + encodeURIComponent(r.id);

  const img = document.createElement("img");
  img.src = photoUrl(r.photo_path);
  img.alt = "Photo of the problem";
  img.loading = "lazy";
  if (isBlurred(r)) img.classList.add("blurred");
  main.appendChild(img);

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("strong");
  title.textContent = r.title;
  body.appendChild(title);

  const badge = document.createElement("span");
    const pp = publicProgress(r);
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
  if (isBlurred(r)) addLine("⚠️ Photo flagged by " + r.flag_count + " people");

  main.appendChild(body);
  card.appendChild(main);
  card.appendChild(buildActions(r, myVote));   // NEW: votes + map link
  return card;
}

// Ask the database which of these reports this device has voted on
async function fetchMyVotes(ids) {
  const result = {};
  if (ids.length === 0) return result;
  const { data, error } = await db.rpc("get_my_votes", { p_device: getDeviceId(), p_reports: ids });
  if (error) { console.error(error); return result; }   // cards still show, just without highlights
  data.forEach((row) => (result[row.report_id] = row.vote));
  return result;
}

// Load one batch of reports using the current filters
async function loadReports(reset) {
  if (reset) {
    page = 0;
    listBox.innerHTML = "";
    moreBtn.hidden = true;
  }
  setMessage("Loading…");
  moreBtn.disabled = true;

  const category = fCategory.value;
  const status = fStatus.value;
  const sort = fSort.value;

  let q = db.from("reports")
    .select("id,title,category,status,severity,likes,dislikes,flag_count,progress,photo_path,created_at");

  if (category) q = q.eq("category", category);
  if (status) q = q.eq("status", status);

  if (sort === "severity") {
    q = q.order("severity", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "likes") {
    q = q.order("likes", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "oldest") {
    if (!status) q = q.eq("status", "unsolved");   // "longest unresolved" only makes sense for unsolved
    q = q.order("created_at", { ascending: true });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  const from = page * PAGE_SIZE;
  q = q.range(from, from + PAGE_SIZE - 1);

  const { data, error } = await q;
  moreBtn.disabled = false;

  if (error) {
    console.error(error);
    setMessage("Could not load reports. Check your internet and try again.", "error");
    return;
  }

    const myVotes = await fetchMyVotes(data.map((r) => r.id));
  data.forEach((r) => listBox.appendChild(buildCard(r, myVotes[r.id] || 0)));

  if (reset && data.length === 0) {
    setMessage("No reports match these filters.");
  } else {
    setMessage("");
  }
  moreBtn.hidden = data.length < PAGE_SIZE;   // show "Load more" only if a full batch came back
}

// Start: load categories, fill the dropdown, then load reports
async function startFeed() {
  try {
    const cats = await loadCategoryList();
    cats.forEach((c) => {
      labels[c.category] = c.label;
      const opt = document.createElement("option");
      opt.value = c.category;
      opt.textContent = c.label;
      fCategory.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
  loadReports(true);
}

fCategory.addEventListener("change", () => loadReports(true));
fStatus.addEventListener("change", () => loadReports(true));
fSort.addEventListener("change", () => loadReports(true));
moreBtn.addEventListener("click", () => { page++; loadReports(false); });

startFeed();