-- RLS para visibilidade de dados por cliente
-- Objetivo: permitir que usuário com role=client veja apenas dados do próprio client_id.

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select lower(
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() ->> 'role',
      ''
    )
  );
$$;

create or replace function public.current_client_id()
returns uuid
language plpgsql
stable
as $$
declare
  raw_client_id text;
begin
  raw_client_id := coalesce(
    auth.jwt() -> 'app_metadata' ->> 'client_id',
    auth.jwt() -> 'user_metadata' ->> 'client_id',
    ''
  );

  if raw_client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return raw_client_id::uuid;
  end if;

  return null;
end;
$$;

alter table public.clients enable row level security;
alter table public.technical_units enable row level security;
alter table public.systems enable row level security;
alter table public.components enable row level security;
alter table public.attendances enable row level security;
alter table public.system_maintenances enable row level security;
alter table public.occurrences enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_payment_terms enable row level security;
alter table public.quote_payment_installments enable row level security;
alter table public.contracts enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "Admin full clients access" on public.clients;
create policy "Admin full clients access"
on public.clients
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full technical_units access" on public.technical_units;
create policy "Admin full technical_units access"
on public.technical_units
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full systems access" on public.systems;
create policy "Admin full systems access"
on public.systems
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full components access" on public.components;
create policy "Admin full components access"
on public.components
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full attendances access" on public.attendances;
create policy "Admin full attendances access"
on public.attendances
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full system_maintenances access" on public.system_maintenances;
create policy "Admin full system_maintenances access"
on public.system_maintenances
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full occurrences access" on public.occurrences;
create policy "Admin full occurrences access"
on public.occurrences
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full quotes access" on public.quotes;
create policy "Admin full quotes access"
on public.quotes
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full quote_items access" on public.quote_items;
create policy "Admin full quote_items access"
on public.quote_items
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full quote_payment_terms access" on public.quote_payment_terms;
create policy "Admin full quote_payment_terms access"
on public.quote_payment_terms
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full quote_payment_installments access" on public.quote_payment_installments;
create policy "Admin full quote_payment_installments access"
on public.quote_payment_installments
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full contracts access" on public.contracts;
create policy "Admin full contracts access"
on public.contracts
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Admin full transactions access" on public.transactions;
create policy "Admin full transactions access"
on public.transactions
for all
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "Client read own client" on public.clients;
create policy "Client read own client"
on public.clients
for select
using (
  public.current_app_role() = 'client'
  and id = public.current_client_id()
);

drop policy if exists "Client read own technical units" on public.technical_units;
create policy "Client read own technical units"
on public.technical_units
for select
using (
  public.current_app_role() = 'client'
  and client_id = public.current_client_id()
);

drop policy if exists "Client read own systems" on public.systems;
create policy "Client read own systems"
on public.systems
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.technical_units tu
    where tu.id = systems.unit_id
      and tu.client_id = public.current_client_id()
  )
);

drop policy if exists "Client read own components" on public.components;
create policy "Client read own components"
on public.components
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.systems s
    join public.technical_units tu on tu.id = s.unit_id
    where s.id = components.system_id
      and tu.client_id = public.current_client_id()
  )
);

drop policy if exists "Client read own attendances" on public.attendances;
create policy "Client read own attendances"
on public.attendances
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.technical_units tu
    where tu.id = attendances.unit_id
      and tu.client_id = public.current_client_id()
  )
);

drop policy if exists "Client read own system maintenances" on public.system_maintenances;
create policy "Client read own system maintenances"
on public.system_maintenances
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.attendances a
    join public.technical_units tu on tu.id = a.unit_id
    where a.id = system_maintenances.attendance_id
      and tu.client_id = public.current_client_id()
  )
);

drop policy if exists "Client read own occurrences" on public.occurrences;
create policy "Client read own occurrences"
on public.occurrences
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.systems s
    join public.technical_units tu on tu.id = s.unit_id
    where s.id = occurrences.system_id
      and tu.client_id = public.current_client_id()
  )
);

drop policy if exists "Client read own quotes" on public.quotes;
create policy "Client read own quotes"
on public.quotes
for select
using (
  public.current_app_role() = 'client'
  and (
    quotes.client_id = public.current_client_id()
    or exists (
      select 1
      from public.occurrences o
      join public.systems s on s.id = o.system_id
      join public.technical_units tu on tu.id = s.unit_id
      where o.id = quotes.occurrence_id
        and tu.client_id = public.current_client_id()
    )
  )
);

drop policy if exists "Client read own quote items" on public.quote_items;
create policy "Client read own quote items"
on public.quote_items
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.quotes q
    where q.id = quote_items.quote_id
      and (
        q.client_id = public.current_client_id()
        or exists (
          select 1
          from public.occurrences o
          join public.systems s on s.id = o.system_id
          join public.technical_units tu on tu.id = s.unit_id
          where o.id = q.occurrence_id
            and tu.client_id = public.current_client_id()
        )
      )
  )
);

drop policy if exists "Client read own quote payment terms" on public.quote_payment_terms;
create policy "Client read own quote payment terms"
on public.quote_payment_terms
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.quotes q
    where q.id = quote_payment_terms.quote_id
      and (
        q.client_id = public.current_client_id()
        or exists (
          select 1
          from public.occurrences o
          join public.systems s on s.id = o.system_id
          join public.technical_units tu on tu.id = s.unit_id
          where o.id = q.occurrence_id
            and tu.client_id = public.current_client_id()
        )
      )
  )
);

drop policy if exists "Client read own quote payment installments" on public.quote_payment_installments;
create policy "Client read own quote payment installments"
on public.quote_payment_installments
for select
using (
  public.current_app_role() = 'client'
  and exists (
    select 1
    from public.quotes q
    where q.id = quote_payment_installments.quote_id
      and (
        q.client_id = public.current_client_id()
        or exists (
          select 1
          from public.occurrences o
          join public.systems s on s.id = o.system_id
          join public.technical_units tu on tu.id = s.unit_id
          where o.id = q.occurrence_id
            and tu.client_id = public.current_client_id()
        )
      )
  )
);

drop policy if exists "Client read own contracts" on public.contracts;
create policy "Client read own contracts"
on public.contracts
for select
using (
  public.current_app_role() = 'client'
  and contracts.client_id = public.current_client_id()
);

drop policy if exists "Client read own transactions" on public.transactions;
create policy "Client read own transactions"
on public.transactions
for select
using (
  public.current_app_role() = 'client'
  and (
    transactions.client_id = public.current_client_id()
    or exists (
      select 1
      from public.quotes q
      where q.id = transactions.quote_id
        and (
          q.client_id = public.current_client_id()
          or exists (
            select 1
            from public.occurrences o
            join public.systems s on s.id = o.system_id
            join public.technical_units tu on tu.id = s.unit_id
            where o.id = q.occurrence_id
              and tu.client_id = public.current_client_id()
          )
        )
    )
    or exists (
      select 1
      from public.contracts c
      where c.id = transactions.contract_id
        and c.client_id = public.current_client_id()
    )
  )
);
