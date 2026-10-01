-- CabinCraft CRM — migração Painel (rode no SQL Editor DEPOIS do migracao-kanban.sql)

alter table negocios add column if not exists atualizado_em timestamptz default now();

-- Lista de vendedores aprovados, visível para qualquer usuário aprovado (só id, nome e e-mail)
create or replace function listar_vendedores() returns table(id uuid, nome text, email text)
language sql security definer stable set search_path = public as
$$ select p.id, p.nome, p.email from public.profiles p where p.aprovado and public.is_approved() $$;

-- Atualiza "última atividade" do negócio quando há histórico ou mudança em tarefas
create or replace function touch_negocio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.negocios set atualizado_em = now()
  where id = coalesce(new.negocio_id, old.negocio_id);
  return null;
end $$;

create trigger t_touch_historico after insert on historico
  for each row execute function touch_negocio();
create trigger t_touch_tarefas after insert or update or delete on tarefas
  for each row execute function touch_negocio();
