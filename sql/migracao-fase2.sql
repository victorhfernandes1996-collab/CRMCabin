-- CabinCraft CRM — Fase 2: permissões por vendedor, atividades completas e contatos
-- Rode no SQL Editor DEPOIS do tudo-em-um.sql. Pode rodar mais de uma vez.

-- ===== Atividades: tipo, horário e dono =====
alter table public.tarefas add column if not exists tipo text not null default 'tarefa';
alter table public.tarefas add column if not exists hora time;
alter table public.tarefas add column if not exists owner uuid references public.profiles(id) default auth.uid();
update public.tarefas t set owner = coalesce(
  (select n.owner from public.negocios n where n.id = t.negocio_id),
  (select c.owner from public.clientes c where c.id = t.cliente_id))
where t.owner is null;

-- ===== Contatos por cliente (igreja) =====
create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  nome text not null, cargo text, telefone text, email text,
  created_at timestamptz default now()
);
alter table public.contatos enable row level security;

-- ===== Permissões: vendedor vê só o que é dele; admin vê tudo =====
drop policy if exists "aprovados: clientes"  on public.clientes;
drop policy if exists "aprovados: negocios"  on public.negocios;
drop policy if exists "aprovados: tarefas"   on public.tarefas;
drop policy if exists "aprovados: propostas" on public.propostas;
drop policy if exists "aprovados: historico" on public.historico;
drop policy if exists "donos: clientes ver" on public.clientes;
drop policy if exists "donos: clientes inserir" on public.clientes;
drop policy if exists "donos: clientes editar" on public.clientes;
drop policy if exists "donos: clientes apagar" on public.clientes;
drop policy if exists "donos: negocios" on public.negocios;
drop policy if exists "donos: tarefas" on public.tarefas;
drop policy if exists "donos: propostas" on public.propostas;
drop policy if exists "donos: historico" on public.historico;
drop policy if exists "donos: contatos" on public.contatos;

-- Cliente: vê se é dono, admin, ou se tem negócio visível para você; só edita se for dono/admin
create policy "donos: clientes ver" on public.clientes for select using (
  public.is_approved() and (owner = auth.uid() or public.is_admin()
    or exists (select 1 from public.negocios n where n.cliente_id = clientes.id)));
create policy "donos: clientes inserir" on public.clientes for insert with check (
  public.is_approved() and (owner = auth.uid() or public.is_admin()));
create policy "donos: clientes editar" on public.clientes for update using (
  public.is_approved() and (owner = auth.uid() or public.is_admin()));
create policy "donos: clientes apagar" on public.clientes for delete using (
  public.is_approved() and (owner = auth.uid() or public.is_admin()));

create policy "donos: negocios" on public.negocios for all
  using (public.is_approved() and (owner = auth.uid() or public.is_admin()))
  with check (public.is_approved() and (owner = auth.uid() or public.is_admin()));

create policy "donos: tarefas" on public.tarefas for all
  using (public.is_approved() and (owner = auth.uid() or public.is_admin()))
  with check (public.is_approved() and (owner = auth.uid() or public.is_admin()));

-- Propostas, histórico e contatos seguem a visibilidade do negócio / cliente
create policy "donos: propostas" on public.propostas for all
  using (public.is_approved() and (public.is_admin()
    or exists (select 1 from public.negocios n where n.id = propostas.negocio_id)))
  with check (public.is_approved() and (public.is_admin()
    or exists (select 1 from public.negocios n where n.id = propostas.negocio_id)));

create policy "donos: historico" on public.historico for all
  using (public.is_approved() and (public.is_admin()
    or exists (select 1 from public.negocios n where n.id = historico.negocio_id)))
  with check (public.is_approved() and (public.is_admin()
    or exists (select 1 from public.negocios n where n.id = historico.negocio_id)));

create policy "donos: contatos" on public.contatos for all
  using (public.is_approved() and exists (select 1 from public.clientes c where c.id = contatos.cliente_id))
  with check (public.is_approved() and exists (select 1 from public.clientes c where c.id = contatos.cliente_id));
