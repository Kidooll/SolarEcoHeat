-- Smoke test para policies da migration 0011_client_visibility_rls.sql
-- Execute no SQL Editor do Supabase apos aplicar a migration.
--
-- Substitua os UUIDs abaixo por ids reais do ambiente:
--   :CLIENT_A_ID -> client_id do cliente A
--   :CLIENT_B_ID -> client_id do cliente B

begin;

-- =========
-- 1) ADMIN
-- =========
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'admin')
  )::text,
  true
);

select 'admin_clients_total' as check_name, count(*)::bigint as value from public.clients;
select 'admin_units_total' as check_name, count(*)::bigint as value from public.technical_units;
select 'admin_systems_total' as check_name, count(*)::bigint as value from public.systems;

-- ===============================
-- 2) CLIENTE A (deve ver apenas A)
-- ===============================
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'client', 'client_id', ':CLIENT_A_ID')
  )::text,
  true
);

select 'client_a_clients_visible' as check_name, count(*)::bigint as value from public.clients;
select 'client_a_units_visible' as check_name, count(*)::bigint as value from public.technical_units;
select 'client_a_systems_visible' as check_name, count(*)::bigint as value from public.systems;

select
  'client_a_sees_only_own_client' as check_name,
  count(*)::bigint as value
from public.clients
where id::text <> ':CLIENT_A_ID';

-- ===========================================
-- 3) CLIENTE B (nao deve ver dados do cliente A)
-- ===========================================
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'client', 'client_id', ':CLIENT_B_ID')
  )::text,
  true
);

select 'client_b_clients_visible' as check_name, count(*)::bigint as value from public.clients;
select 'client_b_units_visible' as check_name, count(*)::bigint as value from public.technical_units;
select 'client_b_systems_visible' as check_name, count(*)::bigint as value from public.systems;

select
  'client_b_sees_client_a_data' as check_name,
  count(*)::bigint as value
from public.technical_units
where client_id::text = ':CLIENT_A_ID';

-- ==================================================
-- 4) CLIENTE sem client_id valido (deve ver zero)
-- ==================================================
select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'client', 'client_id', 'INVALID-UUID')
  )::text,
  true
);

select 'client_invalid_clients_visible' as check_name, count(*)::bigint as value from public.clients;
select 'client_invalid_units_visible' as check_name, count(*)::bigint as value from public.technical_units;
select 'client_invalid_systems_visible' as check_name, count(*)::bigint as value from public.systems;

rollback;
