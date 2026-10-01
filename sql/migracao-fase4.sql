-- CabinCraft CRM — Fase 4: catálogo de produtos e metas
-- Rode no SQL Editor DEPOIS do migracao-fase3.sql. Pode rodar mais de uma vez.

-- ===== Catálogo de produtos (só o admin edita; todos os aprovados leem) =====
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null, descricao text,
  preco numeric not null default 0,
  ativo boolean not null default true,
  created_at timestamptz default now()
);
alter table public.produtos enable row level security;
drop policy if exists "produtos: ver" on public.produtos;
drop policy if exists "produtos: admin escreve" on public.produtos;
create policy "produtos: ver" on public.produtos for select using (public.is_approved());
create policy "produtos: admin escreve" on public.produtos for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.produtos (nome, descricao, preco)
select 'Cabine 180º - Fixo', 'Cabine 180º com piso fixo (instalação permanente)', 9900
where not exists (select 1 from public.produtos where nome = 'Cabine 180º - Fixo');
insert into public.produtos (nome, descricao, preco)
select 'Cabine 180º - Móvel', 'Cabine 180º com piso móvel sobre rodas reforçadas', 10800
where not exists (select 1 from public.produtos where nome = 'Cabine 180º - Móvel');

-- ===== Metas mensais por vendedor (só o admin define; vendedor vê a própria) =====
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.profiles(id) on delete cascade,
  mes date not null,
  valor numeric not null default 0,
  unique (vendedor_id, mes)
);
alter table public.metas enable row level security;
drop policy if exists "metas: ver" on public.metas;
drop policy if exists "metas: admin escreve" on public.metas;
create policy "metas: ver" on public.metas for select
  using (public.is_approved() and (vendedor_id = auth.uid() or public.is_admin()));
create policy "metas: admin escreve" on public.metas for all
  using (public.is_admin()) with check (public.is_admin());
