const express = require("express");
const supabase = require("../supabase");
const { requireAdmin } = require("../middleware/admin");
const { asyncHandler, publicError } = require("../utils/errors");
const router = express.Router();

function cleanText(value, name, max, required = false) {
  if (value == null) {
    if (required) throw publicError(`${name} is required.`);
    return null;
  }
  if (typeof value !== "string") throw publicError(`${name} must be text.`);
  const result = value.trim();
  if (required && !result) throw publicError(`${name} is required.`);
  if (result.length > max) throw publicError(`${name} must be ${max} characters or fewer.`);
  return result || null;
}
function bookInput(body, partial = false) {
  const result = {};
  for (const [field, max, required] of [["title",180,true],["author",120,true],["category",80,false],["isbn",20,false]]) {
    if (!partial || Object.hasOwn(body, field)) result[field] = cleanText(body[field], field, max, required && (!partial || Object.hasOwn(body, field)));
  }
  if (!partial || Object.hasOwn(body, "total_copies")) {
    const count = body.total_copies;
    if (!Number.isInteger(count) || count < 1 || count > 500) throw publicError("total_copies must be a whole number from 1 to 500.");
    result.total_copies = count;
  }
  if (result.isbn === "") result.isbn = null;
  return result;
}
function dbError(error) {
  if (error.code === "23505") return publicError("A book with this ISBN already exists.", 409);
  if (error.code === "23503") return publicError("This book has related loan records and cannot be deleted.", 409);
  if (error.code === "23514") return publicError("The requested change violates a database rule.", 400);
  return publicError("A database operation failed. Check the server configuration and try again.", 500);
}

router.get("/", asyncHandler(async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
  let request = supabase.from("books").select("id,title,author,category,isbn,total_copies,created_at,updated_at").order("title").limit(limit);
  if (query) request = request.or(`title.ilike.%${query.replace(/[%_,()]/g, "")}%,author.ilike.%${query.replace(/[%_,()]/g, "")}%,category.ilike.%${query.replace(/[%_,()]/g, "")}%`);
  const { data, error } = await request;
  if (error) throw dbError(error);
  const ids = (data || []).map(book => book.id);
  let counts = {};
  if (ids.length) {
    const result = await supabase.from("loans").select("book_id").is("returned_at", null).in("book_id", ids);
    if (result.error) throw dbError(result.error);
    for (const loan of result.data || []) counts[loan.book_id] = (counts[loan.book_id] || 0) + 1;
  }
  res.json({ data: (data || []).map(book => ({ ...book, on_loan: counts[book.id] || 0, available_copies: book.total_copies - (counts[book.id] || 0) })) });
}));

router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  const input = bookInput(req.body);
  const { data, error } = await supabase.from("books").insert(input).select().single();
  if (error) throw dbError(error);
  res.status(201).json({ data });
}));

router.patch("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const input = bookInput(req.body, true);
  if (!Object.keys(input).length) throw publicError("Provide at least one field to update.");
  const { data: existing, error: findError } = await supabase.from("books").select("id,total_copies").eq("id", req.params.id).maybeSingle();
  if (findError) throw dbError(findError);
  if (!existing) throw publicError("Book not found.", 404);
  if (Object.hasOwn(input, "total_copies")) {
    const { count, error } = await supabase.from("loans").select("id", { count: "exact", head: true }).eq("book_id", req.params.id).is("returned_at", null);
    if (error) throw dbError(error);
    if (input.total_copies < (count || 0)) throw publicError(`There are ${count} active loans. Total copies cannot be lower than that.`, 409);
  }
  const { data, error } = await supabase.from("books").update(input).eq("id", req.params.id).select().maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw publicError("Book not found.", 404);
  res.json({ data });
}));

router.delete("/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { count, error: countError } = await supabase.from("loans").select("id", { count: "exact", head: true }).eq("book_id", req.params.id).is("returned_at", null);
  if (countError) throw dbError(countError);
  if (count) throw publicError("This book has active loans. Record returns before deleting it.", 409);
  const { data, error } = await supabase.from("books").delete().eq("id", req.params.id).select("id").maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw publicError("Book not found.", 404);
  res.json({ data: { id: data.id, deleted: true } });
}));

module.exports = router;
