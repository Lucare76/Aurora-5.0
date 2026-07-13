-- Aggiunge sottocategorie mancanti agli utenti che hanno già le categorie padre
-- Sicuro: usa ON CONFLICT DO NOTHING, non tocca le categorie esistenti né le transazioni

DO $$
DECLARE
  r record;
  v_casa uuid; v_alimentari uuid; v_trasporti uuid; v_salute uuid;
  v_svago uuid; v_ristoranti uuid; v_abbigliamento uuid; v_tecnologia uuid;
  v_istruzione uuid; v_viaggi uuid; v_bollette uuid; v_abbonamenti uuid;
  v_stipendio uuid; v_freelance uuid; v_investimenti uuid;
BEGIN
  -- Itera su ogni utente che ha categorie padre ma nessuna sottocategoria
  FOR r IN
    SELECT DISTINCT user_id
    FROM public.categories
    WHERE parent_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.categories c2
        WHERE c2.user_id = categories.user_id
          AND c2.parent_id IS NOT NULL
      )
  LOOP
    -- Recupera gli ID delle categorie padre per nome
    SELECT id INTO v_casa          FROM public.categories WHERE user_id = r.user_id AND name = 'Casa'          AND parent_id IS NULL;
    SELECT id INTO v_alimentari    FROM public.categories WHERE user_id = r.user_id AND name = 'Alimentari'    AND parent_id IS NULL;
    SELECT id INTO v_trasporti     FROM public.categories WHERE user_id = r.user_id AND name = 'Trasporti'     AND parent_id IS NULL;
    SELECT id INTO v_salute        FROM public.categories WHERE user_id = r.user_id AND name = 'Salute'        AND parent_id IS NULL;
    SELECT id INTO v_svago         FROM public.categories WHERE user_id = r.user_id AND name = 'Svago'         AND parent_id IS NULL;
    SELECT id INTO v_ristoranti    FROM public.categories WHERE user_id = r.user_id AND name = 'Ristoranti'    AND parent_id IS NULL;
    SELECT id INTO v_abbigliamento FROM public.categories WHERE user_id = r.user_id AND name = 'Abbigliamento' AND parent_id IS NULL;
    SELECT id INTO v_tecnologia    FROM public.categories WHERE user_id = r.user_id AND name = 'Tecnologia'    AND parent_id IS NULL;
    SELECT id INTO v_istruzione    FROM public.categories WHERE user_id = r.user_id AND name = 'Istruzione'    AND parent_id IS NULL;
    SELECT id INTO v_viaggi        FROM public.categories WHERE user_id = r.user_id AND name = 'Viaggi'        AND parent_id IS NULL;
    SELECT id INTO v_bollette      FROM public.categories WHERE user_id = r.user_id AND name = 'Bollette'      AND parent_id IS NULL;
    SELECT id INTO v_abbonamenti   FROM public.categories WHERE user_id = r.user_id AND name = 'Abbonamenti'   AND parent_id IS NULL;
    SELECT id INTO v_stipendio     FROM public.categories WHERE user_id = r.user_id AND name = 'Stipendio'     AND parent_id IS NULL;
    SELECT id INTO v_freelance     FROM public.categories WHERE user_id = r.user_id AND name = 'Freelance'     AND parent_id IS NULL;
    SELECT id INTO v_investimenti  FROM public.categories WHERE user_id = r.user_id AND name = 'Investimenti'  AND parent_id IS NULL;

    IF v_casa IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Affitto/Mutuo', 'expense', v_casa, true, 1),
        (r.user_id, 'Manutenzione',  'expense', v_casa, true, 2),
        (r.user_id, 'Arredamento',   'expense', v_casa, true, 3),
        (r.user_id, 'Condominio',    'expense', v_casa, true, 4)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_alimentari IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Supermercato',          'expense', v_alimentari, true, 1),
        (r.user_id, 'Mercato/Fruttivendolo', 'expense', v_alimentari, true, 2),
        (r.user_id, 'Macelleria/Pescheria',  'expense', v_alimentari, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_trasporti IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Carburante',         'expense', v_trasporti, true, 1),
        (r.user_id, 'Mezzi pubblici',     'expense', v_trasporti, true, 2),
        (r.user_id, 'Manutenzione auto',  'expense', v_trasporti, true, 3),
        (r.user_id, 'Assicurazione',      'expense', v_trasporti, true, 4),
        (r.user_id, 'Parcheggio/Pedaggi', 'expense', v_trasporti, true, 5),
        (r.user_id, 'Taxi/NCC',           'expense', v_trasporti, true, 6)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_salute IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Farmacia',       'expense', v_salute, true, 1),
        (r.user_id, 'Visite mediche', 'expense', v_salute, true, 2),
        (r.user_id, 'Dentista',       'expense', v_salute, true, 3),
        (r.user_id, 'Palestra/Sport', 'expense', v_salute, true, 4)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_svago IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Cinema/Teatro',   'expense', v_svago, true, 1),
        (r.user_id, 'Hobby',           'expense', v_svago, true, 2),
        (r.user_id, 'Videogiochi',     'expense', v_svago, true, 3),
        (r.user_id, 'Eventi/Concerti', 'expense', v_svago, true, 4)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_ristoranti IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Bar/Colazione',    'expense', v_ristoranti, true, 1),
        (r.user_id, 'Pranzo/Cena fuori','expense', v_ristoranti, true, 2),
        (r.user_id, 'Delivery/Asporto', 'expense', v_ristoranti, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_abbigliamento IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Vestiti',    'expense', v_abbigliamento, true, 1),
        (r.user_id, 'Scarpe',     'expense', v_abbigliamento, true, 2),
        (r.user_id, 'Accessori',  'expense', v_abbigliamento, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_tecnologia IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Dispositivi',    'expense', v_tecnologia, true, 1),
        (r.user_id, 'Software/App',   'expense', v_tecnologia, true, 2),
        (r.user_id, 'Accessori tech', 'expense', v_tecnologia, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_istruzione IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Corsi/Formazione',  'expense', v_istruzione, true, 1),
        (r.user_id, 'Libri',             'expense', v_istruzione, true, 2),
        (r.user_id, 'Rette scolastiche', 'expense', v_istruzione, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_viaggi IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Voli',                 'expense', v_viaggi, true, 1),
        (r.user_id, 'Hotel/Alloggio',        'expense', v_viaggi, true, 2),
        (r.user_id, 'Attività/Escursioni',   'expense', v_viaggi, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_bollette IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Luce',              'expense', v_bollette, true, 1),
        (r.user_id, 'Gas',               'expense', v_bollette, true, 2),
        (r.user_id, 'Acqua',             'expense', v_bollette, true, 3),
        (r.user_id, 'Internet/Telefono', 'expense', v_bollette, true, 4)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_abbonamenti IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Streaming video',  'expense', v_abbonamenti, true, 1),
        (r.user_id, 'Streaming musica', 'expense', v_abbonamenti, true, 2),
        (r.user_id, 'Cloud/Software',   'expense', v_abbonamenti, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_stipendio IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Stipendio base',              'income', v_stipendio, true, 1),
        (r.user_id, 'Tredicesima/Quattordicesima', 'income', v_stipendio, true, 2),
        (r.user_id, 'Bonus/Premi',                 'income', v_stipendio, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_freelance IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Consulenze', 'income', v_freelance, true, 1),
        (r.user_id, 'Progetti',   'income', v_freelance, true, 2)
      ON CONFLICT DO NOTHING;
    END IF;

    IF v_investimenti IS NOT NULL THEN
      INSERT INTO public.categories (user_id, name, type, parent_id, is_default, sort_order) VALUES
        (r.user_id, 'Dividendi',   'income', v_investimenti, true, 1),
        (r.user_id, 'Plusvalenze', 'income', v_investimenti, true, 2),
        (r.user_id, 'Interessi',   'income', v_investimenti, true, 3)
      ON CONFLICT DO NOTHING;
    END IF;

  END LOOP;
END;
$$;
