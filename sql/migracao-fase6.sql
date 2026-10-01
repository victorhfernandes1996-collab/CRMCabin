-- CabinCraft CRM — Fase 6: validade da proposta e modelos de mensagem
-- Rode no SQL Editor DEPOIS do migracao-bloco1.sql. Pode rodar mais de uma vez.

-- ===== Validade da proposta =====
alter table public.propostas add column if not exists validade_dias int not null default 15;
alter table public.propostas add column if not exists valida_ate date;

-- ===== Modelos de mensagem (admin edita; todos usam) =====
create table if not exists public.modelos_msg (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  etapa text check (etapa is null or etapa in ('Apresentação','Construir Proposta','Negociação','Fechamento','Contrato')),
  texto text not null,
  ativo boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz default now()
);
alter table public.modelos_msg enable row level security;
drop policy if exists "modelos: ver" on public.modelos_msg;
drop policy if exists "modelos: admin escreve" on public.modelos_msg;
create policy "modelos: ver" on public.modelos_msg for select using (public.is_approved());
create policy "modelos: admin escreve" on public.modelos_msg for all
  using (public.is_admin()) with check (public.is_admin());

insert into public.modelos_msg (nome, etapa, texto, ordem)
select v.nome, v.etapa, v.texto, v.ordem
from (values
  ('Primeiro contato', 'Apresentação'::text,
   $t$Olá, {contato}! Aqui é {vendedor}, da CabinCraft. Trabalhamos com cabines acústicas para bateria, que ajudam a controlar o volume da bateria no culto. Posso te apresentar os modelos para a {igreja}? Qual seria um bom momento para conversarmos?$t$, 1),
  ('Após a apresentação', 'Construir Proposta'::text,
   $t$Olá, {contato}! Foi um prazer conversar sobre a cabine para a {igreja}. Vou preparar a proposta com o {produto} e te envio em breve. Se houver alguma necessidade específica (medidas do local, cor, prazo), me conta por aqui.$t$, 2),
  ('Follow-up da proposta', 'Negociação'::text,
   $t$Olá, {contato}! Tudo bem? Passando para saber se você conseguiu analisar a proposta da cabine ({produto}, {valor}) para a {igreja}.
A proposta segue válida até {validade}.
Posso tirar alguma dúvida ou ajustar algo?$t$, 3),
  ('Cobrar resposta', 'Negociação'::text,
   $t$Olá, {contato}! Como estão as conversas sobre a cabine na {igreja}? Se precisar de alguma informação para levar à liderança, me avise que eu preparo.$t$, 4),
  ('Fechamento', 'Fechamento'::text,
   $t$Olá, {contato}! Para avançarmos com o {produto} da {igreja} ({valor}), preciso confirmar as condições de pagamento e o prazo de entrega. Podemos acertar os detalhes hoje?$t$, 5),
  ('Envio do contrato', 'Contrato'::text,
   $t$Olá, {contato}! Estou enviando o contrato do {produto} para a {igreja}. Assim que for assinado, já iniciamos a produção. Qualquer ponto que queira revisar, é só me chamar.$t$, 6),
  ('Retomar contato', null::text,
   $t$Olá, {contato}! Faz um tempo que não nos falamos. Ainda faz sentido para a {igreja} avançarmos com a cabine? Se o momento mudou, sem problema, me conta que ajustamos.$t$, 7)
) as v(nome, etapa, texto, ordem)
where not exists (select 1 from public.modelos_msg m where m.nome = v.nome);
