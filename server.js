const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function initialData() {
  return {
    students: [
      { id: 1, rollNo: "AIML001", name: "Aarav Kumar", email: "aarav@example.com", department: "AIML", year: "3" },
      { id: 2, rollNo: "AIML002", name: "Meera Reddy", email: "meera@example.com", department: "AIML", year: "3" },
      { id: 3, rollNo: "AIML003", name: "Rahul Sharma", email: "rahul@example.com", department: "AIML", year: "3" }
    ],
    attendance: [],
    marks: []
  };
}
function loadData() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(initialData(), null, 2));
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    console.error("Unable to load data:", err);
    return initialData();
  }
}
let db = loadData();
function saveData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}
function faculty(req, res, next) {
  if (req.header("x-faculty-auth") === "true") return next();
  return res.status(401).json({ error: "Faculty login required" });
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

app.get("/api/health", (req, res) => res.json({ ok: true, service: "student-attendance" }));
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const expectedUser = process.env.FACULTY_USERNAME || "faculty";
  const expectedPass = process.env.FACULTY_PASSWORD || "faculty123";
  if (username === expectedUser && password === expectedPass) return res.json({ ok: true, message: "Login successful" });
  return res.status(401).json({ error: "Invalid faculty credentials" });
});
app.get("/api/students", faculty, (req, res) => res.json(db.students));
app.post("/api/students", faculty, (req, res) => {
  const { rollNo, name, email, department, year } = req.body || {};
  if (!rollNo || !name || !email) return res.status(400).json({ error: "Roll number, name and email are required" });
  if (db.students.some(s => s.rollNo.toLowerCase() === String(rollNo).toLowerCase())) return res.status(409).json({ error: "Roll number already exists" });
  const student = { id: nextId(db.students), rollNo, name, email, department: department || "AIML", year: year || "3" };
  db.students.push(student); saveData();
  res.status(201).json({ message: "Student added successfully", student });
});
app.put("/api/students/:id", faculty, (req, res) => {
  const student = db.students.find(s => s.id === Number(req.params.id));
  if (!student) return res.status(404).json({ error: "Student not found" });
  Object.assign(student, req.body || {}); saveData();
  res.json({ message: "Student updated successfully", student });
});
app.get("/api/attendance", faculty, (req, res) => {
  const date = req.query.date;
  res.json(date ? db.attendance.filter(a => a.date === date) : db.attendance);
});
app.post("/api/attendance", faculty, (req, res) => {
  const { date, records } = req.body || {};
  if (!validDate(date) || !Array.isArray(records)) return res.status(400).json({ error: "Valid date and attendance records are required" });
  for (const record of records) {
    if (!db.students.some(s => s.id === Number(record.studentId))) return res.status(400).json({ error: "Unknown student in attendance records" });
    if (!["Present", "Absent"].includes(record.status)) return res.status(400).json({ error: "Status must be Present or Absent" });
  }
  for (const record of records) {
    const existing = db.attendance.find(a => a.studentId === Number(record.studentId) && a.date === date);
    if (existing) existing.status = record.status;
    else db.attendance.push({ id: nextId(db.attendance), studentId: Number(record.studentId), date, status: record.status });
  }
  saveData(); res.json({ message: "Attendance recorded/updated successfully", count: records.length });
});
app.get("/api/attendance/summary", faculty, (req, res) => {
  const summary = db.students.map(student => {
    const records = db.attendance.filter(a => a.studentId === student.id);
    const present = records.filter(a => a.status === "Present").length;
    const total = records.length;
    return { studentId: student.id, rollNo: student.rollNo, name: student.name, present, total, percentage: total ? Number((present / total * 100).toFixed(2)) : 0 };
  });
  res.json(summary);
});
app.post("/api/marks", faculty, (req, res) => {
  const { studentId, subject, internal1, internal2, semester, assignment } = req.body || {};
  if (!db.students.some(s => s.id === Number(studentId))) return res.status(400).json({ error: "Select a valid student" });
  if (!subject) return res.status(400).json({ error: "Subject is required" });
  const i1 = Number(internal1), i2 = Number(internal2), sem = Number(semester), assign = Number(assignment);
  if (!Number.isFinite(i1) || i1 < 0 || i1 > 30) return res.status(400).json({ error: "Internal 1 marks must be between 0 and 30" });
  if (!Number.isFinite(i2) || i2 < 0 || i2 > 30) return res.status(400).json({ error: "Internal 2 marks must be between 0 and 30" });
  if (!Number.isFinite(sem) || sem < 0 || sem > 60) return res.status(400).json({ error: "Semester marks must be between 0 and 60" });
  if (!Number.isFinite(assign) || assign < 0 || assign > 10) return res.status(400).json({ error: "Assignment marks must be between 0 and 10" });
  const internalAverage = Number(((i1 + i2) / 2).toFixed(2));
  const total = Number((sem + internalAverage + assign).toFixed(2));
  const existing = db.marks.find(m => m.studentId === Number(studentId) && m.subject.toLowerCase() === subject.toLowerCase());
  const record = { id: existing ? existing.id : nextId(db.marks), studentId: Number(studentId), subject, internal1: i1, internal2: i2, internalAverage, semester: sem, assignment: assign, total };
  if (existing) Object.assign(existing, record); else db.marks.push(record);
  saveData(); res.json({ message: "Marks saved successfully", record });
});
app.get("/api/reports/:studentId", faculty, (req, res) => {
  const student = db.students.find(s => s.id === Number(req.params.studentId));
  if (!student) return res.status(404).json({ error: "Student not found" });
  const attendance = db.attendance.filter(a => a.studentId === student.id);
  const present = attendance.filter(a => a.status === "Present").length;
  const marks = db.marks.filter(m => m.studentId === student.id);
  res.json({ student, attendance: { present, total: attendance.length, percentage: attendance.length ? Number((present / attendance.length * 100).toFixed(2)) : 0 }, marks, generatedAt: new Date().toISOString() });
});
app.get("/api/dashboard", faculty, (req, res) => {
  const total = db.attendance.length;
  const present = db.attendance.filter(a => a.status === "Present").length;
  res.json({ students: db.students.length, attendanceRecords: total, overallAttendance: total ? Number((present / total * 100).toFixed(2)) : 0, marksRecords: db.marks.length });
});
if (require.main === module) app.listen(PORT, () => console.log(`Student Attendance app running at http://localhost:${PORT}`));
module.exports = app;
