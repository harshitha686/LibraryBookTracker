const express = require("express");
const supabase = require("../supabase");
const { requireAdmin } = require("../middleware/admin");
const { asyncHandler, publicError } = require("../utils/errors");
const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value, name) {
  if (typeof value !== "string" || !DATE_RE.test(value)) throw publicError(`${name} must use YYYY-MM-DD format.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw publicError(`${name} is not a valid calendar date.`);
  return value;
}
function dbError(error) {
  if (error.code === "P0001") return publicError(error.message || "The book is not available.", 409);
  if (error.code === "23503") return publicError("The selected book does not exist.", 404);
  if (error.code === "23514") return publicError("The loan dates or values are invalid.", 400);
  return publicError("A database operation failed. Check the server configuration and try again.", 500);
}
router.get("/", asyncHandler(async (req, res) => {
  const allowed = ["active", "returned", "overdue", "all"];
  const status = allowed.includes(req.query.status) ? req.query.status : "active";
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
  let query = supabase.from("loans").select("id,book_id,borrower_name,borrower_reference,issue_date,due_date,returned_at,created_at,books(title,author)").order("created_at", { ascending: false }).limit(limit);
  if (status === "active" || status === "overdue") query = query.is("returned_at", null);
  if (status === "returned") query = query.not("returned_at", "is", null);
  if (status === "overdue") query = query.lt("due_date", new Date().toISOString().slice(0,10));
  const { data, error } = await query;
  if (error) throw dbError(error);
  res.json({ data: (data || []).map(loan => ({ ...loan, book_title: loan.books?.title || "Unknown book", book_author: loan.books?.author || "", books: undefined })) });
}));
router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const { book_id, borrower_name, borrower_reference = null } = req.body || {};
  if (typeof book_id !== "string" || !/^[0-9a-f-]{36}$/i.test(book_id)) throw publicError("Select a valid book.");
  if (typeof borrower_name !== "string" || !borrower_name.trim() || borrower_name.trim().length > 120) throw publicError("Borrower's name is required (maximum 120 characters).");
  if (borrower_reference !== null && (typeof borrower_reference !== "string" || borrower_reference.trim().length > 60)) throw publicError("Borrower reference must be 60 characters or fewer.");
  const issue_date = validDate(req.body.issue_date, "issue_date");
  const due_date = validDate(req.body.due_date, "due_date");
  if (due_date < issue_date) throw publicError("Due date cannot be earlier than the issue date.");
  const { data, error } = await supabase.rpc("checkout_book", {
    p_book_id: book_id, p_borrower_name: borrower_name.trim(),
    p_borrower_reference: borrower_reference?.trim() || null,
    p_issue_date: issue_date, p_due_date: due_date
  });
  if (error) throw dbError(error);
  res.status(201).json({ data });
}));
router.post("/:id/return", requireAdmin, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("loans").update({ returned_at: new Date().toISOString() }).eq("id", req.params.id).is("returned_at", null).select("id,book_id,returned_at").maybeSingle();
  if (error) throw dbError(error);
  if (!data) {
    const { data: existing, error: findError } = await supabase.from("loans").select("id,returned_at").eq("id", req.params.id).maybeSingle();
    if (findError) throw dbError(findError);
    if (!existing) throw publicError("Loan not found.", 404);
    throw publicError("This loan has already been returned.", 409);
  }
  res.json({ data });
}));
module.exports = router;
