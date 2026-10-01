-- CabinCraft CRM — Correção do ganho + Bloco 1 (editar/excluir/mesclar, motivo de perda)
-- Rode no SQL Editor DEPOIS do migracao-politica.sql. Pode rodar mais de uma vez.

alter table public.negocios add column if not exists motivo_obs text;

-- ===== CORREÇÃO: não deixar marcar GANHO com desconto pendente/recusado =====
create or replace function public.validar_negocio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_vig record; v_prod record; v_has boolean; v_min numeric;
begin
  if new.status = 'ganho' and old.status is distinct from 'ganho'
     and auth.uid() is not null and not public.is_admin() then

    select * into v_vig from public.propostas
     where negocio_id = new.id order by created_at desc limit 1;
    v_has := found;

    if v_has and v_vig.status_aprov = 'pendente' then
      raise exception 'Não é possível marcar como ganho: há proposta com desconto aguardando aprovação do admin.';
    end if;
    if v_has and v_vig.status_aprov = 'recusada' then
      raise exception 'Não é possível marcar como ganho: o desconto da proposta foi recusado. Ajuste o valor e envie novamente.';
    end if;

    select preco, desconto_max into v_prod from public.produtos
     where nome = new.produto order by ativo desc limit 1;
    if found then
      v_min := v_prod.preco * (1 - v_prod.desconto_max / 100);
      if v_has and v_vig.status_aprov = 'aprovada' then
        v_min := least(v_min, v_vig.preco - coalesce(v_vig.desconto, 0));
      end if;
      if coalesce(new.preco, 0) < v_min - 0.005 then
        raise exception 'Não é possível marcar como ganho: o valor (R$ %) está abaixo do mínimo permitido (R$ %). Gere uma proposta e peça aprovação do desconto.',
          round(coalesce(new.preco, 0), 2), round(v_min, 2);
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists t_validar_negocio on public.negocios;
create trigger t_validar_negocio before update on public.negocios
  for each row execute function public.validar_negocio();

-- ===== Exclusões protegidas =====
create or replace function public.bloqueia_exclusao_negocio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'aberto' and auth.uid() is not null and not public.is_admin() then
    raise exception 'Só o admin pode excluir negócios já encerrados (ganhos ou perdidos).';
  end if;
  return old;
end $$;
drop trigger if exists t_bloqueia_exc_negocio on public.negocios;
create trigger t_bloqueia_exc_negocio before delete on public.negocios
  for each row execute function public.bloqueia_exclusao_negocio();

create or replace function public.bloqueia_exclusao_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.negocios where cliente_id = old.id) then
    raise exception 'Este cliente tem negócios. Mescle com outro cliente ou exclua os negócios antes.';
  end if;
  return old;
end $$;
drop trigger if exists t_bloqueia_exc_cliente on public.clientes;
create trigger t_bloqueia_exc_cliente before delete on public.clientes
  for each row execute function public.bloqueia_exclusao_cliente();

-- ===== Mesclar clientes duplicados =====
create or replace function public.mesclar_clientes(p_origem uuid, p_destino uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o record; d record;
begin
  if p_origem = p_destino then raise exception 'Escolha dois clientes diferentes.'; end if;
  if not public.is_approved() then raise exception 'Sem permissão.'; end if;
  select * into o from public.clientes where id = p_origem;
  select * into d from public.clientes where id = p_destino;
  if o.id is null or d.id is null then raise exception 'Cliente não encontrado.'; end if;
  if not public.is_admin() and (o.owner is distinct from auth.uid() or d.owner is distinct from auth.uid()) then
    raise exception 'Você só pode mesclar clientes que são seus.';
  end if;

  update public.negocios  set cliente_id = p_destino where cliente_id = p_origem;
  update public.tarefas   set cliente_id = p_destino where cliente_id = p_origem;
  update public.propostas set cliente_id = p_destino where cliente_id = p_origem;
  update public.contatos  set cliente_id = p_destino where cliente_id = p_origem;
  update public.clientes set
    igreja   = coalesce(nullif(igreja, ''),   o.igreja),
    telefone = coalesce(nullif(telefone, ''), o.telefone),
    cidade   = coalesce(nullif(cidade, ''),   o.cidade)
  where id = p_destino;
  delete from public.clientes where id = p_origem;
end $$;
