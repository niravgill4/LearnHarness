-- Private notebook workspace. Aggregate saves are transactional and versioned.
create table if not exists public.notebook_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version integer not null default 0,
 data jsonb not null default '{"notebooks":[],"sections":[],"pages":[]}'::jsonb
);
create table if not exists public.notebooks (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, position integer not null, unique(id,user_id)
);
create table if not exists public.notebook_sections (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 notebook_id uuid not null, title text not null, color text not null, position integer not null,
 unique(id,user_id), foreign key(notebook_id,user_id) references public.notebooks(id,user_id) on delete cascade
);
create table if not exists public.notebook_pages (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 section_id uuid not null, title text not null, position integer not null, content jsonb not null,
 foreign key(section_id,user_id) references public.notebook_sections(id,user_id) on delete cascade
);
alter table public.notebook_workspaces enable row level security;
alter table public.notebooks enable row level security;
alter table public.notebook_sections enable row level security;
alter table public.notebook_pages enable row level security;
create policy notebook_workspace_owner on public.notebook_workspaces for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notebook_owner on public.notebooks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notebook_section_owner on public.notebook_sections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notebook_page_owner on public.notebook_pages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index notebook_section_parent on public.notebook_sections(user_id,notebook_id);
create index notebook_page_parent on public.notebook_pages(user_id,section_id);
create or replace function public.save_notebook(expected integer, document jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare current_version integer; item jsonb; ordinal bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if octet_length(document::text) > 12000000 then raise exception 'Notebook too large'; end if;
 insert into notebook_workspaces(user_id) values(auth.uid()) on conflict do nothing;
 select version into current_version from notebook_workspaces where user_id=auth.uid() for update;
 if current_version <> expected then raise exception 'NOTEBOOK_CONFLICT'; end if;
 delete from notebook_pages where user_id=auth.uid();
 delete from notebook_sections where user_id=auth.uid();
 delete from notebooks where user_id=auth.uid();
 for item, ordinal in select value, ordinality from jsonb_array_elements(document->'notebooks') with ordinality loop
  insert into notebooks values((item->>'id')::uuid,auth.uid(),item->>'title',ordinal);
 end loop;
 for item, ordinal in select value, ordinality from jsonb_array_elements(document->'sections') with ordinality loop
  insert into notebook_sections values((item->>'id')::uuid,auth.uid(),(item->>'notebookId')::uuid,item->>'title',item->>'color',ordinal);
 end loop;
 for item, ordinal in select value, ordinality from jsonb_array_elements(document->'pages') with ordinality loop
  insert into notebook_pages values((item->>'id')::uuid,auth.uid(),(item->>'sectionId')::uuid,item->>'title',ordinal,item);
 end loop;
 update notebook_workspaces set version=current_version+1,data=document where user_id=auth.uid();
 return current_version+1;
end $$;
revoke all on function public.save_notebook(integer,jsonb) from public,anon;
grant execute on function public.save_notebook(integer,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('notebook-assets','notebook-assets',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy notebook_asset_owner on storage.objects for all to authenticated
 using(bucket_id='notebook-assets' and (storage.foldername(name))[1]=auth.uid()::text)
 with check(bucket_id='notebook-assets' and (storage.foldername(name))[1]=auth.uid()::text);
