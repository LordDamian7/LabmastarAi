-- LabMaster AI schema: per-user progress, chat history, study materials,
-- AI usage ledger (rate limiting) and a private storage bucket. Every table is
-- protected by row-level security so users only ever see their own rows.

-- Per-user gamified progress (level, xp, scores, badges, daily goals) as one JSON document.
create table public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_user_created_idx on public.chat_messages (user_id, created_at);

-- Uploaded study files. The original file lives in Storage (storage_path);
-- extracted text is cached here so RAG doesn't re-parse on every request.
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  storage_path text not null,
  content text,
  summary text,
  pages int,
  words int,
  created_at timestamptz not null default now()
);
create index study_materials_user_created_idx on public.study_materials (user_id, created_at);

-- Ledger of AI calls, used for per-user rate limiting.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

alter table public.user_progress enable row level security;
alter table public.chat_messages enable row level security;
alter table public.study_materials enable row level security;
alter table public.ai_usage enable row level security;

create policy "own progress" on public.user_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own chat" on public.chat_messages for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own materials" on public.study_materials for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Users may read their own usage; writes only happen through consume_ai_quota.
create policy "read own usage" on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);

-- Atomically check the caller's hourly/daily AI quota and record one call if allowed.
-- SECURITY DEFINER is intentional: it only ever writes a row for auth.uid(), so a
-- user calling it directly can at most spend their own quota.
create function public.consume_ai_quota(p_kind text, p_hourly_limit int, p_daily_limit int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hourly int;
  daily int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- Serialize concurrent requests from the same user so the count can't be raced.
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
    into hourly, daily
    from public.ai_usage
   where user_id = uid and created_at > now() - interval '1 day';
  if hourly >= p_hourly_limit or daily >= p_daily_limit then
    return jsonb_build_object('allowed', false, 'hourly', hourly, 'daily', daily);
  end if;
  insert into public.ai_usage (user_id, kind) values (uid, p_kind);
  return jsonb_build_object('allowed', true, 'hourly', hourly + 1, 'daily', daily + 1);
end;
$$;
revoke execute on function public.consume_ai_quota(text, int, int) from public, anon;
grant execute on function public.consume_ai_quota(text, int, int) to authenticated;

-- Private bucket for study files; each user writes under a folder named by their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-materials', 'study-materials', false, 20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/markdown', 'text/csv', 'application/json',
    'image/jpeg', 'image/png'
  ]
);

create policy "read own study files" on storage.objects for select to authenticated
  using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "upload own study files" on storage.objects for insert to authenticated
  with check (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own study files" on storage.objects for delete to authenticated
  using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
