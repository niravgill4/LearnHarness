-- Save changed pages without sending or deleting the rest of the library.
-- Keep the legacy workspace snapshot and page records in the same transaction.
create or replace function public.save_notebook_pages(expected integer, changed_pages jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
 owner uuid := auth.uid();
 workspace_version integer;
 workspace_data jsonb;
 page jsonb;
 page_index bigint;
 seen uuid[] := array[]::uuid[];
 page_id uuid;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(changed_pages) is distinct from 'array' then raise exception 'Invalid notebook pages'; end if;
 if jsonb_array_length(changed_pages) not between 1 and 32 or octet_length(changed_pages::text) > 8000000 then
  raise exception 'Invalid notebook pages';
 end if;
 select version, data into workspace_version, workspace_data
 from public.notebook_workspaces where user_id = owner for update;
 if workspace_version is distinct from expected then raise exception 'NOTEBOOK_CONFLICT'; end if;
 for page in select value from jsonb_array_elements(changed_pages) loop
  page_id := (page->>'id')::uuid;
  if page_id is null or page_id = any(seen) then raise exception 'Invalid notebook pages'; end if;
  seen := array_append(seen, page_id);
  select ordinality - 1 into page_index
  from jsonb_array_elements(workspace_data->'pages') with ordinality as existing(value, ordinality)
  where existing.value->>'id' = page->>'id' and existing.value->>'sectionId' = page->>'sectionId';
  if not found then raise exception 'NOTEBOOK_CONFLICT'; end if;
  update public.notebook_pages set title = page->>'title', content = page
  where id = page_id and user_id = owner and section_id = (page->>'sectionId')::uuid;
  if not found then raise exception 'NOTEBOOK_CONFLICT'; end if;
  workspace_data := jsonb_set(workspace_data, array['pages', page_index::text], page, false);
 end loop;
 update public.notebook_workspaces set version = workspace_version + 1, data = workspace_data
 where user_id = owner;
 return workspace_version + 1;
end $$;
revoke all on function public.save_notebook_pages(integer,jsonb) from public,anon;
grant execute on function public.save_notebook_pages(integer,jsonb) to authenticated;
