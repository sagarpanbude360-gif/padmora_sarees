-- Supabase lock-down (NOT YET APPLIED: review, try it on a Supabase branch first, then apply in a quiet moment).
--
-- Why: this shop's server is the only thing that talks to the database, and it uses the service_role key. The two public database roles
-- ("anon" = anyone holding the project's public key, "authenticated") should therefore be able to do NOTHING in the public schema.
-- Today they are protected only by Row Level Security: every table has RLS on with no policy (so reads and writes are denied), but
--   * the view public.products_blended is not covered by RLS and runs with its owner's rights (Supabase security advisor: ERROR),
--   * anon / authenticated still hold full table privileges (including TRUNCATE) and EXECUTE on every function (place_order, ...),
--   * 11 functions have a mutable search_path (advisor: WARN).
-- One missed table or policy in the future would then be an open door. This closes the doors that RLS leaves unlocked.
--
-- What it changes for the shop: nothing. The server uses service_role, which keeps all of its rights.

begin;

-- 1. the view reads with the caller's rights, so RLS on the tables underneath applies to it
alter view public.products_blended set (security_invoker = true);

-- 2. the public roles get no access to anything in the public schema
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- 3. the server's role keeps everything (these are already granted; repeated so this file is self-contained)
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- 4. things created in the future get the same treatment (default privileges belong to the role that creates the object)
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 5. functions use a fixed search path (stops a function from being tricked into using another schema's objects)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- VERIFY (each should return what the comment says)
--   select has_table_privilege('anon', 'public.orders', 'select');                         -- false
--   select has_table_privilege('authenticated', 'public.users', 'select');                 -- false
--   select has_table_privilege('service_role', 'public.orders', 'select, insert, update, delete');   -- true
--   select has_function_privilege('anon', 'public.place_order(text,text,integer,integer,real,real,integer,text,text,text,text,text,text,text,text,text,jsonb)', 'execute');  -- false
--   select has_function_privilege('service_role', 'public.place_order(text,text,integer,integer,real,real,integer,text,text,text,text,text,text,text,text,text,jsonb)', 'execute');  -- true
--   select reloptions from pg_class where oid = 'public.products_blended'::regclass;       -- {security_invoker=true}
--   Then: open the shop, a product page, add to bag, check out in test mode, open the admin: everything works as before;
--   and the Supabase "Security Advisor" no longer lists security_definer_view or function_search_path_mutable.
--   From outside, with only the public (anon) key:   GET <project-url>/rest/v1/products  ->  401/403 or an empty/denied answer.
--
-- ROLLBACK (puts back what Supabase grants by default)
--   begin;
--   alter view public.products_blended set (security_invoker = false);
--   grant all on all tables    in schema public to anon, authenticated;
--   grant all on all sequences in schema public to anon, authenticated;
--   grant execute on all functions in schema public to public, anon, authenticated;
--   alter default privileges for role postgres in schema public grant all on tables    to anon, authenticated;
--   alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
--   alter default privileges for role postgres in schema public grant execute on functions to public, anon, authenticated;
--   commit;
--   (search_path settings are harmless to keep; to remove: alter function <name>(<args>) reset search_path;)
