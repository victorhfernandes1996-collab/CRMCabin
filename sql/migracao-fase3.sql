-- CabinCraft CRM — Fase 3: previsão de fechamento e origem do lead
-- Rode no SQL Editor DEPOIS do migracao-fase2.sql. Pode rodar mais de uma vez.

alter table public.negocios add column if not exists data_prevista date;
alter table public.negocios add column if not exists probabilidade int
  check (probabilidade is null or (probabilidade between 0 and 100));
alter table public.negocios add column if not exists origem text;
