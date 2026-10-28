const crypto = require("node:crypto");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function requireAdmin(req, res, next) {
  const expected = process.env.LIBRARIAN_API_KEY;
  const supplied = req.get("x-librarian-key");
  if (!expected || !supplied || !safeEqual(supplied, expected)) {
    return res.status(401).json({ error: "Librarian authorization required." });
  }
  next();
}
module.exports = { requireAdmin, safeEqual };
