const API = "/api";
const STATUSES = ["Submitted", "Under Review", "Changes Required", "Approved", "Rejected"];
let applications = [];
let alerts = [];
let currentView = "dashboard";
let toastTimer;

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const statusClass = (status) => "status-" + String(status || "").toLowerCase().replace(/\s+/g, "-");
const statusBadge = (status) => `<span class="status-badge ${statusClass(status)}">${esc(status)}</span>`;
const dateLabel = (date) => {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? esc(date) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const daysUntil = (date) => {
  if (!date) return Infinity;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(`${date}T00:00:00`) - today) / 86400000);
};
const institutionIcon = (name) => esc((name || "I").split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase());

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`);
  return payload;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setView(view) {
  currentView = view;
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active-page"));
  $(`${view}Page`).classList.add("active-page");
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("breadcrumbTitle").textContent = ({dashboard:"Overview", applications:"Applications", compliance:"Compliance", alerts:"Alert centre"})[view];
  $("sidebar").classList.remove("open");
  if (view === "applications") renderAllApplications();
  if (view === "compliance") renderCompliance();
  if (view === "alerts") renderAllAlerts();
}

function renderStats() {
  const pending = applications.filter(a => ["Submitted","Under Review","Changes Required"].includes(a.status)).length;
  $("statTotal").textContent = applications.length;
  $("statPending").textContent = pending;
  $("statApproved").textContent = applications.filter(a => a.status === "Approved").length;
  $("statAlerts").textContent = alerts.length;
  $("navPending").textContent = pending;
  $("navAlerts").textContent = alerts.length;
  $("alertPill").textContent = alerts.length;
  $("alertIndicator").style.display = alerts.length ? "block" : "none";
  const counts = STATUSES.map(status => ({status,count:applications.filter(a=>a.status===status).length}));
  const colors = {"Submitted":"#e6aa45","Under Review":"#5474ec","Changes Required":"#e28a50","Approved":"#2baa7b","Rejected":"#d45c69"};
  $("statusChart").innerHTML = counts.map(item => `<div class="chart-row"><span>${esc(item.status)}</span><div class="chart-track"><div class="chart-fill" style="width:${applications.length ? item.count/applications.length*100 : 0}%;background:${colors[item.status]}"></div></div><span class="chart-number">${item.count}</span></div>`).join("");
  const docs = applications.flatMap(a => a.documents || []);
  const complete = docs.filter(d => d.uploaded).length;
  const percentage = docs.length ? Math.round(complete/docs.length*100) : 0;
  $("complianceSnapshot").innerHTML = `<div class="compliance-line"><span>Required documents completed</span><strong>${percentage}%</strong><div class="compliance-track"><span style="width:${percentage}%"></span></div></div><div class="compliance-line"><span>Documents received</span><strong>${complete} / ${docs.length}</strong></div><div class="compliance-line"><span>Applications with gaps</span><strong>${applications.filter(a=>(a.documents||[]).some(d=>!d.uploaded)).length}</strong></div>`;
}

function applicationRow(a, expanded = false) {
  const d = daysUntil(a.deadline);
  const urgent = d <= 7 && !["Approved","Rejected"].includes(a.status);
  const institution = `<div class="institution-cell"><div class="institution-icon">${institutionIcon(a.institution)}</div><div><strong title="${esc(a.institution)}">${esc(a.institution)}</strong><span>${esc(a.state || "State not set")}</span></div></div>`;
  if (!expanded) return `<tr><td>${institution}</td><td class="id-cell">${esc(a.applicationId)}</td><td>${statusBadge(a.status)}</td><td><span class="deadline ${urgent?"urgent":""}">${dateLabel(a.deadline)}</span></td><td><button class="row-action" data-action="details" data-id="${esc(a.applicationId)}" title="View details">⋯</button></td></tr>`;
  const options = STATUSES.map(s => `<option ${s===a.status?"selected":""}>${esc(s)}</option>`).join("");
  return `<tr><td>${institution}</td><td class="id-cell">${esc(a.applicationId)}</td><td>${esc(a.applicationType)}</td><td>${dateLabel(a.submittedAt)}</td><td><span class="deadline ${urgent?"urgent":""}">${dateLabel(a.deadline)}</span></td><td><select class="inline-status" data-action="status" data-id="${esc(a.applicationId)}" aria-label="Change status for ${esc(a.applicationId)}">${options}</select></td><td><button class="row-action" data-action="details" data-id="${esc(a.applicationId)}" title="View details">⋯</button></td></tr>`;
}

function filterApplications(search, status) {
  const term = (search || "").trim().toLowerCase();
  return applications.filter(a => (status === "All" || a.status === status) &&
    [a.applicationId,a.institution,a.state,a.applicationType].some(value=>String(value||"").toLowerCase().includes(term)));
}

function renderDashboardTable() {
  const list = filterApplications($("dashboardSearch").value, $("dashboardStatus").value).slice(0,5);
  $("dashboardTable").innerHTML = list.length ? list.map(a=>applicationRow(a)).join("") : `<tr><td colspan="5"><div class="empty-state">No matching applications found.</div></td></tr>`;
  $("dashboardCount").textContent = `Showing ${list.length} of ${applications.length} applications`;
}

function renderAllApplications() {
  const list = filterApplications($("allSearch").value, $("allStatus").value);
  $("allApplicationsTable").innerHTML = list.length ? list.map(a=>applicationRow(a,true)).join("") : `<tr><td colspan="7"><div class="empty-state">No matching applications found.</div></td></tr>`;
  $("allCount").textContent = `${list.length} application${list.length===1?"":"s"} shown`;
}

function alertMarkup(item) {
  const kind = item.type === "danger" ? "danger" : item.type === "warning" ? "warning" : "info";
  const symbol = kind === "danger" ? "!" : kind === "warning" ? "◷" : "i";
  return `<div class="alert-item"><div class="alert-symbol ${kind}">${symbol}</div><div class="alert-copy"><strong>${esc(item.title)}</strong><p>${esc(item.message)}</p><button class="alert-link" data-action="details" data-id="${esc(item.applicationId)}">Review application →</button></div></div>`;
}

function renderDashboardAlerts() {
  $("dashboardAlerts").innerHTML = alerts.length ? alerts.slice(0,4).map(alertMarkup).join("") : `<div class="empty-state">No active alerts. You're all caught up.</div>`;
}

function renderAllAlerts() {
  $("allAlerts").innerHTML = alerts.length ? alerts.map(alertMarkup).join("") : `<div class="empty-state">No active alerts. All sample records are complete and within deadline.</div>`;
}

function renderCompliance() {
  $("complianceCards").innerHTML = applications.map(a => {
    const docs = a.documents || [];
    const completed = docs.filter(d=>d.uploaded).length;
    const percent = docs.length ? Math.round(completed/docs.length*100) : 0;
    const rows = docs.map((doc,index)=>`<div class="document-row"><input type="checkbox" id="doc-${esc(a.applicationId)}-${index}" data-action="document" data-id="${esc(a.applicationId)}" data-index="${index}" ${doc.uploaded?"checked":""}><label for="doc-${esc(a.applicationId)}-${index}">${esc(doc.name)}</label><span class="document-state ${doc.uploaded?"done":""}">${doc.uploaded?"Received":"Missing"}</span></div>`).join("");
    return `<article class="compliance-card"><div class="compliance-card-head"><div><h3>${esc(a.institution)}</h3><div class="meta">${esc(a.applicationId)} · ${esc(a.applicationType)}</div></div>${statusBadge(a.status)}</div><div class="progress-text">${completed} of ${docs.length} documents received <strong style="float:right">${percent}%</strong></div><div class="progress-track"><span style="width:${percent}%"></span></div>${rows}</article>`;
  }).join("") || `<div class="empty-state">No applications to review.</div>`;
}

async function refreshData() {
  try {
    const [health, appData, alertData] = await Promise.all([api("/health"), api("/applications"), api("/alerts")]);
    applications = appData;
    alerts = alertData;
    $("systemStatus").textContent = health.database === "mongo" ? "MongoDB connected" : "Local database connected";
    $("systemStatus").previousElementSibling.style.background = "#38bd8c";
    renderStats(); renderDashboardTable(); renderDashboardAlerts();
    if (currentView === "applications") renderAllApplications();
    if (currentView === "compliance") renderCompliance();
    if (currentView === "alerts") renderAllAlerts();
  } catch (error) {
    $("systemStatus").textContent = "Backend unavailable";
    $("systemStatus").previousElementSibling.style.background = "#e05262";
    showToast("Cannot reach backend. Start the server with npm run dev.");
    console.error(error);
  }
}

function openModal() {
  $("formError").textContent = "";
  $("applicationForm").reset();
  const d = new Date(); d.setDate(d.getDate()+14);
  $("applicationForm").elements.deadline.value = d.toISOString().slice(0,10);
  $("applicationModal").classList.add("open");
  $("applicationModal").setAttribute("aria-hidden","false");
}
function closeModal() {
  $("applicationModal").classList.remove("open");
  $("applicationModal").setAttribute("aria-hidden","true");
}

async function openDetails(id) {
  const app = applications.find(a=>a.applicationId===id);
  if (!app) return;
  const docs = (app.documents||[]).map(d=>`${d.uploaded?"✓":"○"} ${d.name}`).join("\n");
  const next = prompt(
    `Application: ${app.institution}\nID: ${app.applicationId}\nType: ${app.applicationType}\nState: ${app.state}\nDeadline: ${app.deadline}\n\nDocuments:\n${docs}\n\nEnter a new status exactly as listed, or leave blank to cancel:\n${STATUSES.join(" | ")}`,
    app.status
  );
  if (next === null || !next.trim() || next.trim() === app.status) return;
  if (!STATUSES.includes(next.trim())) { showToast("Choose one of the listed statuses."); return; }
  try {
    await api(`/applications/${encodeURIComponent(id)}`, {method:"PATCH", body:JSON.stringify({status:next.trim()})});
    await refreshData(); showToast("Application status updated.");
  } catch (error) { showToast(error.message); }
}

document.querySelectorAll(".nav-item").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.go)));
$("newApplicationBtn").addEventListener("click",openModal);
$("newApplicationBtn2").addEventListener("click",openModal);
$("closeModal").addEventListener("click",closeModal);
$("cancelModal").addEventListener("click",closeModal);
$("applicationModal").addEventListener("click",event=>{if(event.target===$("applicationModal"))closeModal();});
$("topAlerts").addEventListener("click",()=>setView("alerts"));
$("refreshAlerts").addEventListener("click",async()=>{await refreshData();showToast("Alerts refreshed.");});
$("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("dashboardSearch").addEventListener("input",renderDashboardTable);
$("dashboardStatus").addEventListener("change",renderDashboardTable);
$("allSearch").addEventListener("input",renderAllApplications);
$("allStatus").addEventListener("change",renderAllApplications);

document.addEventListener("click",event=>{
  const button=event.target.closest("[data-action='details']");
  if(button) openDetails(button.dataset.id);
});
document.addEventListener("change",async event=>{
  const target=event.target;
  if(target.matches("[data-action='status']")){
    try {
      await api(`/applications/${encodeURIComponent(target.dataset.id)}`,{method:"PATCH",body:JSON.stringify({status:target.value})});
      await refreshData(); showToast("Application status saved.");
    } catch(error){showToast(error.message);await refreshData();}
  }
  if(target.matches("[data-action='document']")){
    const app=applications.find(a=>a.applicationId===target.dataset.id);
    if(!app)return;
    const docs=app.documents.map(d=>({...d}));
    docs[Number(target.dataset.index)].uploaded=target.checked;
    try {
      await api(`/applications/${encodeURIComponent(app.applicationId)}`,{method:"PATCH",body:JSON.stringify({documents:docs})});
      await refreshData(); showToast("Compliance checklist updated.");
    } catch(error){showToast(error.message);await refreshData();}
  }
});

$("applicationForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  const data=Object.fromEntries(new FormData(form).entries());
  const button=$("submitApplication");
  button.disabled=true;button.textContent="Creating…";$("formError").textContent="";
  try {
    const created=await api("/applications",{method:"POST",body:JSON.stringify(data)});
    closeModal();await refreshData();setView("applications");
    showToast(`Created ${created.applicationId}`);
  } catch(error) {$("formError").textContent=error.message;}
  finally {button.disabled=false;button.textContent="Create application";}
});

refreshData();
