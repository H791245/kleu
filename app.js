const DAYS = ["M","T","W","T","F","S","S"];

function getCycles() { return JSON.parse(localStorage.getItem("cycles") || "[]"); }
function saveCycles(c) { localStorage.setItem("cycles", JSON.stringify(c)); }

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function daysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

function formatDate(ds) {
  const d = new Date(ds + "T00:00:00");
  return d.toLocaleDateString("en-NL", { day: "numeric", month: "short" });
}

function toKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

function buildDayMap() {
  const cycles = getCycles();
  const map = {};

  cycles.forEach(c => {
    let cur = c.start;
    while (cur <= c.end) {
      map[cur] = { type: "period", flow: c.flow || "medium" };
      cur = addDays(cur, 1);
    }
  });

  if (cycles.length >= 2) {
    const lengths = [];
    for (let i = 1; i < cycles.length; i++) {
      lengths.push(daysBetween(cycles[i-1].start, cycles[i].start));
    }
    const avg = Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length);
    const lastStart = cycles[cycles.length-1].start;

    for (let p = 1; p <= 3; p++) {
      const nextStart = addDays(lastStart, avg * p);
      const nextEnd = addDays(nextStart, 4);
      let cur = nextStart;
      while (cur <= nextEnd) {
        if (!map[cur]) map[cur] = { type: "predicted" };
        cur = addDays(cur, 1);
      }
      const ovDay = addDays(nextStart, -14);
      if (!map[ovDay]) map[ovDay] = { type: "ovulation" };
      for (let f = -5; f < 0; f++) {
        const fd = addDays(ovDay, f);
        if (!map[fd]) map[fd] = { type: "fertile" };
      }
    }
  }

  return map;
}

function renderCalendar() {
  const container = document.getElementById("calendar-container");
  container.innerHTML = "";
  const map = buildDayMap();
  const today = new Date();
  const todayKey = today.toISOString().split("T")[0];

  for (let mo = 0; mo < 2; mo++) {
    const d = new Date(today.getFullYear(), today.getMonth() + mo, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const monthName = d.toLocaleDateString("en-NL", { month: "long", year: "numeric" });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = (new Date(year, month, 1).getDay() + 6) % 7;

    const block = document.createElement("div");
    block.className = "month-block";

    const header = document.createElement("div");
    header.className = "month-header";
    header.textContent = monthName;
    block.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "cal-grid";

    DAYS.forEach(dw => {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = dw;
      grid.appendChild(el);
    });

    for (let i = 0; i < startDow; i++) {
      const empty = document.createElement("div");
      empty.className = "cal-day empty";
      grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const key = toKey(year, month, day);
      const el = document.createElement("div");
      el.className = "cal-day";
      el.textContent = day;

      if (key === todayKey) el.classList.add("today");

      const info = map[key];
      if (info) {
        if (info.type === "period") el.classList.add(`period-${info.flow}`);
        else if (info.type === "predicted") el.classList.add("period-predicted");
        else if (info.type === "ovulation") el.classList.add("ovulation");
        else if (info.type === "fertile") el.classList.add("fertile");
      }

      grid.appendChild(el);
    }

    block.appendChild(grid);
    container.appendChild(block);
  }
}

function renderHistory() {
  const cycles = getCycles();
  const list = document.getElementById("cycle-list");
  list.innerHTML = "";
  if (!cycles.length) {
    list.innerHTML = "<li style='color:#bbb;font-size:0.85rem'>No cycles logged yet.</li>";
    return;
  }
  cycles.slice().reverse().forEach((c, ri) => {
    const li = document.createElement("li");
    const dur = daysBetween(c.start, c.end) + 1;
    li.innerHTML = `<span>🩸 ${formatDate(c.start)} → ${formatDate(c.end)} <small style="color:#aaa">(${dur}d · ${c.flow||"medium"})</small></span>`;
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "✕";
    del.onclick = () => {
      const all = getCycles();
      all.splice(all.length - 1 - ri, 1);
      saveCycles(all);
      renderAll();
    };
    li.appendChild(del);
    list.appendChild(li);
  });
}

function renderAnalysis() {
  const cycles = getCycles();
  const at = document.getElementById("analysis-text");
  const ft = document.getElementById("fertile-text");
  const ot = document.getElementById("ovulation-text");
  const pt = document.getElementById("prediction-text");

  if (cycles.length < 2) {
    at.innerHTML = "Log at least 2 cycles to see analysis.";
    ft.textContent = "—"; ot.textContent = "—"; pt.textContent = "Log at least 2 cycles.";
    return;
  }

  const lengths = [];
  for (let i = 1; i < cycles.length; i++) lengths.push(daysBetween(cycles[i-1].start, cycles[i].start));
  const avg = Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length);
  const lastStart = cycles[cycles.length-1].start;
  const nextStart = addDays(lastStart, avg);
  const ovDay = addDays(nextStart, -14);
  const fertileStart = addDays(ovDay, -5);

  at.innerHTML = `Average cycle: <strong>${avg} days</strong><br/>Based on ${cycles.length} logged cycles.`;
  ft.innerHTML = `<strong>${formatDate(fertileStart)} – ${formatDate(ovDay)}</strong>`;
  ot.innerHTML = `Around <strong>${formatDate(ovDay)}</strong>`;
  pt.innerHTML = `Next period around <strong>${formatDate(nextStart)}</strong> – <strong>${formatDate(addDays(nextStart, 4))}</strong>`;
}

function renderAll() {
  renderCalendar();
  renderHistory();
  renderAnalysis();
}

function switchView(viewName) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelector(`[data-view="${viewName}"]`).classList.add("active");
  document.getElementById(`view-${viewName}`).classList.add("active");
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

let selectedFlow = "medium";
document.querySelectorAll(".flow-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".flow-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedFlow = btn.dataset.flow;
  });
});
document.querySelector('.flow-btn[data-flow="medium"]').classList.add("selected");

document.getElementById("save-btn").addEventListener("click", () => {
  const start = document.getElementById("start-date").value;
  const end = document.getElementById("end-date").value;
  if (!start || !end) { alert("Fill in both dates."); return; }
  if (end < start) { alert("End can't be before start."); return; }
  const cycles = getCycles();
  cycles.push({ start, end, flow: selectedFlow });
  cycles.sort((a,b) => a.start.localeCompare(b.start));
  saveCycles(cycles);
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
  renderAll();
  switchView("calendar");
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  navigator.serviceWorker.register("sw.js");
}

renderAll();
