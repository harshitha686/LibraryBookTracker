-- Library Book Tracker database schema
-- Run this complete file in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title varchar(180) not null check (length(trim(title)) > 0),
  author varchar(120) not null check (length(trim(author)) > 0),
  category varchar(80),
  isbn varchar(20) unique,
  total_copies integer not null default 1 check (total_copies between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  borrower_name varchar(120) not null check (length(trim(borrower_name)) > 0),
  borrower_reference varchar(60),
  issue_date date not null,
  due_date date not null,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_loan_dates check (due_date >= issue_date)
);

create index if not exists books_title_idx on public.books (title);
create index if not exists books_author_idx on public.books (author);
create index if not exists books_category_idx on public.books (category);
create index if not exists loans_book_id_idx on public.loans (book_id);
create index if not exists loans_active_due_date_idx on public.loans (due_date) where returned_at is null;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at before update on public.books
for each row execute function public.set_updated_at();

-- RLS blocks direct client access. The Express backend uses a secret key on
-- the server only and checks the librarian key before every write operation.
alter table public.books enable row level security;
alter table public.loans enable row level security;
revoke all on public.books from anon, authenticated;
revoke all on public.loans from anon, authenticated;

-- Transactional checkout: lock the book row so concurrent checkouts cannot
-- both claim the final copy. Only the server's privileged client should call it.
create or replace function public.checkout_book(
  p_book_id uuid,
  p_borrower_name text,
  p_borrower_reference text,
  p_issue_date date,
  p_due_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_book public.books%rowtype;
  active_count integer;
  new_loan public.loans%rowtype;
begin
  if p_borrower_name is null or length(trim(p_borrower_name)) = 0 or length(p_borrower_name) > 120 then
    raise exception using errcode = '22023', message = 'A valid borrower name is required.';
  end if;
  if p_due_date < p_issue_date then
    raise exception using errcode = '23514', message = 'Due date cannot be earlier than issue date.';
  end if;

  select * into selected_book from public.books where id = p_book_id for update;
  if not found then
    raise exception using errcode = '23503', message = 'The selected book does not exist.';
  end if;

  select count(*) into active_count from public.loans
  where book_id = p_book_id and returned_at is null;

  if active_count >= selected_book.total_copies then
    raise exception using errcode = 'P0001', message = 'No copies of this book are currently available.';
  end if;

  insert into public.loans(book_id, borrower_name, borrower_reference, issue_date, due_date)
  values (p_book_id, trim(p_borrower_name), nullif(trim(p_borrower_reference), ''), p_issue_date, p_due_date)
  returning * into new_loan;

  return jsonb_build_object(
    'id', new_loan.id, 'book_id', new_loan.book_id,
    'borrower_name', new_loan.borrower_name,
    'issue_date', new_loan.issue_date, 'due_date', new_loan.due_date,
    'returned_at', new_loan.returned_at
  );
end;
$$;

revoke all on function public.checkout_book(uuid, text, text, date, date) from public, anon, authenticated;
grant execute on function public.checkout_book(uuid, text, text, date, date) to service_role;

-- Optional demo data: uncomment these inserts once if you want example titles.
-- ISBN values are unique, so do not repeatedly insert the same ISBN.
-- insert into public.books (title, author, category, isbn, total_copies) values
-- ('Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography', '9788173711466', 3),
-- ('The Alchemist', 'Paulo Coelho', 'Fiction', '9780061122415', 2),
-- ('Introduction to Algorithms', 'Thomas H. Cormen et al.', 'Computer Science', '9780262046305', 2);
