const API = "/api";
const state = { books: [], loans: [], librarianKey: "", editing: false, toastTimer: null };
const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function dateToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function setStatus(id, message) { $(id).textContent = message || ""; }
async function api(path, options = {}) {
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
  if (state.librarianKey) headers["x-librarian-key"] = state.librarianKey;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  let payload;
  try { payload = await response.json(); } catch { payload = { error: "The server returned an unreadable response." }; }
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}
function formatDate(date) {
  if (!date) return "—";
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" });
}
function isOverdue(loan) { return !loan.returned_at && loan.due_date < dateToday(); }

async function refreshAll() {
  setStatus("catalogue-status", "Loading books…");
  setStatus("loans-status", "Loading loans…");
  try {
    const [booksPayload, dashboard, loansPayload] = await Promise.all([
      api("/books?limit=200"), api("/dashboard"), api("/loans?status=all&limit=200")
    ]);
    state.books = booksPayload.data;
    state.loans = loansPayload.data;
    $("stat-titles").textContent = dashboard.data.book_titles;
    $("stat-copies").textContent = dashboard.data.total_copies;
    $("stat-available").textContent = dashboard.data.available_copies;
    $("stat-overdue").textContent = dashboard.data.overdue_loans;
    populateCategories();
    renderBooks();
    renderLoans();
  } catch (error) {
    setStatus("catalogue-status", `Could not load library data: ${error.message}`);
    setStatus("loans-status", "Check that the server is running and Supabase is configured.");
    $("book-grid").innerHTML = "";
    $("loan-table-body").innerHTML = "";
  }
}
function populateCategories() {
  const select = $("category-filter");
  const current = select.value;
  const categories = [...new Set(state.books.map(book => book.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  select.replaceChildren(new Option("All categories", ""));
  categories.forEach(category => select.add(new Option(category, category)));
  select.value = categories.includes(current) ? current : "";
}
function renderBooks() {
  const query = $("search-input").value.trim().toLowerCase();
  const availability = $("availability-filter").value;
  const category = $("category-filter").value;
  const books = state.books.filter(book => {
    const matchesQuery = [book.title, book.author, book.isbn, book.category].some(value => String(value || "").toLowerCase().includes(query));
    const matchesAvailability = availability === "all" || (availability === "available" ? book.available_copies > 0 : book.available_copies === 0);
    return matchesQuery && matchesAvailability && (!category || book.category === category);
  });
  setStatus("catalogue-status", `${books.length} ${books.length === 1 ? "title" : "titles"} found`);
  const grid = $("book-grid");
  if (!books.length) {
    grid.innerHTML = '<div class="empty-state">No books match your search. Try another keyword or add a book in librarian mode.</div>';
    return;
  }
  grid.innerHTML = books.map(book => `
    <article class="book-card">
      <div class="book-top"><span class="book-cover" aria-hidden="true">▤</span><span class="pill ${book.available_copies ? "" : "unavailable"}">${book.available_copies ? `${book.available_copies} available` : "Unavailable"}</span></div>
      <h3>${escapeHtml(book.title)}</h3><p class="book-author">by ${escapeHtml(book.author)}</p>
      <div class="book-meta"><span class="category-tag">${escapeHtml(book.category || "Uncategorised")}</span><span class="muted">${book.total_copies} ${book.total_copies === 1 ? "copy" : "copies"}</span></div>
      ${state.librarianKey ? `<div class="card-actions"><button class="text-button" data-action="borrow" data-id="${book.id}" ${book.available_copies < 1 ? "disabled" : ""}>Issue book</button><button class="text-button" data-action="edit" data-id="${book.id}">Edit</button><button class="text-button danger" data-action="delete" data-id="${book.id}">Delete</button></div>` : ""}
    </article>`).join("");
}
function renderLoans() {
  const filter = $("loan-filter").value;
  let loans = state.loans;
  if (filter === "active") loans = loans.filter(loan => !loan.returned_at);
  if (filter === "returned") loans = loans.filter(loan => Boolean(loan.returned_at));
  if (filter === "overdue") loans = loans.filter(isOverdue);
  setStatus("loans-status", `${loans.length} loan record${loans.length === 1 ? "" : "s"}`);
  const body = $("loan-table-body");
  if (!loans.length) {
    body.innerHTML = `<tr><td colspan="${state.librarianKey ? 5 : 4}"><div class="empty-state">No loans in this view.</div></td></tr>`;
    return;
  }
  body.innerHTML = loans.map(loan => {
    const overdue = isOverdue(loan);
    const status = loan.returned_at ? "Returned" : overdue ? "Overdue" : "On loan";
    const pill = loan.returned_at ? "" : overdue ? "overdue" : "";
    return `<tr><td><strong>${escapeHtml(loan.book_title)}</strong><small>${escapeHtml(loan.book_author)}</small></td><td><strong>${escapeHtml(loan.borrower_name)}</strong><small>${escapeHtml(loan.borrower_reference || "No student ID")}</small></td><td>${formatDate(loan.due_date)}</td><td><span class="pill ${pill}">${status}</span></td>${state.librarianKey ? `<td>${loan.returned_at ? "—" : `<button class="text-button" data-action="return" data-id="${loan.id}">Record return</button>`}</td>` : ""}</tr>`;
  }).join("");
}
function setLibrarianMode(key) {
  state.librarianKey = key;
  document.querySelectorAll(".admin-only").forEach(el => el.hidden = !key);
  $("admin-toggle").textContent = key ? "Lock librarian mode" : "Librarian mode";
  renderBooks(); renderLoans();
}
function openBookDialog(book = null) {
  $("book-form").reset();
  $("book-form-error").textContent = "";
  $("book-id").value = book?.id || "";
  $("book-dialog-title").textContent = book ? "Edit book" : "Add a book";
  $("book-title").value = book?.title || "";
  $("book-author").value = book?.author || "";
  $("book-category").value = book?.category || "";
  $("book-isbn").value = book?.isbn || "";
  $("book-copies").value = book?.total_copies ?? 1;
  $("book-dialog").showModal();
}
function openLoanDialog(book) {
  $("loan-form").reset();
  $("loan-form-error").textContent = "";
  $("loan-book-id").value = book.id;
  $("loan-book-title").textContent = `${book.title} — ${book.available_copies} available`;
  $("loan-date").value = dateToday();
  const due = new Date(); due.setDate(due.getDate()+14);
  $("due-date").value = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,"0")}-${String(due.getDate()).padStart(2,"0")}`;
  $("loan-dialog").showModal();
}

$("admin-toggle").addEventListener("click", () => {
  if (state.librarianKey) {
    setLibrarianMode("");
    showToast("Librarian mode locked.");
  } else {
    $("admin-error").textContent = "";
    $("admin-key").value = "";
    $("admin-dialog").showModal();
  }
});
$("admin-form").addEventListener("submit", async event => {
  event.preventDefault();
  const key = $("admin-key").value;
  try {
    await api("/admin/check", { headers: { "x-librarian-key": key } });
    setLibrarianMode(key);
    $("admin-dialog").close();
    showToast("Librarian mode unlocked.");
    await refreshAll();
  } catch (error) { $("admin-error").textContent = error.message; }
});
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
$("add-book-button").addEventListener("click", () => openBookDialog());
$("book-form").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("book-id").value;
  const body = {
    title: $("book-title").value.trim(), author: $("book-author").value.trim(),
    category: $("book-category").value.trim(), isbn: $("book-isbn").value.trim() || null,
    total_copies: Number($("book-copies").value)
  };
  try {
    await api(id ? `/books/${id}` : "/books", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
    $("book-dialog").close();
    showToast(id ? "Book updated." : "Book added.");
    await refreshAll();
  } catch (error) { $("book-form-error").textContent = error.message; }
});
$("loan-form").addEventListener("submit", async event => {
  event.preventDefault();
  const body = {
    book_id: $("loan-book-id").value, borrower_name: $("borrower-name").value.trim(),
    borrower_reference: $("borrower-reference").value.trim() || null,
    issue_date: $("loan-date").value, due_date: $("due-date").value
  };
  try {
    await api("/loans", { method: "POST", body: JSON.stringify(body) });
    $("loan-dialog").close();
    showToast("Loan recorded.");
    await refreshAll();
  } catch (error) { $("loan-form-error").textContent = error.message; }
});
document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === "borrow") {
      const book = state.books.find(item => item.id === id);
      if (book) openLoanDialog(book);
    } else if (action === "edit") {
      const book = state.books.find(item => item.id === id);
      if (book) openBookDialog(book);
    } else if (action === "delete") {
      const book = state.books.find(item => item.id === id);
      if (book && confirm(`Delete "${book.title}"? This cannot be undone.`)) {
        await api(`/books/${id}`, { method: "DELETE" });
        showToast("Book deleted."); await refreshAll();
      }
    } else if (action === "return") {
      if (confirm("Record this book as returned?")) {
        await api(`/loans/${id}/return`, { method: "POST", body: "{}" });
        showToast("Return recorded."); await refreshAll();
      }
    }
  } catch (error) { showToast(error.message); }
});
$("search-input").addEventListener("input", renderBooks);
$("availability-filter").addEventListener("change", renderBooks);
$("category-filter").addEventListener("change", renderBooks);
$("loan-filter").addEventListener("change", renderLoans);
$("loan-date").addEventListener("change", () => {
  if ($("due-date").value < $("loan-date").value) $("due-date").value = $("loan-date").value;
});
refreshAll();
