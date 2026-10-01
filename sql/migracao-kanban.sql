-- CabinCraft CRM — migração Kanban (rode no SQL Editor DEPOIS do supabase.sql)

alter table profiles add column if not exists whatsapp text;

create table negocios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  titulo text not null, produto text, preco numeric default 0,
  etapa text not null default 'Apresentação'
    check (etapa in ('Apresentação','Construir Proposta','Negociação','Fechamento','Contrato')),
  status text not null default 'aberto' check (status in ('aberto','ganho','perdido')),
  motivo_perda text, fechado_em timestamptz,
  owner uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

create table historico (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references negocios(id) on delete cascade,
  texto text not null,
  autor uuid default auth.uid(),
  created_at timestamptz default now()
);

alter table tarefas   add column if not exists negocio_id uuid references negocios(id) on delete cascade;
alter table propostas add column if not exists negocio_id uuid references negocios(id) on delete cascade;

alter table negocios enable row level security;
alter table historico enable row level security;
create policy "aprovados: negocios" on negocios for all using (is_approved()) with check (is_approved());
create policy "aprovados: historico" on historico for all using (is_approved()) with check (is_approved());

-- Cada usuário edita só nome e WhatsApp (não consegue mexer em role/aprovado)
create or replace function atualizar_meu_perfil(p_nome text, p_whatsapp text) returns void
language sql security definer set search_path = public as
$$ update public.profiles set nome = p_nome, whatsapp = p_whatsapp where id = auth.uid() $$;
