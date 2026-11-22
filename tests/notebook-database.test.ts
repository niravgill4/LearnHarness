import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { newNotePage } from "../lib/notebook.ts";

test("notebook migration enforces private records/assets and transactional version checks in PostgreSQL", async () => {
	const db = new PGlite();
	try {
		// Supabase supplies these schemas, JWT function, roles, and default grants.
		await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
		 create table auth.users(id uuid primary key);
		 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
		 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
		 create table storage.objects(id serial primary key,bucket_id text,name text);
		 alter table storage.objects enable row level security;
		 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
		 grant usage on schema public,auth,storage to authenticated;
		 grant all on storage.objects to authenticated;grant usage,select on sequence storage.objects_id_seq to authenticated;
		 alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;`);
		await db.exec(
			await readFile(new URL("../supabase/migrations/20261116000000_notebook.sql", import.meta.url), "utf8"),
		);
		await db.exec(
			await readFile(new URL("../supabase/migrations/20261122000000_notebook_page_saves.sql", import.meta.url), "utf8"),
		);
		const a = randomUUID(),
			b = randomUUID(),
			book = randomUUID(),
			section = randomUUID();
		await db.query("insert into auth.users values($1),($2)", [a, b]);
		await db.exec("set role authenticated");
		await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
		const data = {
			notebooks: [{ id: book, title: "Physics" }],
			sections: [{ id: section, notebookId: book, title: "Work", color: "#8899aa" }],
			pages: [newNotePage(section), newNotePage(section)],
		};
		const first = await db.query<{ save_notebook: number }>("select save_notebook($1,$2::jsonb)", [
			0,
			JSON.stringify(data),
		]);
		assert.equal(first.rows[0]!.save_notebook, 1);
		await assert.rejects(
			db.query("select save_notebook($1,$2::jsonb)", [0, JSON.stringify(data)]),
			/NOTEBOOK_CONFLICT/,
		);
		const firstPage = { ...data.pages[0], title: "Updated through a patch" };
		const patch = (version: number, pages: unknown[]) => db.query<{ save_notebook_pages: number }>(
			"select save_notebook_pages($1,$2::jsonb)", [version, JSON.stringify(pages)],
		);
		assert.equal((await patch(1, [firstPage])).rows[0]?.save_notebook_pages, 2);
		await assert.rejects(patch(1, [firstPage]), /NOTEBOOK_CONFLICT/);
		await assert.rejects(patch(2, [{ ...firstPage, title: "Should roll back" }, newNotePage(section)]), /NOTEBOOK_CONFLICT/);
		const afterPatch = await db.query<{ data: typeof data }>("select data from notebook_workspaces");
		assert.deepEqual(afterPatch.rows[0]?.data.pages, [firstPage, data.pages[1]]);
		assert.equal((await db.query<{ title: string }>("select title from notebook_pages order by position")).rows[0]?.title, firstPage.title);
		await db.query("insert into storage.objects(bucket_id,name) values('notebook-assets',$1)", [
			`${a}/image`,
		]);
		await db.query("select set_config('request.jwt.claim.sub',$1,false)", [b]);
		await assert.rejects(patch(2, [firstPage]), /NOTEBOOK_CONFLICT/);
		assert.equal((await db.query("select * from notebook_pages")).rows.length, 0);
		assert.equal((await db.query("select * from notebook_workspaces")).rows.length, 0);
		assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
		await assert.rejects(
			db.query("insert into storage.objects(bucket_id,name) values('notebook-assets',$1)", [`${a}/bad`]),
			/row-level security/,
		);
		await assert.rejects(
			db.query(
				"insert into notebook_sections(id,user_id,notebook_id,title,color,position) values($1,$2,$3,'Intrusion','#112233',0)",
				[randomUUID(), b, book],
			),
			/foreign key/,
		);
		// A failed aggregate write rolls back its deletes and never damages the saved copy.
		await db.query("select set_config('request.jwt.claim.sub',$1,false)", [a]);
		await assert.rejects(
			db.query("select save_notebook($1,$2::jsonb)", [
				2,
				JSON.stringify({ ...data, pages: [{ ...data.pages[0], sectionId: randomUUID() }] }),
			]),
			/foreign key/,
		);
		assert.equal((await db.query("select * from notebook_pages")).rows.length, 2);
		assert.equal(
			(await db.query<{ version: number }>("select version from notebook_workspaces")).rows[0]!.version,
			2,
		);
	} finally {
		await db.close();
	}
});
