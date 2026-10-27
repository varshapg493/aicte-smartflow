const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "applications.json");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const STATUSES = ["Submitted", "Under Review", "Changes Required", "Approved", "Rejected"];

const seedApplications = [
  {
    applicationId: "AICTE-2026-1001",
    institution: "Northstar Institute of Technology",
    institutionType: "Engineering College",
    state: "Karnataka",
    applicationType: "Extension of Approval",
    contactEmail: "admin@northstar.example",
    submittedAt: "2026-10-20",
    deadline: "2026-11-05",
    status: "Under Review",
    documents: [
      { name: "Infrastructure report", uploaded: true },
      { name: "Faculty details", uploaded: true },
      { name: "Audited financial statement", uploaded: false },
      { name: "Governing body declaration", uploaded: true }
    ],
    notes: "Financial statement is pending verification."
  },
  {
    applicationId: "AICTE-2026-1002",
    institution: "Greenfield College of Engineering",
    institutionType: "Engineering College",
    state: "Tamil Nadu",
    applicationType: "New Institution Approval",
    contactEmail: "office@greenfield.example",
    submittedAt: "2026-10-18",
    deadline: "2026-10-29",
    status: "Submitted",
    documents: [
      { name: "Infrastructure report", uploaded: true },
      { name: "Faculty details", uploaded: false },
      { name: "Audited financial statement", uploaded: true },
      { name: "Governing body declaration", uploaded: false }
    ],
    notes: ""
  },
  {
    applicationId: "AICTE-2026-1003",
    institution: "Riverbend Polytechnic",
    institutionType: "Polytechnic",
    state: "Kerala",
    applicationType: "Course Intake Change",
    contactEmail: "principal@riverbend.example",
    submittedAt: "2026-10-14",
    deadline: "2026-11-12",
    status: "Changes Required",
    documents: [
      { name: "Infrastructure report", uploaded: true },
      { name: "Faculty details", uploaded: true },
      { name: "Audited financial statement", uploaded: true },
      { name: "Governing body declaration", uploaded: true }
    ],
    notes: "Please clarify the proposed intake change."
  },
  {
    applicationId: "AICTE-2026-1004",
    institution: "Summit School of Applied Sciences",
    institutionType: "Applied Sciences",
    state: "Maharashtra",
    applicationType: "Extension of Approval",
    contactEmail: "registrar@summit.example",
    submittedAt: "2026-10-10",
    deadline: "2026-11-20",
    status: "Approved",
    documents: [
      { name: "Infrastructure report", uploaded: true },
      { name: "Faculty details", uploaded: true },
      { name: "Audited financial statement", uploaded: true },
      { name: "Governing body declaration", uploaded: true }
    ],
    notes: "Sample approved record for demonstration."
  },
  {
    applicationId: "AICTE-2026-1005",
    institution: "Eastview Technical Campus",
    institutionType: "Engineering College",
    state: "Telangana",
    applicationType: "New Institution Approval",
    contactEmail: "contact@eastview.example",
    submittedAt: "2026-10-23",
    deadline: "2026-10-27",
    status: "Submitted",
    documents: [
      { name: "Infrastructure report", uploaded: true },
      { name: "Faculty details", uploaded: false },
      { name: "Audited financial statement", uploaded: false },
      { name: "Governing body declaration", uploaded: true }
    ],
    notes: ""
  }
];

let databaseMode = "json";
let ApplicationModel;

function ensureJsonDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seedApplications, null, 2));
  }
}

function readJson() {
  ensureJsonDatabase();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeJson(records) {
  ensureJsonDatabase();
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2));
}

async function listApplications() {
  if (databaseMode === "mongo") return ApplicationModel.find().sort({ submittedAt: -1 }).lean();
  return readJson().sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

async function createApplication(data) {
  if (databaseMode === "mongo") {
    const created = await ApplicationModel.create(data);
    return created.toObject();
  }
  const records = readJson();
  records.unshift(data);
  writeJson(records);
  return data;
}

async function updateApplication(id, patch) {
  if (databaseMode === "mongo") {
    return ApplicationModel.findOneAndUpdate(
      { applicationId: id }, { $set: patch }, { new: true, runValidators: true }
    ).lean();
  }
  const records = readJson();
  const index = records.findIndex((item) => item.applicationId === id);
  if (index === -1) return null;
  records[index] = { ...records[index], ...patch };
  writeJson(records);
  return records[index];
}

async function deleteApplication(id) {
  if (databaseMode === "mongo") {
    const result = await ApplicationModel.findOneAndDelete({ applicationId: id }).lean();
    return Boolean(result);
  }
  const records = readJson();
  const filtered = records.filter((item) => item.applicationId !== id);
  if (filtered.length === records.length) return false;
  writeJson(filtered);
  return true;
}

function daysUntil(dateString) {
  if (!dateString) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(deadline.getTime())) return Infinity;
  return Math.ceil((deadline - today) / 86400000);
}

function buildAlerts(applications) {
  const alerts = [];
  applications.forEach((application) => {
    const missing = (application.documents || []).filter((document) => !document.uploaded);
    const days = daysUntil(application.deadline);
    if (missing.length) {
      alerts.push({
        id: `${application.applicationId}-docs`,
        type: "warning",
        title: "Missing documents",
        message: `${application.institution}: ${missing.map((d) => d.name).join(", ")}.`,
        applicationId: application.applicationId
      });
    }
    if (days < 0 && !["Approved", "Rejected"].includes(application.status)) {
      alerts.push({
        id: `${application.applicationId}-overdue`,
        type: "danger",
        title: "Deadline overdue",
        message: `${application.institution} is ${Math.abs(days)} day(s) past its deadline.`,
        applicationId: application.applicationId
      });
    } else if (days >= 0 && days <= 7 && !["Approved", "Rejected"].includes(application.status)) {
      alerts.push({
        id: `${application.applicationId}-deadline`,
        type: "warning",
        title: "Deadline approaching",
        message: `${application.institution} has ${days} day(s) remaining.`,
        applicationId: application.applicationId
      });
    }
  });
  return alerts;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "AICTE SmartFlow", database: databaseMode });
});

app.get("/api/applications", async (req, res, next) => {
  try {
    let applications = await listApplications();
    const { search = "", status = "All" } = req.query;
    if (status !== "All") applications = applications.filter((a) => a.status === status);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      applications = applications.filter((a) =>
        [a.applicationId, a.institution, a.state, a.applicationType].some((value) =>
          String(value || "").toLowerCase().includes(term)
        )
      );
    }
    res.json(applications);
  } catch (error) { next(error); }
});

app.get("/api/summary", async (req, res, next) => {
  try {
    const applications = await listApplications();
    res.json({
      total: applications.length,
      pending: applications.filter((a) => ["Submitted", "Under Review", "Changes Required"].includes(a.status)).length,
      approved: applications.filter((a) => a.status === "Approved").length,
      changesRequired: applications.filter((a) => a.status === "Changes Required").length,
      alerts: buildAlerts(applications).length,
      recent: applications.slice(0, 5)
    });
  } catch (error) { next(error); }
});

app.get("/api/alerts", async (req, res, next) => {
  try { res.json(buildAlerts(await listApplications())); }
  catch (error) { next(error); }
});

app.post("/api/applications", async (req, res, next) => {
  try {
    const body = req.body || {};
    const required = ["institution", "state", "applicationType", "contactEmail", "deadline"];
    const missingFields = required.filter((field) => !String(body[field] || "").trim());
    if (missingFields.length) {
      return res.status(400).json({ message: `Required fields: ${missingFields.join(", ")}` });
    }
    const applications = await listApplications();
    const nextNumber = 1001 + applications.reduce((max, item) => {
      const match = String(item.applicationId || "").match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 1000);
    }, 1000) - 1000;
    const applicationId = `AICTE-${new Date().getFullYear()}-${nextNumber}`;
    const documents = [
      "Infrastructure report",
      "Faculty details",
      "Audited financial statement",
      "Governing body declaration"
    ].map((name) => ({ name, uploaded: false }));
    const record = {
      applicationId,
      institution: String(body.institution).trim(),
      institutionType: String(body.institutionType || "Engineering College").trim(),
      state: String(body.state).trim(),
      applicationType: String(body.applicationType).trim(),
      contactEmail: String(body.contactEmail).trim(),
      submittedAt: new Date().toISOString().slice(0, 10),
      deadline: String(body.deadline).slice(0, 10),
      status: "Submitted",
      documents,
      notes: ""
    };
    const created = await createApplication(record);
    res.status(201).json(created);
  } catch (error) { next(error); }
});

app.patch("/api/applications/:id", async (req, res, next) => {
  try {
    const patch = {};
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({ message: "Invalid status." });
      }
      patch.status = req.body.status;
    }
    if (req.body.notes !== undefined) patch.notes = String(req.body.notes).slice(0, 2000);
    if (Array.isArray(req.body.documents)) {
      patch.documents = req.body.documents.map((document) => ({
        name: String(document.name || "").slice(0, 120),
        uploaded: Boolean(document.uploaded)
      }));
    }
    if (!Object.keys(patch).length) return res.status(400).json({ message: "No valid fields supplied." });
    const updated = await updateApplication(req.params.id, patch);
    if (!updated) return res.status(404).json({ message: "Application not found." });
    res.json(updated);
  } catch (error) { next(error); }
});

app.delete("/api/applications/:id", async (req, res, next) => {
  try {
    const removed = await deleteApplication(req.params.id);
    if (!removed) return res.status(404).json({ message: "Application not found." });
    res.json({ message: "Application deleted." });
  } catch (error) { next(error); }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Something went wrong on the server." });
});

async function start() {
  if (MONGODB_URI && MONGODB_URI.trim()) {
    try {
      await mongoose.connect(MONGODB_URI);
      const schema = new mongoose.Schema({
        applicationId: { type: String, required: true, unique: true },
        institution: { type: String, required: true },
        institutionType: String,
        state: { type: String, required: true },
        applicationType: { type: String, required: true },
        contactEmail: { type: String, required: true },
        submittedAt: String,
        deadline: { type: String, required: true },
        status: { type: String, enum: STATUSES, default: "Submitted" },
        documents: [{ name: String, uploaded: Boolean }],
        notes: String
      }, { timestamps: true });
      ApplicationModel = mongoose.models.Application || mongoose.model("Application", schema);
      databaseMode = "mongo";
      const count = await ApplicationModel.countDocuments();
      if (count === 0) {
        await ApplicationModel.insertMany(seedApplications);
      }
      console.log("Connected to MongoDB Atlas.");
    } catch (error) {
      console.error("MongoDB connection failed:", error.message);
      console.error("Starting with the local JSON database instead.");
      databaseMode = "json";
      ensureJsonDatabase();
    }
  } else {
    ensureJsonDatabase();
    console.log("MONGODB_URI not set; using local JSON database at data/applications.json.");
  }

  app.listen(PORT, () => {
    console.log(`AICTE SmartFlow running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

start();
