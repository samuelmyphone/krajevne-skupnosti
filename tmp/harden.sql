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
