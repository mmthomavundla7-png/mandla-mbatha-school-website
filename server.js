require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const port = Number(process.env.PORT || 3000);
const dbFile = process.env.DATABASE_FILE || "./data/admissions.sqlite";
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  learner_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

// Safe schema additions for databases created by version 1.1.
const existingColumns = new Set(db.prepare("PRAGMA table_info(applications)").all().map(column => column.name));
if (!existingColumns.has("consent")) {
  db.exec("ALTER TABLE applications ADD COLUMN consent INTEGER NOT NULL DEFAULT 0");
}
if (!existingColumns.has("consented_at")) {
  db.exec("ALTER TABLE applications ADD COLUMN consented_at TEXT");
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://api.openai.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: process.env.NODE_ENV === "production" ? "1h" : 0 }));

const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false });
const assistantLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const allowedGrades = ["Grade RR", "Grade R", ...Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`)];
const asText = value => typeof value === "string" ? value.trim() : "";

app.post("/api/applications", submitLimiter, (req, res) => {
  const body = req.body || {};
  const parentName = asText(body.parentName);
  const phone = asText(body.phone);
  const email = asText(body.email);
  const learnerName = asText(body.learnerName);
  const grade = asText(body.grade);
  const message = asText(body.message);
  const consent = body.consent === true || body.consent === "yes";

  if (!parentName || !phone || !learnerName || !allowedGrades.includes(grade) || !consent) {
    return res.status(400).json({ error: "Please complete the required fields, select a grade and accept the privacy notice." });
  }
  if (parentName.length > 120 || learnerName.length > 120 || phone.length > 30 || email.length > 150 || message.length > 2000) {
    return res.status(400).json({ error: "One or more fields are too long." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address or leave the email field blank." });
  }

  const info = db.prepare(`INSERT INTO applications
    (parent_name, phone, email, learner_name, grade, message, consent, consented_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`)
    .run(parentName, phone, email || null, learnerName, grade, message || null);
  res.set("Cache-Control", "no-store");
  res.status(201).json({ ok: true, reference: `MMS-${String(info.lastInsertRowid).padStart(6, "0")}` });
});

function adminAuthorized(req) {
  const configuredKey = process.env.ADMIN_KEY;
  const suppliedKey = req.get("x-admin-key") || "";
  if (!configuredKey || !suppliedKey) return false;
  const expected = Buffer.from(configuredKey);
  const actual = Buffer.from(suppliedKey);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
function requireAdmin(req, res, next) {
  res.set("Cache-Control", "no-store");
  if (!adminAuthorized(req)) return res.status(401).json({ error: "Access denied. Check the administrator key." });
  next();
}

// The admin panel only returns records after a valid key is supplied.
app.get("/api/admin/applications", adminLimiter, requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 250);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const total = db.prepare("SELECT COUNT(*) AS total FROM applications").get().total;
  const applications = db.prepare(`SELECT id, parent_name, phone, email, learner_name, grade, message, created_at, consent, consented_at
    FROM applications ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  res.json({ applications, total, limit, offset });
});

function csvCell(value) {
  const raw = String(value == null ? "" : value).replace(/[\r\n]+/g, " ");
  // Escape spreadsheet formulas in user-provided content before CSV export.
  const safe = /^[\s]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
app.get("/api/admin/applications.csv", adminLimiter, requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT id, parent_name, phone, email, learner_name, grade, message, created_at, consented_at
    FROM applications ORDER BY id DESC`).all();
  const headers = ["Reference ID", "Parent or guardian", "Telephone", "Email", "Learner", "Grade", "Enquiry", "Submitted at", "Privacy consent at"];
  const lines = [headers, ...rows.map(row => [
    `MMS-${String(row.id).padStart(6, "0")}`, row.parent_name, row.phone, row.email,
    row.learner_name, row.grade, row.message, row.created_at, row.consented_at
  ])].map(row => row.map(csvCell).join(","));
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="mandla-mbatha-admission-enquiries.csv"',
    "Cache-Control": "no-store"
  });
  res.send("\uFEFF" + lines.join("\r\n"));
});

// General school-information assistant. It has no database access.
app.post("/api/assistant", assistantLimiter, async (req, res) => {
  const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = history.slice(-8)
    .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map(item => ({ role: item.role, content: item.content.trim().slice(0, 1200) }))
    .filter(item => item.content);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Please enter a question for the school assistant." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "The school assistant is not yet configured. Please contact the school by telephone or email." });
  }

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-astra",
        instructions: "You are the general-information assistant for Mandla Mbatha School NPC in Tembisa, Gauteng, South Africa. Be friendly, clear and concise. Use only these confirmed website details: the school motto is 'Educate to Educate'; the school is in Tembisa, Gauteng; the website lists English as the language of learning and teaching and a CAPS-aligned programme subject to approved offering and registration status; displayed academic phases are Foundation (RR–3), Intermediate (4–6) and Senior (7–12); prospective parents can submit an online admission enquiry, but an enquiry is not confirmation of admission; telephone 063 099 7903; email mandlambathaschoolnpc@gmail.com; website mandlambathaschool.com. Do not invent current fees, office hours, grade availability, registration status, application outcomes, policies or dates. For anything not stated here, say the school administration must confirm it and provide the phone/email. You cannot view or retrieve admission records or private learner data. Never ask for ID numbers, dates of birth, medical information, home addresses or identity documents. If asked to submit an application, direct the visitor to the website enquiry form. Do not claim to be a human staff member.",
        input: messages,
        max_output_tokens: 250,
        store: false
      }),
      signal: AbortSignal.timeout(25000)
    });
    const payload = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      const status = apiResponse.status === 429 ? 429 : 502;
      return res.status(status).json({ error: apiResponse.status === 429
        ? "The assistant is busy. Please try again shortly."
        : "The assistant could not respond just now. Please contact the school directly." });
    }
    const answer = (payload.output || [])
      .flatMap(item => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text || "")
      .join("\n").trim();
    if (!answer) return res.status(502).json({ error: "The assistant did not return an answer. Please contact the school directly." });
    res.set("Cache-Control", "no-store");
    return res.json({ answer });
  } catch (error) {
    return res.status(502).json({ error: "The assistant is temporarily unavailable. Please contact the school directly." });
  }
});

app.get("/admin", (_, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/health", (_, res) => res.json({ ok: true }));
app.listen(port, () => console.log(`Mandla Mbatha School website running on port ${port}`));
