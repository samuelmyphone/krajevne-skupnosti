-- ============================================================
-- Sveti krajevnih skupnosti / Consigli delle frazioni — FASE 1
-- Obvestila (avvisi), statistika obiskov (visite), e-poštna obvestila upraviteljem (email agli amministratori)
-- Esegui DOPO schema.sql: Supabase → SQL Editor → New query → incolla tutto → Run.
-- Lo script si può rieseguire senza danni.
-- ============================================================

-- ------------------------------------------------------------
-- 1. OBVESTILA / AVVISI di ogni Consiglio
--    consiglio_id NULL = avviso comune a tutti i Consigli (solo amministratori generali)
-- ------------------------------------------------------------
create table if not exists public.objave (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  consiglio_id text references public.consigli(id),
  vrsta        text not null default 'obvestilo'
               check (vrsta in ('obvestilo','sestanek','skupscina','dogodek','dela')),
  naslov_sl    text not null check (char_length(naslov_sl) between 3 and 160),
  naslov_it    text check (char_length(naslov_it) <= 160),
  besedilo_sl  text check (char_length(besedilo_sl) <= 4000),
  besedilo_it  text check (char_length(besedilo_it) <= 4000),
  zacetek      timestamptz,          -- data/ora inizio (riunioni, eventi, lavori)
  konec        timestamptz,          -- data/ora fine (facoltativa)
  kraj         text check (char_length(kraj) <= 200),
  povezava     text check (char_length(povezava) <= 500),   -- link esterno facoltativo
  priloge      text[] not null default '{}',                -- percorsi nello storage 'objave'
  objavljeno   boolean not null default true,
  avtor        text
);
create index if not exists objave_cons_zac on public.objave (consiglio_id, zacetek);
alter table public.objave enable row level security;

drop policy if exists objave_read on public.objave;
create policy objave_read on public.objave for select using (objavljeno or public.je_admin(consiglio_id));
drop policy if exists objave_insert on public.objave;
create policy objave_insert on public.objave for insert to authenticated with check (public.je_admin(consiglio_id));
drop policy if exists objave_update on public.objave;
create policy objave_update on public.objave for update to authenticated
  using (public.je_admin(consiglio_id)) with check (public.je_admin(consiglio_id));
drop policy if exists objave_delete on public.objave;
create policy objave_delete on public.objave for delete to authenticated using (public.je_admin(consiglio_id));
drop trigger if exists objave_touch on public.objave;
create trigger objave_touch before update on public.objave for each row execute function public.touch();
grant select on public.objave to anon, authenticated;
grant insert, update, delete on public.objave to authenticated;

-- allegati degli avvisi (PDF, immagini): bucket pubblico, caricano solo gli amministratori
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('objave','objave', true, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists objave_up on storage.objects;
create policy objave_up on storage.objects for insert to authenticated
  with check (bucket_id = 'objave' and public.je_katerikoli_admin());
drop policy if exists objave_rd on storage.objects;
create policy objave_rd on storage.objects for select using (bucket_id = 'objave');
drop policy if exists objave_del on storage.objects;
create policy objave_del on storage.objects for delete to authenticated
  using (bucket_id = 'objave' and public.je_katerikoli_admin());

-- ------------------------------------------------------------
-- 2. STATISTIKA OBISKOV / STATISTICHE VISITE
--    Nessun cookie, nessun IP, nessun dato personale: pagina, lingua, sito di provenienza, telefono/computer.
-- ------------------------------------------------------------
create table if not exists public.obiski (
  id      bigint generated always as identity primary key,
  t       timestamptz not null default now(),
  pot     text not null check (char_length(pot) <= 200),
  jezik   text check (jezik in ('sl','it')),
  vir     text check (char_length(vir) <= 100),
  naprava text check (naprava in ('m','d'))
);
create index if not exists obiski_t on public.obiski (t);
alter table public.obiski enable row level security;
drop policy if exists obiski_insert on public.obiski;
create policy obiski_insert on public.obiski for insert to anon, authenticated with check (t > now() - interval '1 minute');
-- nessuna policy di lettura: i dati si leggono solo con la funzione qui sotto
grant insert on public.obiski to anon, authenticated;

drop function if exists public.statistika(int);
create or replace function public.statistika(dni int default 30, svet text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare od timestamptz := now() - make_interval(days => greatest(1, least(dni, 400)));
        pref text := null;
begin
  if not public.je_katerikoli_admin() then raise exception 'ni dovoljeno / non autorizzato'; end if;
  if svet is not null then select '/sveti/' || slug || '/' into pref from consigli where id = svet; end if;
  return jsonb_build_object(
    'svet', svet,
    'skupaj',    (select count(*) from obiski where t >= od and (pref is null or pot like pref || '%')),
    'po_dnevih', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d), '[]'::jsonb)
                  from (select to_char(t at time zone 'Europe/Rome', 'YYYY-MM-DD') d, count(*) n
                        from obiski where t >= od and (pref is null or pot like pref || '%') group by 1) s),
    'strani',    (select coalesce(jsonb_agg(jsonb_build_object('p', pot, 'n', n) order by n desc), '[]'::jsonb)
                  from (select pot, count(*) n from obiski where t >= od and (pref is null or pot like pref || '%') group by pot order by count(*) desc limit 25) s),
    'viri',      (select coalesce(jsonb_agg(jsonb_build_object('v', v, 'n', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(nullif(vir, ''), 'neposredno · diretto') v, count(*) n
                        from obiski where t >= od and (pref is null or pot like pref || '%') group by 1 order by count(*) desc limit 15) s),
    'jeziki',    (select coalesce(jsonb_object_agg(coalesce(jezik, '?'), n), '{}'::jsonb)
                  from (select jezik, count(*) n from obiski where t >= od and (pref is null or pot like pref || '%') group by jezik) s),
    'naprave',   (select coalesce(jsonb_object_agg(coalesce(naprava, '?'), n), '{}'::jsonb)
                  from (select naprava, count(*) n from obiski where t >= od and (pref is null or pot like pref || '%') group by naprava) s),
    'po_svetih', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'ime', ime_sl, 'n', n) order by id), '[]'::jsonb)
                  from (select c.id, c.ime_sl, (select count(*) from obiski o where o.t >= od and o.pot like '/sveti/' || c.slug || '/%') n
                        from consigli c) s)
  );
end $$;
grant execute on function public.statistika(int, text) to authenticated;

-- pulizia automatica: si conservano 13 mesi di dati
create or replace function public.obiski_ciscenje() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.002 then delete from obiski where t < now() - interval '13 months'; end if;
  return null;
end $$;
drop trigger if exists obiski_ciscenje on public.obiski;
create trigger obiski_ciscenje after insert on public.obiski for each statement execute function public.obiski_ciscenje();

-- ------------------------------------------------------------
-- 3. E-POŠTNA OBVESTILA UPRAVITELJEM / EMAIL AGLI AMMINISTRATORI
--    A ogni nuova segnalazione o proposta BP parte un'email (Brevo) ai presidenti/vice di quel Consiglio
--    (se il Consiglio non ha ancora amministratori: agli amministratori generali).
--    PRIMA di eseguire questa parte, salvare in Vault (Project Settings → Vault, oppure con le due righe sotto):
--      select vault.create_secret('<CHIAVE API BREVO>', 'brevo_api_key');
--      select vault.create_secret('<email mittente verificata in Brevo>', 'brevo_sender');
--    Senza chiave le email semplicemente non partono: l'invio della segnalazione funziona comunque.
-- ------------------------------------------------------------
create extension if not exists pg_net;

alter table public.admini add column if not exists obvestila boolean not null default true;  -- false = niente email
alter table public.admini add column if not exists obvestila_email text;  -- indirizzo alternativo per le email (se vuoto: email di accesso)

create or replace function public.obvesti_upravitelje() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text; snd text; prejemniki jsonb; zadeva text; vsebina text; svet text;
  site constant text := 'https://cfks-dolina.org/upravljanje.html';
begin
  begin
    select decrypted_secret into k   from vault.decrypted_secrets where name = 'brevo_api_key' limit 1;
    select decrypted_secret into snd from vault.decrypted_secrets where name = 'brevo_sender'  limit 1;
    if k is null or snd is null then return new; end if;

    if (select count(*) from prijave where created_at > now() - interval '1 hour') > 20 then return new; end if;
    select ime_sl || ' / ' || ime_it into svet from consigli where id = new.consiglio_id;
    select jsonb_agg(jsonb_build_object('email', coalesce(obvestila_email, email))) into prejemniki
      from admini where consiglio_id = new.consiglio_id and obvestila;
    if prejemniki is null then
      select jsonb_agg(jsonb_build_object('email', coalesce(obvestila_email, email))) into prejemniki
        from admini where consiglio_id is null and obvestila;
    end if;
    if prejemniki is null then return new; end if;

    if tg_table_name = 'prijave' then
      zadeva  := 'Nova prijava / Nuova segnalazione – ' || coalesce(new.vas, '');
      vsebina := '<p><b>' || coalesce(svet,'') || '</b><br>' || coalesce(new.vas,'') || '</p>'
              || '<p>' || replace(left(coalesce(new.opis,''), 600), '<', '&lt;') || '</p>';
    else
      zadeva  := 'Nov predlog za participativni proračun / Nuova proposta BP';
      vsebina := '<p><b>' || coalesce(svet,'') || '</b></p><p>' || replace(coalesce(new.naslov,''), '<', '&lt;') || '</p>';
    end if;
    vsebina := vsebina || '<p><a href="' || site || '">Pregled in objava / Revisione e pubblicazione →</a></p>'
            || '<p style="color:#777;font-size:12px">Sporočilo je bilo poslano samodejno s spletne strani krajevnih skupnosti. / Messaggio automatico dal sito dei Consigli delle frazioni.</p>';

    perform net.http_post(
      url     := 'https://api.brevo.com/v3/smtp/email',
      body    := jsonb_build_object('sender', jsonb_build_object('name','Krajevne skupnosti – Consigli delle frazioni','email', snd),
                                    'to', prejemniki, 'subject', zadeva, 'htmlContent', vsebina),
      headers := jsonb_build_object('api-key', k, 'Content-Type','application/json', 'accept','application/json')
    );
  exception when others then
    -- l'email non deve mai bloccare l'invio della segnalazione
    raise warning 'obvesti_upravitelje: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists prijave_obvesti on public.prijave;
create trigger prijave_obvesti after insert on public.prijave for each row execute function public.obvesti_upravitelje();
drop trigger if exists bp_obvesti on public.bp_predlogi;
create trigger bp_obvesti after insert on public.bp_predlogi for each row execute function public.obvesti_upravitelje();

-- verifica: le ultime chiamate a Brevo (status 201 = inviata)
-- select id, status_code, content from net._http_response order by id desc limit 5;

-- 2026-10-23: nuovo tipo di avviso "Sestanek z županom / Riunione col Sindaco"
alter table public.objave drop constraint if exists objave_vrsta_check;
alter table public.objave add constraint objave_vrsta_check
  check (vrsta in ('obvestilo','sestanek','zupan','skupscina','dogodek','dela'));

-- 2026-10-26: protezione da inserimenti massivi (flood) su prijave e bp_predlogi
create or replace function public.omeji_vnose() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from public.%I where created_at > now() - interval ''10 minutes''', tg_table_name) into n;
  if n >= 30 then
    raise exception 'Preveč vnosov v kratkem času. Poskusite pozneje. / Troppi invii in poco tempo. Riprovate più tardi.';
  end if;
  return new;
end $$;
drop trigger if exists prijave_omeji on public.prijave;
create trigger prijave_omeji before insert on public.prijave for each row execute function public.omeji_vnose();
drop trigger if exists bp_omeji on public.bp_predlogi;
create trigger bp_omeji before insert on public.bp_predlogi for each row execute function public.omeji_vnose();
-- le email agli amministratori si fermano oltre 20 inserimenti/ora (il sito continua a funzionare)
