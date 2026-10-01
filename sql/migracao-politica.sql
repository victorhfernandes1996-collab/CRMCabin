-- CabinCraft CRM — Política de desconto, aprovação e cliente duplicado
-- Rode no SQL Editor DEPOIS do migracao-fase4.sql. Pode rodar mais de uma vez.

-- ===== Limite de desconto por produto (em %) =====
alter table public.produtos add column if not exists desconto_max numeric not null default 10
  check (desconto_max >= 0 and desconto_max <= 100);

-- ===== Aprovação nas propostas =====
alter table public.propostas add column if not exists status_aprov text not null default 'ok'
  check (status_aprov in ('ok','pendente','aprovada','recusada'));
alter table public.propostas add column if not exists preco_tabela numeric;
alter table public.propostas add column if not exists desconto_pct numeric;
alter table public.propostas add column if not exists aprovado_por uuid references public.profiles(id);
alter table public.propostas add column if not exists aprovado_em timestamptz;
alter table public.propostas add column if not exists obs_aprov text;
alter table public.propostas add column if not exists autor uuid default auth.uid();

-- A regra roda NO BANCO: o vendedor não consegue se aprovar nem burlar o limite pela API.
create or replace function public.validar_proposta() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prod record; v_tabela numeric; v_max numeric; v_total numeric; v_piso numeric;
  v_admin boolean := public.is_admin();
  v_mudou boolean;
begin
  select preco, desconto_max into v_prod from public.produtos
   where nome = new.produto order by ativo desc limit 1;
  if found then v_tabela := v_prod.preco; v_max := v_prod.desconto_max;
  else v_tabela := new.preco; v_max := 0; end if;

  v_total := new.preco - coalesce(new.desconto, 0);
  new.preco_tabela := v_tabela;
  new.desconto_pct := case when v_tabela > 0 then round(100 * (1 - v_total / v_tabela), 1) else 0 end;
  v_piso := v_tabela * (1 - v_max / 100);

  if tg_op = 'INSERT' then v_mudou := true;
  else v_mudou := (new.preco, coalesce(new.desconto, 0), new.produto)
                  is distinct from (old.preco, coalesce(old.desconto, 0), old.produto);
  end if;

  if v_total >= v_piso - 0.005 then
    new.status_aprov := 'ok'; new.aprovado_por := null; new.aprovado_em := null; new.obs_aprov := null;
  elsif v_admin then
    if v_mudou then
      new.status_aprov := 'aprovada'; new.aprovado_por := auth.uid(); new.aprovado_em := now();
    elsif new.status_aprov is distinct from old.status_aprov and new.status_aprov in ('aprovada','recusada') then
      new.aprovado_por := auth.uid(); new.aprovado_em := now();
    end if;
  else
    if v_mudou then
      new.status_aprov := 'pendente'; new.aprovado_por := null; new.aprovado_em := null; new.obs_aprov := null;
    else
      new.status_aprov := old.status_aprov; new.aprovado_por := old.aprovado_por;
      new.aprovado_em := old.aprovado_em; new.obs_aprov := old.obs_aprov;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists t_validar_proposta on public.propostas;
create trigger t_validar_proposta before insert or update on public.propostas
  for each row execute function public.validar_proposta();

-- Preenche tabela/% das propostas antigas (elas continuam valendo como estão)
update public.propostas set preco = preco;

-- ===== Cliente duplicado =====
create or replace function public.buscar_duplicado(p_nome text, p_telefone text default null, p_igreja text default null)
returns table(id uuid, nome text, igreja text, cidade text, telefone text, dono_id uuid, dono_nome text, negocios_abertos int)
language sql security definer stable set search_path = public as $$
  with alvo as (
    select regexp_replace(lower(coalesce(p_nome, '')),   '[^[:alnum:]]', '', 'g') n,
           regexp_replace(lower(coalesce(p_igreja, '')), '[^[:alnum:]]', '', 'g') i,
           right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 8) t
  )
  select c.id, c.nome, c.igreja, c.cidade, c.telefone, c.owner,
         coalesce(pr.nome, pr.email),
         (select count(*)::int from public.negocios g where g.cliente_id = c.id and g.status = 'aberto')
  from public.clientes c
  cross join alvo a
  left join public.profiles pr on pr.id = c.owner
  where public.is_approved() and (
    (length(a.n) >= 4 and (
        regexp_replace(lower(c.nome), '[^[:alnum:]]', '', 'g') = a.n
        or (length(a.n) >= 6 and regexp_replace(lower(c.nome), '[^[:alnum:]]', '', 'g') like '%' || a.n || '%')))
    or (length(a.i) >= 6 and regexp_replace(lower(coalesce(c.igreja, '')), '[^[:alnum:]]', '', 'g') = a.i)
    or (length(a.t) = 8 and right(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), 8) = a.t)
  )
$$;
