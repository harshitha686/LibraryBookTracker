# Library Book Tracker

A beginner-friendly full-stack library catalogue and loan-management application built with HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js and Supabase PostgreSQL.

## 1. Overview

Libraries need a reliable way to find books, see how many copies are available, and track loans and returns. This app provides a searchable catalogue, a summary dashboard, and a loan register backed by a PostgreSQL database.

### Objectives
- Store book details persistently in Supabase PostgreSQL.
- Search books by title, author, category, and ISBN.
- Let an authorized librarian add, edit, and delete book records.
- Record book issues and returns.
- Show available copies and overdue active loans.
- Demonstrate a simple REST API and responsive web interface.

### Users and access
- **Visitor:** Can browse and search the catalogue and see the dashboard and loan register.
- **Librarian:** Can add/edit/delete books and record loans/returns after entering the server-configured librarian key.

This is a teaching/demo access model, not production-grade user authentication. A shared key is not suitable for a public deployment. For production, replace it with individual accounts and role-based authorization.

## 2. Features
- Responsive dashboard with title, copy, availability and overdue counts.
- Search and category/availability filters.
- Book creation, editing, and deletion with server-side validation.
- Issue and return workflow.
- Overdue loan identification.
- Supabase PostgreSQL persistence.
- Backend rate limiting, security headers, limited JSON request size, safe HTML escaping, and centralized JSON errors.
- RLS enabled with no direct anonymous/authenticated table access. The server uses its secret key only on the backend.

## 3. Technology stack
- HTML5, CSS3, Vanilla JavaScript
- Node.js 20 or newer and Express.js
- Supabase PostgreSQL and `@supabase/supabase-js`
- `dotenv` for environment variables, `helmet` for security headers, and `express-rate-limit` for basic API rate limiting
- Git and GitHub

No frontend framework or paid API is required.

## 4. Folder structure

```text
library-book-tracker/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── books.js
│   │   ├── loans.js
│   │   └── dashboard.js
│   ├── middleware/
│   │   └── admin.js
│   ├── utils/
│   │   └── errors.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

`package-lock.json` is generated when you run `npm install`; commit it to keep dependency versions reproducible.

## 5. Prerequisites

Install:
- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js LTS](https://nodejs.org/) (npm is included)
- [Git](https://git-scm.com/downloads)
- A free [Supabase account](https://supabase.com/)

In a new terminal, verify installations:

```bash
node --version
npm --version
git --version
```

Node should be version 20 or newer.

## 6. Setup from an empty folder

### Step 1 — Create/open the project folder
Create a folder named `library-book-tracker`, open it in VS Code, then create `frontend`, `backend`, and `database` folders. Create the files listed in the folder tree and paste in their contents.

### Step 2 — Create the Supabase project
1. Sign in at https://supabase.com/ and create a new project.
2. Choose a project name and a strong database password. Save it privately.
3. Wait for the database to finish provisioning.
4. In the project dashboard, open **SQL Editor** and create a new query.
5. Copy the full contents of `database/schema.sql`, paste it into the SQL Editor, and run it.
6. Open **Table Editor** and confirm that `books` and `loans` exist.
7. Open **Project Settings → API** (the exact menu labels may change) and copy the Project URL and the server-side secret key. Use a secret/service-role key only on the backend. Never put it in frontend code or GitHub.

### Step 3 — Configure environment variables
Inside `backend/`, copy `.env.example` to a new file named `.env`.

Fill in your own values:

```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_REAL_SERVER_SIDE_SECRET_KEY
LIBRARIAN_API_KEY=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS_LONG
```

- `SUPABASE_URL`: URL of your Supabase project.
- `SUPABASE_SECRET_KEY`: privileged server-side key for this project. Do not share it or commit it.
- `LIBRARIAN_API_KEY`: secret required for librarian actions. Generate one with Node.js from the `backend` directory:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `.env`. The values in `.env.example` are placeholders and will not connect to a real project. Never commit `.env`.

### Step 4 — Install dependencies
Open the VS Code terminal (**Terminal → New Terminal**). Run:

```bash
cd backend
npm install
```

npm downloads the dependencies and generates `package-lock.json`. A successful install returns to the prompt without an `npm ERR!` message.

### Step 5 — Check and start the server
From the `backend` folder, run:

```bash
npm run check
npm start
```

The syntax check should finish without errors. The server should print:

```text
Library Book Tracker running at http://localhost:3000
```

Keep this terminal running. If port 3000 is busy, change `PORT` in `backend/.env` and use the new port in the browser.

### Step 6 — Open the application
Visit http://localhost:3000. The backend serves the `frontend/` folder. Do not open `index.html` directly from File Explorer because API calls need the Express server.

Visit http://localhost:3000/api/health to verify that the server responds with a JSON status of `ok`.

### Step 7 — Use the app
1. Search for books using the search box.
2. If the catalogue is empty, select **Librarian mode** and enter the `LIBRARIAN_API_KEY` from `backend/.env`.
3. Add one or more books.
4. Use **Issue book** to enter a borrower's name and due date.
5. Open the loan register and record the return.
6. Refresh the page. The database-backed information should still be present.

### Optional demo data
The three sample book inserts at the bottom of `database/schema.sql` are commented out. Uncomment and run them once if you want sample titles. They are demo records and can be replaced with your own. Avoid running the same ISBN inserts repeatedly because ISBN is unique.

## 7. Architecture

The browser loads static HTML, CSS, and JavaScript from Express. Browser JavaScript uses `fetch()` to call `/api/...`. Express validates the request, verifies the librarian key for write operations, and uses the Supabase client to query PostgreSQL. PostgreSQL stores the records permanently.

The browser never receives the Supabase secret key. RLS is enabled and direct `anon`/`authenticated` table grants are revoked. The backend's privileged client bypasses RLS, so every write route must enforce authorization; do not add a write route without its authorization middleware.

## 8. REST API reference

All responses are JSON. Successful list endpoints use `{ "data": [...] }`; single-resource endpoints use `{ "data": {...} }`. Errors use `{ "error": "Helpful message" }`.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Health check | Public |
| GET | `/api/admin/check` | Verify librarian key | Key in `x-librarian-key` header |
| GET | `/api/books?q=&limit=` | List/search books with availability | Public |
| POST | `/api/books` | Create a book | Librarian key |
| PATCH | `/api/books/:id` | Update supplied book fields | Librarian key |
| DELETE | `/api/books/:id` | Delete a book with no active loans | Librarian key |
| GET | `/api/loans?status=active\|returned\|overdue\|all&limit=` | List loan records | Public |
| POST | `/api/loans` | Issue a book | Librarian key |
| POST | `/api/loans/:id/return` | Record a return | Librarian key |
| GET | `/api/dashboard` | Read summary statistics | Public |

### Request examples

Create a book:

```json
{
  "title": "Example Book",
  "author": "A. Student",
  "category": "Science",
  "isbn": "9780000000002",
  "total_copies": 3
}
```

Issue a book:

```json
{
  "book_id": "UUID_FROM_THE_BOOK_CATALOGUE",
  "borrower_name": "Demo Student",
  "borrower_reference": "STU-001",
  "issue_date": "2026-10-26",
  "due_date": "2026-11-09"
}
```

Protected requests must include `x-librarian-key: YOUR_LIBRARIAN_API_KEY`. The browser adds it after librarian mode is unlocked. Do not paste real keys into public screenshots or shared messages.

### Common status codes
- `200`: request succeeded.
- `201`: record created.
- `400`: invalid input.
- `401`: librarian key missing or invalid.
- `404`: requested record or endpoint not found.
- `409`: conflict, such as unavailable copies or a duplicate ISBN.
- `413`: request body too large.
- `429`: API rate limit exceeded.
- `500`: unexpected server/database configuration error.

## 9. Database design and integrity

- `books` stores titles, authors, category, optional unique ISBN, total copies, and timestamps.
- `loans` references `books.id`, stores borrower and date fields, and uses `returned_at` to distinguish active loans from returned loans.
- Foreign keys prevent deleting books that have loan history.
- Check constraints prevent invalid copy counts and due dates earlier than issue dates.
- The `checkout_book` PostgreSQL function locks the selected book row while checking availability and creating the loan, preventing concurrent requests from issuing more copies than the library owns.
- Available copies are calculated from total copies minus active loans; they are not a separately editable field.

## 10. Security notes and limitations

- This demonstration uses a shared librarian key rather than individual accounts. Anyone who knows the key can act as a librarian. Do not deploy it as-is to a public network.
- The server-side Supabase secret key bypasses RLS. Keep it in `backend/.env`, restrict write endpoints, and never expose it in browser code.
- The app has no individual user accounts, fine-grained staff roles, email notifications, fines, reservations, or audit log in this MVP.
- API rate limiting and Helmet are basic safeguards, not a replacement for a production security review.
- The browser temporarily holds the librarian key in page memory while unlocked; refreshing the page locks librarian mode again.
- Public catalogue and loan-register reads mean borrower names are visible to anyone who can access the app. Use fictional demo names only, or restrict the loan API before using real borrower data.
- Future improvements: individual librarian authentication, private borrower records, pagination, audit history, reservation queue, and automated tests.

## 11. Manual testing checklist

| Test | Steps | Expected result |
|---|---|---|
| Server health | Open `/api/health` | JSON reports `status: ok`. |
| Empty database | Open app with no books | Empty state appears, not a crash. |
| Create book | Unlock librarian mode and save valid details | Book appears in catalogue and title count updates. |
| Required fields | Submit a book with blank title/author | Browser/server rejects the request with a clear message. |
| Duplicate ISBN | Add two books with the same ISBN | Second request receives a conflict error. |
| Search/filter | Search by a title/author and change category | Only matching titles are shown. |
| Issue book | Issue an available copy with valid dates | Loan appears; available-copy count decreases. |
| No copies left | Attempt to issue more loans than total copies | API returns a conflict; stock is not over-issued. |
| Invalid due date | Set due date earlier than issue date | Request is rejected. |
| Unauthorized write | Call `POST /api/books` without key | HTTP 401. |
| Edit copies | Set total copies below active loan count | API rejects the update. |
| Return book | Record return for an active loan | Loan status becomes returned and availability increases. |
| Repeat return | Return the same loan again | API reports a conflict. |
| Delete active loan book | Try deleting a book with active loans | API refuses deletion. |
| Persistence | Refresh the page after adding records | Records remain because they are stored in PostgreSQL. |
| Responsive layout | Test narrow and wide browser windows | Cards/forms adapt without horizontal page overflow. |

No remote Supabase connection is verified merely by downloading this project. Complete these tests after configuring your own credentials.

## 12. Troubleshooting

- **`Missing SUPABASE_URL or SUPABASE_SECRET_KEY`:** Check that `backend/.env` exists and variable names match exactly. Restart the server after changing it.
- **Server reports missing/short librarian key:** Generate a 32-byte random key and place it in `LIBRARIAN_API_KEY`.
- **`Invalid API key` / 401:** Use the exact librarian key from `.env`, without extra spaces. Lock and unlock librarian mode again.
- **Database errors / 500:** Confirm the Supabase project URL and server-side key. Confirm that the SQL schema ran successfully and both tables exist.
- **`relation does not exist`:** Run `database/schema.sql` in the correct Supabase project's SQL Editor.
- **Checkout RPC error:** Ensure the `checkout_book` function from the supplied schema exists. Re-run the schema if the function is missing.
- **Port already in use:** Change `PORT=3001` in `.env`, restart, and open `http://localhost:3001`.
- **`npm` is not recognized:** Reinstall Node.js LTS and restart the terminal/VS Code.
- **Page opens but data fails:** Keep the Node server running and check `http://localhost:3000/api/health`, then inspect the terminal for errors.
- **`npm run check` fails:** Ensure you are in the `backend` directory and all listed files were created at the correct paths.

## 13. GitHub upload

1. Create a new empty repository on https://github.com/ (do not add a README if you already have this one).
2. From the project root, open a terminal and run:

```bash
git init
git status
git add .
git status
git commit -m "Build Library Book Tracker"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the repository URL GitHub provides, for example the HTTPS URL of your own repository. If Git asks for your name/email, configure them with `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"` using your own details.

Before `git add .`, verify that `backend/.env` is ignored and `backend/.env.example` is included. Run `git status --ignored` if unsure. Never commit `.env`, `node_modules/`, private borrower data, database exports, or screenshots showing credentials. Verify the repository page after pushing and confirm source files are present without secrets.

**Important:** `.gitignore` does not remove a secret that was committed previously. If you expose a key, rotate it immediately in Supabase and replace the librarian key; remove the leaked secret from repository history as appropriate before making the repository public.

## 14. Final verification checklist

- [ ] `frontend/`, `backend/`, and `database/` use the required names.
- [ ] Express serves the frontend from `frontend/`.
- [ ] Frontend API paths match Express routes.
- [ ] SQL table/column names match backend queries.
- [ ] Supabase credentials are only in `backend/.env`.
- [ ] `.env` and `node_modules/` are ignored by Git.
- [ ] RLS is enabled and direct client table grants are revoked.
- [ ] All write routes check librarian authorization.
- [ ] Checkout uses a PostgreSQL row lock and database transaction.
- [ ] Manual tests pass against your configured Supabase project.
