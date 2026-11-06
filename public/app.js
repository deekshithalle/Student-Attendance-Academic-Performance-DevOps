const $ = id => document.getElementById(id);
let authenticated = false;
const authHeaders = () => ({ "Content-Type": "application/json", "x-faculty-auth": String(authenticated) });

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function showStatus(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function switchTab(id) {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.hidden = panel.id !== id);
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === id));
}
async function loadStudents() {
  const students = await api("/api/students");
  $("studentsBody").innerHTML = students.map(s => `<tr><td>${escapeHtml(s.rollNo)}</td><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.department)}</td><td>${escapeHtml(s.year)}</td></tr>`).join("");
  const options = students.map(s => `<option value="${s.id}">${escapeHtml(s.rollNo)} - ${escapeHtml(s.name)}</option>`).join("");
  $("marksStudent").innerHTML = options;
  $("reportStudent").innerHTML = options;
  $("totalStudents").textContent = students.length;
  return students;
}
async function loadDashboard() {
  const d = await api("/api/dashboard");
  $("totalStudents").textContent = d.students;
  $("attendanceRecords").textContent = d.attendanceRecords;
  $("overallAttendance").textContent = `${d.overallAttendance}%`;
  $("marksRecords").textContent = d.marksRecords;
}
async function loadAttendanceRows() {
  const students = await loadStudents();
  $("attendanceBody").innerHTML = students.map(s => `<tr data-student-id="${s.id}"><td>${escapeHtml(s.rollNo)}</td><td>${escapeHtml(s.name)}</td><td><select class="attendance-status"><option>Present</option><option>Absent</option></select></td></tr>`).join("");
}
async function refreshSummary() {
  const rows = await api("/api/attendance/summary");
  $("summaryBody").innerHTML = rows.map(r => `<tr><td>${escapeHtml(r.rollNo)}</td><td>${escapeHtml(r.name)}</td><td>${r.present}</td><td>${r.total}</td><td>${r.percentage}%</td></tr>`).join("");
  showStatus("Attendance percentages calculated.");
}
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await fetch("/api/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username:$("username").value,password:$("password").value}) }).then(async r => { const d=await r.json(); if(!r.ok) throw new Error(d.error); return d; });
    authenticated = true;
    $("loginPanel").hidden = true;
    $("appPanel").hidden = false;
    $("attendanceDate").value = new Date().toISOString().slice(0,10);
    await loadStudents(); await loadDashboard(); await loadAttendanceRows();
    showStatus(result.message);
  } catch (err) { showStatus(err.message, true); }
});
$("logoutBtn").addEventListener("click", () => {
  authenticated = false; $("appPanel").hidden = true; $("loginPanel").hidden = false; showStatus("Logged out.");
});
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
$("studentForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await api("/api/students", {method:"POST",body:JSON.stringify({rollNo:$("rollNo").value.trim(),name:$("studentName").value.trim(),email:$("studentEmail").value.trim(),department:$("department").value.trim(),year:$("year").value.trim()})});
    $("studentForm").reset(); $("department").value="AIML"; $("year").value="3";
    await loadStudents(); await loadDashboard(); await loadAttendanceRows(); showStatus(result.message);
  } catch(err){showStatus(err.message,true);}
});
$("loadAttendanceBtn").addEventListener("click", async () => {
  try { await loadAttendanceRows(); showStatus("Student list loaded for attendance."); } catch(err){showStatus(err.message,true);}
});
$("saveAttendanceBtn").addEventListener("click", async () => {
  try {
    const records = [...document.querySelectorAll("#attendanceBody tr")].map(row => ({studentId:Number(row.dataset.studentId),status:row.querySelector("select").value}));
    const result = await api("/api/attendance", {method:"POST",body:JSON.stringify({date:$("attendanceDate").value,records})});
    await loadDashboard(); await refreshSummary(); showStatus(result.message);
  } catch(err){showStatus(err.message,true);}
});
$("refreshSummaryBtn").addEventListener("click", async () => { try { await refreshSummary(); await loadDashboard(); } catch(err){showStatus(err.message,true);} });
$("marksForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const result = await api("/api/marks", {method:"POST",body:JSON.stringify({studentId:Number($("marksStudent").value),subject:$("subject").value.trim(),internal1:$("internal1").value,internal2:$("internal2").value,semester:$("semester").value,assignment:$("assignment").value})});
    $("marksForm").reset(); await loadDashboard(); showStatus(`${result.message} | Internal average: ${result.record.internalAverage}/30 | Total: ${result.record.total}/100`);
  } catch(err){showStatus(err.message,true);}
});
$("generateReportBtn").addEventListener("click", async () => {
  try {
    const report = await api(`/api/reports/${$("reportStudent").value}`);
    const marks = report.marks.length ? report.marks.map(m=>`<li><strong>${escapeHtml(m.subject)}</strong>: Internal 1 ${m.internal1}/30, Internal 2 ${m.internal2}/30, Internal average ${m.internalAverage}/30, Semester ${m.semester}/60, Assignment ${m.assignment}/10, <strong>Total ${m.total}/100</strong></li>`).join("") : "<li>No marks entered.</li>";
    $("reportOutput").innerHTML = `<h3>${escapeHtml(report.student.name)} (${escapeHtml(report.student.rollNo)})</h3><p>Attendance: ${report.attendance.present}/${report.attendance.total} (${report.attendance.percentage}%)</p><p>Internal marks:</p><ul>${marks}</ul><small>Generated: ${new Date(report.generatedAt).toLocaleString()}</small>`;
    showStatus("Performance report generated.");
  } catch(err){showStatus(err.message,true);}
});
