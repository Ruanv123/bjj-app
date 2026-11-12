-- Dados de exemplo: streams públicos de teste (Mux, Apple, Unified Streaming, Shaka, MDN).
-- Apague ou substitua pelos seus vídeos quando tiver conteúdo real.

insert into public.videos (id, title, description, channel, thumbnail_url, video_url, duration_seconds, published_at) values
  ('00000000-0000-4000-a000-000000000001', 'Big Buck Bunny',
   'Curta de animação aberto da Blender Foundation (CC BY 3.0).', 'Blender Foundation',
   'https://picsum.photos/seed/big-buck-bunny/640/360',
   'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', 596, now() - interval '2 hours'),
  ('00000000-0000-4000-a000-000000000002', 'Tears of Steel',
   'Filme de ficção científica aberto da Blender Foundation (CC BY 3.0).', 'Blender Foundation',
   'https://picsum.photos/seed/tears-of-steel/640/360',
   'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', 734, now() - interval '5 hours'),
  ('00000000-0000-4000-a000-000000000003', 'Tears of Steel (com legendas)',
   'O mesmo filme, servido com faixas de legenda.', 'Mux Test Streams',
   'https://picsum.photos/seed/tears-of-steel-subs/640/360',
   'https://test-streams.mux.dev/tos_ismc/main.m3u8', 734, now() - interval '1 day'),
  ('00000000-0000-4000-a000-000000000004', 'Bipbop: exemplo avançado de HLS',
   'Stream de referência da Apple com várias qualidades de vídeo e áudio.', 'Apple Developer',
   'https://picsum.photos/seed/bipbop/640/360',
   'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8', null, now() - interval '2 days'),
  ('00000000-0000-4000-a000-000000000005', 'Angel One',
   'Stream HLS de demonstração do Shaka Player.', 'Shaka Player',
   'https://picsum.photos/seed/angel-one/640/360',
   'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8', null, now() - interval '3 days'),
  ('00000000-0000-4000-a000-000000000006', 'Flor em câmera lenta',
   'Vídeo curto em domínio público (CC0) da MDN.', 'MDN Web Docs',
   'https://picsum.photos/seed/flower/640/360',
   'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', null, now() - interval '4 days');

insert into public.playlists (id, title, description, position) values
  ('00000000-0000-4000-b000-000000000001', 'Filmes abertos', 'Curtas da Blender Foundation.', 0),
  ('00000000-0000-4000-b000-000000000002', 'Demonstrações de streaming', 'Streams de referência para testar o player.', 1),
  ('00000000-0000-4000-b000-000000000003', 'Para ver rapidinho', 'Vídeos curtos.', 2);

insert into public.playlist_videos (playlist_id, video_id, position) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 0),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 1),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000003', 2),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000004', 0),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000005', 1),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000002', 2),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000006', 0),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000005', 1),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001', 2);
