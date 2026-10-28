require("dotenv").config();
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { safeEqual } = require("./middleware/admin");
const booksRouter = require("./routes/books");
const loansRouter = require("./routes/loans");
const dashboardRouter = require("./routes/dashboard");

if (!process.env.LIBRARIAN_API_KEY || process.env.LIBRARIAN_API_KEY.length < 32) {
  throw new Error("Set LIBRARIAN_API_KEY to a random secret of at least 32 characters in backend/.env");
}
const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-origin" } }));
app.use(express.json({ limit: "20kb" }));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "library-book-tracker-api" }));
app.get("/api/admin/check", (req, res) => {
  if (!safeEqual(req.get("x-librarian-key"), process.env.LIBRARIAN_API_KEY)) return res.status(401).json({ error: "Invalid librarian key." });
  res.json({ data: { authorized: true } });
});
app.use("/api/books", booksRouter);
app.use("/api/loans", loansRouter);
app.use("/api/dashboard", dashboardRouter);
app.use(express.static(path.join(__dirname, "..", "frontend"), { index: "index.html", dotfiles: "deny" }));
app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((req, res) => {
  if (req.accepts("html")) return res.status(404).sendFile(path.join(__dirname, "..", "frontend", "index.html"));
  res.status(404).json({ error: "Resource not found." });
});
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must contain valid JSON." });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error("Server error:", error.message);
  res.status(status).json({ error: status >= 500 ? "An unexpected server error occurred." : error.message });
});
const port = Number(process.env.PORT) || 3000;
if (require.main === module) app.listen(port, () => console.log(`Library Book Tracker running at http://localhost:${port}`));
module.exports = app;
