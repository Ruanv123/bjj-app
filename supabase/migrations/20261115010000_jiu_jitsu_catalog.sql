-- =============================================================
-- Catálogo de exemplo de jiu-jitsu (substitui os vídeos de teste)
-- =============================================================
-- Títulos, descrições, instrutores e trilhas são de jiu-jitsu. Os endereços
-- ainda apontam para streams públicos de teste: troque em `video_sources`
-- (e as capas em `videos.thumbnail_url`) quando tiver as aulas gravadas.
-- Os IDs 1–6 são reaproveitados, então comentários e salvos continuam válidos.

-- ---------- Streams de teste (índice 1..6) ----------
create temporary table _streams (idx int primary key, url text not null, seconds int) on commit drop;
insert into _streams values
  (1, 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 596),
  (2, 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', 734),
  (3, 'https://test-streams.mux.dev/tos_ismc/main.m3u8', 734),
  (4, 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8', null),
  (5, 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8', null),
  (6, 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', null);

-- ---------- Vídeos ----------
-- n, título, descrição, instrutor, stream, visualizações, premium avulso, horas desde a publicação
create temporary table _videos (
  n int primary key, title text, description text, channel text,
  stream int, views bigint, premium boolean, hours int
) on commit drop;

insert into _videos values
  -- Fundamentos
  (1,  'Postura e base: o primeiro passo no tatame', 'Como distribuir o peso, posicionar os joelhos e manter a coluna alinhada para não ser raspado.', 'Prof. Marcos Tavares', 1, 18420, false, 2),
  (2,  'Fuga de quadril passo a passo', 'O movimento mais importante do jiu-jitsu: criar espaço e recolocar a guarda. Inclui exercícios de solo.', 'Prof. Marcos Tavares', 2, 15310, false, 6),
  (3,  'Ponte (upa): como usar o quadril para sair de baixo', 'Mecânica da ponte, direção certa do empurrão e erros comuns de quem está começando.', 'Prof. Marcos Tavares', 3, 9870, false, 20),
  (4,  'Rolamentos e quedas seguras (ukemi)', 'Rolamento para frente, para trás e queda lateral para treinar quedas sem se machucar.', 'Prof.ª Júlia Andrade', 4, 7640, false, 30),
  (5,  'Pegadas básicas no kimono', 'Gola, manga e calça: como segurar, quando trocar e como quebrar a pegada do adversário.', 'Prof.ª Júlia Andrade', 5, 6120, false, 44),
  (6,  'Levantada técnica', 'Como ficar em pé com segurança mantendo distância e proteção durante o rola.', 'Prof. Marcos Tavares', 6, 5310, false, 52),
  (7,  'Regras e pontuação do jiu-jitsu esportivo', 'Quedas, raspagens, passagens, montada e costas: quanto vale cada posição e o que é vantagem.', 'Mestre Carlos Ribeiro', 1, 4280, false, 70),

  -- Guarda fechada
  (8,  'Quebrando a postura na guarda fechada', 'Controle de gola e manga, uso das pernas e ângulo para trazer o adversário para baixo.', 'Prof.ª Camila Rocha', 2, 8930, false, 10),
  (9,  'Armlock da guarda fechada', 'Do controle do braço ao giro de quadril: o armlock mais clássico com todos os detalhes.', 'Prof.ª Camila Rocha', 3, 21560, false, 26),
  (10, 'Triângulo da guarda fechada', 'Montagem, ajuste do ângulo e finalização do triângulo, com variações quando o adversário defende.', 'Prof.ª Camila Rocha', 1, 19340, false, 48),
  (11, 'Kimura da guarda fechada', 'Quando a mão do adversário toca o tatame: entrada, pegada figura-4 e finalização.', 'Prof. Diego Nunes', 2, 11220, false, 60),
  (12, 'Omoplata: entrada e finalização', 'Entrada a partir da guarda fechada, controle da cintura e como evitar que ele role.', 'Prof. Diego Nunes', 3, 7480, false, 96),
  (13, 'Estrangulamento de gola cruzada da guarda', 'Pegada profunda na gola, segunda mão e puxada com os cotovelos para finalizar.', 'Mestre Carlos Ribeiro', 4, 6050, false, 120),

  -- Raspagens
  (14, 'Raspagem de tesoura', 'A raspagem básica da guarda fechada aberta: pegadas, posição das pernas e tempo certo.', 'Prof. Diego Nunes', 5, 9120, false, 14),
  (15, 'Raspagem de gancho (borboleta)', 'Underhook, elevação com o gancho e como terminar na montada ou no cem quilos.', 'Prof. Diego Nunes', 1, 8340, false, 40),
  (16, 'Raspagem de pêndulo', 'Use o balanço da perna para virar o adversário e cair direto na montada.', 'Prof.ª Camila Rocha', 2, 6710, false, 76),
  (17, 'Raspagem por baixo na meia-guarda', 'Underhook, saída para o lado e pegada na perna para raspar da meia-guarda.', 'Prof. Diego Nunes', 3, 5430, false, 110),
  (18, 'Raspagem da De La Riva', 'Ganchos, pegadas de manga e calça e a raspagem mais usada a partir da De La Riva.', 'Prof.ª Camila Rocha', 4, 4990, false, 140),
  (19, 'Raspagem da guarda X', 'Entrada na guarda X a partir da borboleta e a raspagem técnica para ficar em pé.', 'Prof. Diego Nunes', 5, 3870, false, 170),

  -- Passagem de guarda
  (20, 'Passagem toreando', 'Controle das calças, deslocamento lateral e estabilização no cem quilos.', 'Mestre Carlos Ribeiro', 1, 12780, false, 8),
  (21, 'Passagem emborcando a perna (leg drag)', 'Como redirecionar as pernas do guardeiro e travar o quadril para passar.', 'Mestre Carlos Ribeiro', 2, 9540, false, 34),
  (22, 'Passagem over-under', 'Uma perna por cima, outra por baixo: pressão de ombro e caminhada até o cem quilos.', 'Prof. Marcos Tavares', 3, 7210, false, 58),
  (23, 'Passagem cortando com o joelho', 'Knee slice: ângulo do joelho, controle do underhook e finalização da passagem.', 'Mestre Carlos Ribeiro', 4, 10330, false, 82),
  (24, 'Abrindo a guarda fechada em pé', 'Postura em pé, abertura com o joelho e transição segura para a passagem.', 'Prof. Marcos Tavares', 5, 5860, false, 130),
  (25, 'Passando a meia-guarda com cross-face', 'Cross-face, controle do underhook e liberação da perna presa.', 'Mestre Carlos Ribeiro', 6, 4720, false, 160),

  -- Finalizações
  (26, 'Mata-leão: detalhes que fazem a diferença', 'Posição da mão, cabeça e cotovelo para um mata-leão que não escapa.', 'Prof.ª Júlia Andrade', 1, 23410, false, 4),
  (27, 'Estrangulamento cruzado da montada', 'Pegadas na gola a partir da montada e como apertar sem perder a posição.', 'Prof.ª Júlia Andrade', 2, 9860, false, 28),
  (28, 'Guilhotina em pé e no chão', 'Pegada, posição do antebraço e finalização com guarda fechada ou em pé.', 'Prof. Diego Nunes', 3, 11940, false, 54),
  (29, 'Ezequiel da montada', 'Um estrangulamento usando a própria manga, ótimo quando o adversário se fecha.', 'Mestre Carlos Ribeiro', 4, 6370, false, 100),
  (30, 'Americana do cem quilos', 'Pegada figura-4, isolamento do braço e finalização segura a partir do cem quilos.', 'Prof. Marcos Tavares', 5, 7790, false, 125),
  (31, 'Estrangulamento arco e flecha', 'Das costas: pegada na gola, controle da perna e a finalização mais bonita do jiu-jitsu.', 'Prof.ª Júlia Andrade', 6, 14250, true, 150),

  -- Controle e transições
  (32, 'Cem quilos: controle e transições', 'Pressão, troca de posição de quadril e caminhos para a montada e o joelho na barriga.', 'Mestre Carlos Ribeiro', 1, 8120, false, 18),
  (33, 'Joelho na barriga', 'Entrada, equilíbrio e como usar a posição para atacar o braço ou o pescoço.', 'Prof. Marcos Tavares', 2, 5640, false, 64),
  (34, 'Pegando as costas com ganchos', 'Do seatbelt aos ganchos: como chegar e manter as costas do adversário.', 'Prof.ª Júlia Andrade', 3, 10870, false, 90),
  (35, 'Manutenção da montada', 'Montada baixa, alta e técnica: como acompanhar a fuga e não perder a posição.', 'Prof. Marcos Tavares', 4, 6930, false, 145),

  -- Defesas e saídas
  (36, 'Saída da montada com upa e cotovelo', 'As duas saídas fundamentais da montada e quando usar cada uma.', 'Prof. Marcos Tavares', 5, 13650, false, 12),
  (37, 'Saída do cem quilos para a guarda', 'Enquadramento, fuga de quadril e recolocação da guarda debaixo do cem quilos.', 'Prof. Marcos Tavares', 6, 10140, false, 38),
  (38, 'Defesa do mata-leão', 'Proteção do pescoço, controle das mãos e fuga para o lado certo.', 'Prof.ª Júlia Andrade', 1, 8810, false, 68),
  (39, 'Defesa do triângulo', 'Postura, posição do braço e passagem para anular o triângulo antes de fechar.', 'Prof.ª Camila Rocha', 2, 6280, false, 104),
  (40, 'Defesa do armlock (empilhando)', 'Juntar as mãos, empilhar e girar o polegar para escapar do armlock.', 'Prof.ª Camila Rocha', 3, 7020, false, 135),

  -- Quedas e trabalho em pé
  (41, 'Baiana (double leg)', 'Mudança de nível, penetração e finalização da queda com segurança.', 'Prof. Diego Nunes', 4, 9750, false, 16),
  (42, 'Single leg', 'Entrada na perna, controle e três finalizações diferentes da queda.', 'Prof. Diego Nunes', 5, 6480, false, 50),
  (43, 'O-soto-gari', 'Queda do judô adaptada ao jiu-jitsu: desequilíbrio, pegada e ceifada.', 'Mestre Carlos Ribeiro', 6, 5170, false, 86),
  (44, 'Ippon seoi nage', 'Entrada de quadril, pegada no braço e projeção por cima do ombro.', 'Mestre Carlos Ribeiro', 1, 4390, false, 116),
  (45, 'Puxada de guarda com segurança', 'Como puxar para a guarda sem dar pontos nem abrir espaço para a passagem.', 'Prof.ª Camila Rocha', 2, 7360, false, 155),

  -- Chaves de pé
  (46, 'Chave de pé reta', 'A chave de pé permitida desde a faixa branca: posição, pegada e finalização.', 'Prof. Diego Nunes', 3, 8640, false, 22),
  (47, 'Ashi garami: posição e controle', 'A base do jogo de pernas: controle do quadril e do joelho para atacar com segurança.', 'Prof. Diego Nunes', 4, 5920, false, 74),
  (48, 'Chave de calcanhar no sem kimono', 'Mecânica e segurança da chave de calcanhar. Regras: só faixas e categorias que permitem.', 'Prof. Diego Nunes', 5, 6810, false, 128),
  (49, 'Defesa de chave de pé', 'Como esconder o calcanhar, girar na direção certa e sair do ashi garami.', 'Prof. Diego Nunes', 6, 4160, false, 165),

  -- Aquecimento e mobilidade
  (50, 'Aquecimento completo para o treino', 'Sequência de 10 minutos com movimentos específicos do jiu-jitsu.', 'Prof.ª Júlia Andrade', 1, 11280, false, 24),
  (51, 'Mobilidade de quadril para guardeiros', 'Exercícios para ganhar amplitude e manter a guarda mais difícil de passar.', 'Prof.ª Júlia Andrade', 2, 7840, false, 80),
  (52, 'Fortalecimento de pescoço e core', 'Treino complementar para resistir a estrangulamentos e pressão.', 'Prof.ª Júlia Andrade', 3, 5260, false, 112),
  (53, 'Alongamento pós-treino', 'Rotina de recuperação para quadril, ombros e lombar depois do rola.', 'Prof.ª Júlia Andrade', 4, 6590, false, 160);

insert into public.videos (id, title, description, channel, thumbnail_url, duration_seconds, views, is_premium, published_at)
select
  ('00000000-0000-4000-a000-' || lpad(v.n::text, 12, '0'))::uuid,
  v.title, v.description, v.channel,
  'https://picsum.photos/seed/jiu-jitsu-' || v.n || '/640/360',
  s.seconds, v.views, v.premium,
  now() - make_interval(hours => v.hours)
from _videos v
join _streams s on s.idx = v.stream
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  channel = excluded.channel,
  thumbnail_url = excluded.thumbnail_url,
  duration_seconds = excluded.duration_seconds,
  views = excluded.views,
  is_premium = excluded.is_premium,
  published_at = excluded.published_at;

insert into public.video_sources (video_id, url)
select ('00000000-0000-4000-a000-' || lpad(v.n::text, 12, '0'))::uuid, s.url
from _videos v
join _streams s on s.idx = v.stream
on conflict (video_id) do update set url = excluded.url;

-- ---------- Trilhas (categorias da tela inicial) ----------
delete from public.playlist_videos;
delete from public.playlists;

create temporary table _playlists (
  n int primary key, title text, description text, premium boolean, videos int[]
) on commit drop;

insert into _playlists values
  (1,  'Fundamentos', 'Base, movimentação e regras para quem está começando no tatame.', false,
       array[1, 2, 3, 4, 5, 6, 7]),
  (2,  'Guarda fechada', 'Controle de postura e os ataques clássicos da guarda fechada.', false,
       array[8, 9, 10, 11, 12, 13]),
  (3,  'Raspagens', 'Da tesoura à guarda X: inverta a posição e fique por cima.', false,
       array[14, 15, 16, 17, 18, 19]),
  (4,  'Passagem de guarda', 'Pressão, velocidade e controle para passar qualquer guarda.', true,
       array[24, 20, 21, 22, 23, 25]),
  (5,  'Finalizações', 'Estrangulamentos e chaves de braço de todas as posições.', false,
       array[26, 27, 28, 29, 30, 31, 9, 10, 11]),
  (6,  'Controle e transições', 'Cem quilos, joelho na barriga, montada e costas.', false,
       array[32, 33, 35, 34, 26, 31]),
  (7,  'Defesas e saídas', 'Escape das posições ruins e das finalizações mais comuns.', false,
       array[36, 37, 38, 39, 40, 2, 3]),
  (8,  'Quedas e trabalho em pé', 'Wrestling e judô adaptados ao jiu-jitsu, mais a puxada de guarda.', false,
       array[41, 42, 43, 44, 45]),
  (9,  'Chaves de pé', 'Jogo de pernas do básico ao sem kimono, com foco em segurança.', true,
       array[47, 46, 48, 49]),
  (10, 'Aquecimento e mobilidade', 'Prepare o corpo para treinar e se recuperar melhor.', false,
       array[50, 51, 52, 53, 4]);

insert into public.playlists (id, title, description, position, is_premium)
select
  ('00000000-0000-4000-b000-' || lpad(p.n::text, 12, '0'))::uuid,
  p.title, p.description, p.n - 1, p.premium
from _playlists p;

insert into public.playlist_videos (playlist_id, video_id, position)
select
  ('00000000-0000-4000-b000-' || lpad(p.n::text, 12, '0'))::uuid,
  ('00000000-0000-4000-a000-' || lpad(item.video_n::text, 12, '0'))::uuid,
  item.ord - 1
from _playlists p
cross join lateral unnest(p.videos) with ordinality as item(video_n, ord);
