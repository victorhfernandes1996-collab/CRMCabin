-- CabinCraft CRM — rode no SQL Editor do Supabase

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text, nome text,
  role text not null default 'vendedor' check (role in ('admin','vendedor')),
  aprovado boolean not null default false,
  created_at timestamptz default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, igreja text, telefone text, cidade text,
  status text not null default 'novo',
  owner uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  titulo text not null, vencimento date, feita boolean default false,
  created_at timestamptz default now()
);

create table propostas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  produto text not null, preco numeric not null, desconto numeric default 0,
  entrada numeric default 0, parcelas int default 1,
  prazo text default '15 dias úteis', obs text,
  created_at timestamptz default now()
);

-- Helpers
create function is_approved() returns boolean language sql security definer stable set search_path = public as
$$ select coalesce((select aprovado from public.profiles where id = auth.uid()), false) $$;
create function is_admin() returns boolean language sql security definer stable set search_path = public as
$$ select coalesce((select aprovado and role='admin' from public.profiles where id = auth.uid()), false) $$;

-- Novo usuário: cria perfil pendente (o PRIMEIRO cadastro vira admin aprovado)
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare primeiro boolean;
begin
  select not exists (select 1 from public.profiles) into primeiro;
  insert into public.profiles (id, email, nome, role, aprovado)
  values (new.id, new.email, new.raw_user_meta_data->>'nome',
          case when primeiro then 'admin' else 'vendedor' end, primeiro);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles enable row level security;
alter table clientes enable row level security;
alter table tarefas enable row level security;
alter table propostas enable row level security;

create policy "ver proprio perfil" on profiles for select using (id = auth.uid() or is_admin());
create policy "admin edita perfis" on profiles for update using (is_admin());
create policy "admin remove perfis" on profiles for delete using (is_admin());

create policy "aprovados: clientes" on clientes for all using (is_approved()) with check (is_approved());
create policy "aprovados: tarefas" on tarefas for all using (is_approved()) with check (is_approved());
create policy "aprovados: propostas" on propostas for all using (is_approved()) with check (is_approved());
