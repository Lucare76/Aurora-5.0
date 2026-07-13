-- Migration 00004: aggiunge sottocategorie di default a create_default_categories
-- Applica su Supabase SQL Editor oppure via: supabase db push

create or replace function public.create_default_categories(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_casa uuid;
  v_alimentari uuid;
  v_trasporti uuid;
  v_salute uuid;
  v_svago uuid;
  v_ristoranti uuid;
  v_abbigliamento uuid;
  v_tecnologia uuid;
  v_istruzione uuid;
  v_viaggi uuid;
  v_bollette uuid;
  v_abbonamenti uuid;
  v_stipendio uuid;
  v_freelance uuid;
  v_investimenti uuid;
begin
  if exists (select 1 from public.categories where user_id = p_user_id and is_default = true) then
    return;
  end if;

  -- Categorie padre USCITE
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Casa', 'expense', 'home', '#6366f1', true, 1) returning id into v_casa;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Alimentari', 'expense', 'shopping-cart', '#10b981', true, 2) returning id into v_alimentari;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Trasporti', 'expense', 'car', '#f59e0b', true, 3) returning id into v_trasporti;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Salute', 'expense', 'heart', '#ef4444', true, 4) returning id into v_salute;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Svago', 'expense', 'game', '#8b5cf6', true, 5) returning id into v_svago;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Ristoranti', 'expense', 'utensils', '#f97316', true, 6) returning id into v_ristoranti;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Abbigliamento', 'expense', 'shirt', '#ec4899', true, 7) returning id into v_abbigliamento;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Tecnologia', 'expense', 'cpu', '#06b6d4', true, 8) returning id into v_tecnologia;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Istruzione', 'expense', 'book', '#84cc16', true, 9) returning id into v_istruzione;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Viaggi', 'expense', 'plane', '#14b8a6', true, 10) returning id into v_viaggi;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Bollette', 'expense', 'zap', '#f59e0b', true, 11) returning id into v_bollette;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Abbonamenti', 'expense', 'repeat', '#6366f1', true, 12) returning id into v_abbonamenti;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Altro (uscita)', 'expense', 'more-horizontal', '#9ca3af', true, 99);

  -- Sottocategorie CASA
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Affitto/Mutuo', 'expense', v_casa, true, 1),
    (p_user_id, 'Manutenzione', 'expense', v_casa, true, 2),
    (p_user_id, 'Arredamento', 'expense', v_casa, true, 3),
    (p_user_id, 'Condominio', 'expense', v_casa, true, 4);

  -- Sottocategorie ALIMENTARI
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Supermercato', 'expense', v_alimentari, true, 1),
    (p_user_id, 'Mercato/Fruttivendolo', 'expense', v_alimentari, true, 2),
    (p_user_id, 'Macelleria/Pescheria', 'expense', v_alimentari, true, 3);

  -- Sottocategorie TRASPORTI
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Carburante', 'expense', v_trasporti, true, 1),
    (p_user_id, 'Mezzi pubblici', 'expense', v_trasporti, true, 2),
    (p_user_id, 'Manutenzione auto', 'expense', v_trasporti, true, 3),
    (p_user_id, 'Assicurazione', 'expense', v_trasporti, true, 4),
    (p_user_id, 'Parcheggio/Pedaggi', 'expense', v_trasporti, true, 5),
    (p_user_id, 'Taxi/NCC', 'expense', v_trasporti, true, 6);

  -- Sottocategorie SALUTE
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Farmacia', 'expense', v_salute, true, 1),
    (p_user_id, 'Visite mediche', 'expense', v_salute, true, 2),
    (p_user_id, 'Dentista', 'expense', v_salute, true, 3),
    (p_user_id, 'Palestra/Sport', 'expense', v_salute, true, 4);

  -- Sottocategorie SVAGO
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Cinema/Teatro', 'expense', v_svago, true, 1),
    (p_user_id, 'Hobby', 'expense', v_svago, true, 2),
    (p_user_id, 'Videogiochi', 'expense', v_svago, true, 3),
    (p_user_id, 'Eventi/Concerti', 'expense', v_svago, true, 4);

  -- Sottocategorie RISTORANTI
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Bar/Colazione', 'expense', v_ristoranti, true, 1),
    (p_user_id, 'Pranzo/Cena fuori', 'expense', v_ristoranti, true, 2),
    (p_user_id, 'Delivery/Asporto', 'expense', v_ristoranti, true, 3);

  -- Sottocategorie ABBIGLIAMENTO
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Vestiti', 'expense', v_abbigliamento, true, 1),
    (p_user_id, 'Scarpe', 'expense', v_abbigliamento, true, 2),
    (p_user_id, 'Accessori', 'expense', v_abbigliamento, true, 3);

  -- Sottocategorie TECNOLOGIA
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Dispositivi', 'expense', v_tecnologia, true, 1),
    (p_user_id, 'Software/App', 'expense', v_tecnologia, true, 2),
    (p_user_id, 'Accessori tech', 'expense', v_tecnologia, true, 3);

  -- Sottocategorie ISTRUZIONE
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Corsi/Formazione', 'expense', v_istruzione, true, 1),
    (p_user_id, 'Libri', 'expense', v_istruzione, true, 2),
    (p_user_id, 'Rette scolastiche', 'expense', v_istruzione, true, 3);

  -- Sottocategorie VIAGGI
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Voli', 'expense', v_viaggi, true, 1),
    (p_user_id, 'Hotel/Alloggio', 'expense', v_viaggi, true, 2),
    (p_user_id, 'Attività/Escursioni', 'expense', v_viaggi, true, 3);

  -- Sottocategorie BOLLETTE
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Luce', 'expense', v_bollette, true, 1),
    (p_user_id, 'Gas', 'expense', v_bollette, true, 2),
    (p_user_id, 'Acqua', 'expense', v_bollette, true, 3),
    (p_user_id, 'Internet/Telefono', 'expense', v_bollette, true, 4);

  -- Sottocategorie ABBONAMENTI
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Streaming video', 'expense', v_abbonamenti, true, 1),
    (p_user_id, 'Streaming musica', 'expense', v_abbonamenti, true, 2),
    (p_user_id, 'Cloud/Software', 'expense', v_abbonamenti, true, 3);

  -- Categorie padre ENTRATE
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Stipendio', 'income', 'briefcase', '#10b981', true, 1) returning id into v_stipendio;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Freelance', 'income', 'code', '#6366f1', true, 2) returning id into v_freelance;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Investimenti', 'income', 'trending-up', '#f59e0b', true, 3) returning id into v_investimenti;
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Regalo', 'income', 'gift', '#ec4899', true, 4);
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Rimborso', 'income', 'rotate-ccw', '#06b6d4', true, 5);
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order) values
    (p_user_id, 'Altro (entrata)', 'income', 'more-horizontal', '#9ca3af', true, 99);

  -- Sottocategorie STIPENDIO
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Stipendio base', 'income', v_stipendio, true, 1),
    (p_user_id, 'Tredicesima/Quattordicesima', 'income', v_stipendio, true, 2),
    (p_user_id, 'Bonus/Premi', 'income', v_stipendio, true, 3);

  -- Sottocategorie FREELANCE
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Consulenze', 'income', v_freelance, true, 1),
    (p_user_id, 'Progetti', 'income', v_freelance, true, 2);

  -- Sottocategorie INVESTIMENTI
  insert into public.categories (user_id, name, type, parent_id, is_default, sort_order) values
    (p_user_id, 'Dividendi', 'income', v_investimenti, true, 1),
    (p_user_id, 'Plusvalenze', 'income', v_investimenti, true, 2),
    (p_user_id, 'Interessi', 'income', v_investimenti, true, 3);
end;
$$;
