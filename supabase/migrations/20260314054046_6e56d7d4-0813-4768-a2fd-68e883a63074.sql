-- Add applies_to_products column to extra_groups
ALTER TABLE public.extra_groups ADD COLUMN IF NOT EXISTS applies_to_products text[] DEFAULT '{}'::text[];

-- Create "Hambúrgueres - Casal" group (required, max 2, for combo casal product only)
INSERT INTO public.extra_groups (id, name, description, max_select, is_required, is_active, sort_order, applies_to_categories, applies_to_products)
VALUES (
  'c0000001-0000-0000-0000-000000000001',
  'Hambúrgueres - Casal',
  'Escolha 2 itens',
  2,
  true,
  true,
  -10,
  '{combos}',
  '{973aaa2f-f2b3-44c1-9cd9-df344b138f07}'
);

-- Create "Hambúrgueres - Família" group (required, max 4, for combo família product only)
INSERT INTO public.extra_groups (id, name, description, max_select, is_required, is_active, sort_order, applies_to_categories, applies_to_products)
VALUES (
  'c0000001-0000-0000-0000-000000000002',
  'Hambúrgueres - Família',
  'Escolha 4 itens',
  4,
  true,
  true,
  -10,
  '{combos}',
  '{e98680dc-dd00-4c86-8dba-38afc0eb6857}'
);

-- Insert burger extras for Casal group (max_quantity 2 each)
INSERT INTO public.product_extras (name, description, price, group_id, max_quantity, is_active, sort_order, image_url) VALUES
('Smashzinho Kids', 'Pão brioche, blend 90g, mussarela derretida, molho da casa.', 0.00, 'c0000001-0000-0000-0000-000000000001', 2, true, 1, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171521_640M_iblob'),
('SIMPLE', 'Pão brioche, blend 150g, cebola roxa, mussarela cremosa, molho da casa.', 0.00, 'c0000001-0000-0000-0000-000000000001', 2, true, 2, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171142_P76A_iblob'),
('Tropical Burger', 'Pão brioche, blend 150g, maionese da casa, abacaxi grelhado, melado, bacon crocante.', 1.99, 'c0000001-0000-0000-0000-000000000001', 2, true, 3, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171218_4872_iblob'),
('Classic Salada', 'Pão brioche, blend 150g, cheddar, cebola roxa, alface, tomate, bacon crocante, molho da casa.', 3.50, 'c0000001-0000-0000-0000-000000000001', 2, true, 4, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171200_0T71_iblob'),
('Classic Bacon', 'Pão brioche, dois blends de 150g cada, cheddar derretido, cebola roxa, bacon crocante, molho da casa.', 5.90, 'c0000001-0000-0000-0000-000000000001', 2, true, 5, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171149_V5LB_iblob'),
('Austrim', 'Pão brioche, blend 150g, cebola caramelizada com melado, bacon crocante. Um delicioso hambúrguer adocicado!', 1.50, 'c0000001-0000-0000-0000-000000000001', 2, true, 6, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171139_10L0_iblob'),
('Morangel', 'Pão brioche, blend 150g, bacon crocante, mussarela, geleia de morango.', 1.50, 'c0000001-0000-0000-0000-000000000001', 2, true, 7, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171216_22H2_iblob'),
('Double Cheddar', 'Pão brioche, blend 150g, bacon crocante, cheddar derretido, onion rings, molho especial de cheddar.', 3.50, 'c0000001-0000-0000-0000-000000000001', 2, true, 8, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171131_F74B_iblob'),
('Maison', 'Pão brioche, blend 150g, bacon, cheddar derretido, queijo coalho com melado.', 10.00, 'c0000001-0000-0000-0000-000000000001', 2, true, 9, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171153_7A71_iblob'),
('Dolcon', 'Pão brioche, blend 150g, doce de leite, queijo coalho, bacon crocante.', 12.00, 'c0000001-0000-0000-0000-000000000001', 2, true, 10, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171212_7LP2_iblob'),
('Smash Simples', 'Pão brioche, blend 90g, cheddar derretido, alface, cebola roxa e molho da casa.', 0.00, 'c0000001-0000-0000-0000-000000000001', 2, true, 11, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171521_640M_iblob'),
('Smash Duplo', 'Pão brioche, dois blends 90g cada, cheddar derretido, picles, bacon crocante, molho da casa.', 3.00, 'c0000001-0000-0000-0000-000000000001', 2, true, 12, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171519_H28X_iblob'),
('Smash Triplo', 'Pão brioche, 3 blends de 90g, cheddar derretido, bacon crocante, picles.', 6.00, 'c0000001-0000-0000-0000-000000000001', 2, true, 13, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171508_7S12_iblob');

-- Insert same burger extras for Família group (max_quantity 4 each)
INSERT INTO public.product_extras (name, description, price, group_id, max_quantity, is_active, sort_order, image_url) VALUES
('Smashzinho Kids', 'Pão brioche, blend 90g, mussarela derretida, molho da casa.', 0.00, 'c0000001-0000-0000-0000-000000000002', 4, true, 1, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171521_640M_iblob'),
('SIMPLE', 'Pão brioche, blend 150g, cebola roxa, mussarela cremosa, molho da casa.', 0.00, 'c0000001-0000-0000-0000-000000000002', 4, true, 2, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171142_P76A_iblob'),
('Tropical Burger', 'Pão brioche, blend 150g, maionese da casa, abacaxi grelhado, melado, bacon crocante.', 1.99, 'c0000001-0000-0000-0000-000000000002', 4, true, 3, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171218_4872_iblob'),
('Classic Salada', 'Pão brioche, blend 150g, cheddar, cebola roxa, alface, tomate, bacon crocante, molho da casa.', 3.50, 'c0000001-0000-0000-0000-000000000002', 4, true, 4, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171200_0T71_iblob'),
('Classic Bacon', 'Pão brioche, dois blends de 150g cada, cheddar derretido, cebola roxa, bacon crocante, molho da casa.', 5.90, 'c0000001-0000-0000-0000-000000000002', 4, true, 5, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171149_V5LB_iblob'),
('Austrim', 'Pão brioche, blend 150g, cebola caramelizada com melado, bacon crocante. Um delicioso hambúrguer adocicado!', 1.50, 'c0000001-0000-0000-0000-000000000002', 4, true, 6, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171139_10L0_iblob'),
('Morangel', 'Pão brioche, blend 150g, bacon crocante, mussarela, geleia de morango.', 1.50, 'c0000001-0000-0000-0000-000000000002', 4, true, 7, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171216_22H2_iblob'),
('Double Cheddar', 'Pão brioche, blend 150g, bacon crocante, cheddar derretido, onion rings, molho especial de cheddar.', 3.50, 'c0000001-0000-0000-0000-000000000002', 4, true, 8, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171131_F74B_iblob'),
('Maison', 'Pão brioche, blend 150g, bacon, cheddar derretido, queijo coalho com melado.', 10.00, 'c0000001-0000-0000-0000-000000000002', 4, true, 9, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171153_7A71_iblob'),
('Dolcon', 'Pão brioche, blend 150g, doce de leite, queijo coalho, bacon crocante.', 12.00, 'c0000001-0000-0000-0000-000000000002', 4, true, 10, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171212_7LP2_iblob'),
('Smash Simples', 'Pão brioche, blend 90g, cheddar derretido, alface, cebola roxa e molho da casa.', 0.00, 'c0000001-0000-0000-0000-000000000002', 4, true, 11, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171521_640M_iblob'),
('Smash Duplo', 'Pão brioche, dois blends 90g cada, cheddar derretido, picles, bacon crocante, molho da casa.', 3.00, 'c0000001-0000-0000-0000-000000000002', 4, true, 12, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171519_H28X_iblob'),
('Smash Triplo', 'Pão brioche, 3 blends de 90g, cheddar derretido, bacon crocante, picles.', 6.00, 'c0000001-0000-0000-0000-000000000002', 4, true, 13, 'https://client-assets.anota.ai/produtos/687bfc493e7ccd00120d3fd1/202507171508_7S12_iblob');