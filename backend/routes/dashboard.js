const express = require("express");
const supabase = require("../supabase");
const { asyncHandler, publicError } = require("../utils/errors");
const router = express.Router();
router.get("/", asyncHandler(async (_req, res) => {
  const [books, active, loans] = await Promise.all([
    supabase.from("books").select("id,total_copies"),
    supabase.from("loans").select("id,book_id,due_date").is("returned_at", null),
    supabase.from("loans").select("id", { count: "exact", head: true })
  ]);
  const failure = [books, active, loans].find(result => result.error);
  if (failure) throw publicError("Could not load dashboard statistics from the database.", 500);
  const activeCounts = {};
  for (const loan of active.data || []) activeCounts[loan.book_id] = (activeCounts[loan.book_id] || 0) + 1;
  const totalCopies = (books.data || []).reduce((sum, book) => sum + book.total_copies, 0);
  const availableCopies = (books.data || []).reduce((sum, book) => sum + Math.max(0, book.total_copies - (activeCounts[book.id] || 0)), 0);
  const today = new Date().toISOString().slice(0,10);
  res.json({ data: {
    book_titles: (books.data || []).length,
    total_copies: totalCopies,
    available_copies: availableCopies,
    active_loans: (active.data || []).length,
    overdue_loans: (active.data || []).filter(loan => loan.due_date < today).length,
    total_loan_records: loans.count || 0
  } });
}));
module.exports = router;
