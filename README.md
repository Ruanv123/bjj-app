# BJJ App

Aplicativo open source para praticantes de jiu-jítsu estudarem técnicas e se conectarem com outros atletas. Reúne aulas em vídeo, trilhas de aprendizado, feed social, perfis esportivos e comunidades com chat.

Desenvolvido com Expo, React Native e TypeScript, com foco em Android e iOS e uma versão web. O nome técnico usado na configuração do Expo ainda é `app-mobile`.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e configuração](#instalação-e-configuração)
- [Executando o aplicativo](#executando-o-aplicativo)
- [Integrações opcionais](#integrações-opcionais)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Comandos e verificações](#comandos-e-verificações)
- [Builds e distribuição](#builds-e-distribuição)
- [Solução de problemas](#solução-de-problemas)
- [Como contribuir](#como-contribuir)
- [Licença](#licença)

## Funcionalidades

- **Aulas e trilhas:** catálogo de vídeos de jiu-jítsu, busca, playlists, comentários e vídeos salvos.
- **Reprodução de vídeo:** player com suporte configurado para reprodução em segundo plano e picture-in-picture nos dispositivos compatíveis.
- **Feed social:** publicações, respostas, curtidas e acompanhamento de outros atletas, com abas de todos e de perfis seguidos.
- **Perfis de atletas:** foto, faixa, informações esportivas e registros de competições, com visualização de perfis de outros usuários.
- **Chat e comunidades:** conversas privadas, comunidades públicas e privadas, convites, imagens, reações, edição e exclusão de mensagens, busca e presença em tempo real.
- **Moderação:** bloqueio de usuários, denúncias e administração de comunidades.
- **Autenticação:** cadastro e login por e-mail e senha, Google e Apple, além de exclusão de conta.
- **Conteúdo premium:** integração com RevenueCat e Superwall para compras, restauração e paywalls.
- **Personalização:** temas claro e escuro e interface em português do Brasil, português de Portugal, inglês, espanhol, francês, alemão e italiano.
- **Notificações:** push para mensagens do chat, quando o serviço estiver configurado.

Alguns recursos dependem de serviços externos, credenciais e configuração nativa. As seções abaixo distinguem a configuração básica das integrações opcionais.

## Tecnologias

| Área | Tecnologias |
| --- | --- |
| Aplicativo | Expo SDK 58, React 19.3 e React Native 0.88 |
| Linguagem e navegação | TypeScript em modo estrito e Expo Router |
| Backend | Supabase Auth, PostgreSQL, Storage, Realtime e Edge Functions |
| Estado e dados | TanStack Query e Zustand |
| Formulários | React Hook Form e Zod |
| Interface e movimento | Expo UI, React Native Reanimated, Gesture Handler e FlashList |
| Mídia e persistência | Expo Video, Expo Image e Expo SQLite |
| Internacionalização | i18next, react-i18next e Expo Localization |
| Assinaturas | RevenueCat e Superwall |
| Monitoramento | Sentry |
| Qualidade | ESLint, TypeScript, Jest e React Native Testing Library |

As versões completas estão no [package.json](./package.json), e as dependências resolvidas estão no [package-lock.json](./package-lock.json).

## Pré-requisitos

- Git.
- Node.js compatível com as dependências do SDK 58. Uma opção é **Node.js 24.3 ou superior da linha 24**; a linha 22 é aceita a partir de 22.13.
- npm, usado neste repositório com `package-lock.json`.
- Um projeto próprio no [Supabase](https://supabase.com/) para autenticação e dados. Não há modo com backend simulado configurado.
- Para executar o app nativo: uma development build instalada em um dispositivo ou emulador.

Para compilar localmente, Android exige o ambiente de desenvolvimento Android; iOS exige macOS com Xcode. A alternativa é gerar builds na nuvem com uma conta Expo, sem instalar essas ferramentas localmente. Consulte a [documentação de development builds](https://docs.expo.dev/develop/development-builds/introduction.md).

## Instalação e configuração

### 1. Obtenha o código e instale as dependências

```bash
git clone https://github.com/Ruanv123/bjj-app.git
cd bjj-app
npm ci
```

Se estiver contribuindo, faça um fork e clone o seu fork.

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

No Windows, você também pode copiar o arquivo pelo explorador de arquivos. Edite `.env.local` e substitua os valores de exemplo. Para começar, preencha as duas variáveis do Supabase e deixe vazias ou remova as variáveis das integrações que não pretende usar.

| Variável | Necessidade | Finalidade |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Obrigatória | URL do seu projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Obrigatória | Chave publicável do projeto Supabase |
| `EXPO_PUBLIC_SENTRY_DSN` | Opcional | Envio de erros para o Sentry; sem DSN, o monitoramento fica desativado |
| `SENTRY_ORG` | Para builds com Sentry | Organização no Sentry |
| `SENTRY_PROJECT` | Para builds com Sentry | Projeto no Sentry |
| `SENTRY_AUTH_TOKEN` | Para enviar source maps | Token privado usado no processo de build |
| `EXPO_PUBLIC_SUPERWALL_IOS_KEY` | Para assinaturas no iOS | Chave pública do Superwall |
| `EXPO_PUBLIC_SUPERWALL_ANDROID_KEY` | Para assinaturas no Android | Chave pública do Superwall |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | Para assinaturas no iOS | Chave pública do RevenueCat, com prefixo `appl_` |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Para assinaturas no Android | Chave pública do RevenueCat, com prefixo `goog_` |

O cliente lança um erro ao iniciar se as duas variáveis obrigatórias não estiverem definidas. Elas são lidas em [src/lib/supabase.ts](./src/lib/supabase.ts).

As variáveis `EXPO_PUBLIC_*` são incorporadas ao aplicativo e podem ser lidas por quem o utiliza. Nunca coloque nelas a chave `service_role`, senhas de banco ou tokens privados. `.env.local` está ignorado pelo Git; mantenha somente valores fictícios em `.env.example`. Veja a [documentação de variáveis do Expo](https://docs.expo.dev/guides/environment-variables.md).

### 3. Prepare o Supabase

Use um projeto de desenvolvimento próprio. O schema, as funções SQL, as políticas de acesso e os buckets estão versionados em [supabase/migrations](./supabase/migrations).

Para preparar a configuração local da CLI e vincular esse projeto:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
```

O repositório ainda não inclui `supabase/config.toml`; `init` gera esse arquivo para a sua configuração. O `SEU_PROJECT_REF` é o identificador do projeto no painel do Supabase.

Revise as migrations que serão aplicadas e execute-as no projeto vinculado:

```bash
npx supabase db push --remote --dry-run
npx supabase db push --remote
```

Esses comandos usam a [CLI do Supabase](https://supabase.com/docs/reference/cli/supabase-db-push). As migrations incluem dados de demonstração: parte do catálogo tem títulos de jiu-jítsu, mas usa vídeos públicos de teste e imagens ilustrativas. Substitua esse conteúdo pelo seu catálogo antes de distribuir o aplicativo.

No painel do Supabase, configure também:

1. **Authentication:** habilite e-mail/senha. Ative Google e Apple se quiser disponibilizar esses métodos, configurando as credenciais de cada provedor.
2. **URLs de autenticação:** autorize `appmobile://auth/callback` nas Redirect URLs para a configuração nativa atual. No desenvolvimento, o terminal mostra `[auth] redirectTo:` com o endereço utilizado. Para web, autorize a origem exibida pelo servidor de desenvolvimento e, depois, a origem de produção.
3. **Confirmação de e-mail:** se estiver habilitada, confirme a conta pelo link recebido antes de fazer login.
4. **Realtime:** desative `Allow public access`, conforme indicado na migration do chat. As conversas usam Broadcast em canais privados com políticas de autorização.

Para disponibilizar a exclusão de conta, publique a função correspondente:

```bash
npx supabase functions deploy delete-account
```

Ela valida a sessão do solicitante no servidor e usa a credencial administrativa disponível no ambiente das Edge Functions. Essa credencial não deve ser adicionada ao aplicativo.

## Executando o aplicativo

### Android e iOS

Use uma **development build** para desenvolver com os módulos nativos do projeto. O Expo Go não oferece todas as integrações necessárias, especialmente compras e paywalls.

Com o ambiente nativo preparado, compile e execute uma das plataformas:

```bash
# Android
npm run android

# iOS — requer macOS e Xcode
npm run ios
```

Esses scripts executam `expo run:android` e `expo run:ios`. Os diretórios `android/` e `ios/` são gerados pelo Expo e ignorados pelo Git. Configure alterações nativas em [app.json](./app.json) e por config plugins.

Se já tiver uma development build instalada, inicie apenas o servidor:

```bash
npm start -- --dev-client
```

Abra o app no dispositivo ou use as opções do terminal para o emulador. Gere uma nova build quando adicionar dependências com código nativo ou alterar a configuração nativa. Para compilar na nuvem, consulte [Builds e distribuição](#builds-e-distribuição).

### Web

```bash
npm run web
```

Abra o endereço informado no terminal. Na web, assinaturas nativas e registro de push do chat ficam indisponíveis; o login com Apple usa o navegador, enquanto no iOS existe um fluxo nativo.

## Integrações opcionais

### Assinaturas: RevenueCat e Superwall

O app pode ser desenvolvido sem as chaves dessas integrações. Nesse caso, o provider de assinaturas mantém o paywall desativado e o estado premium do cliente como falso. A autorização de conteúdo no banco continua dependendo das políticas e entitlements do Supabase.

Para habilitar compras em uma build Android ou iOS:

1. Configure os produtos nas lojas e no RevenueCat, com a entitlement **`premium`**.
2. Configure os paywalls no Superwall e os placements **`campaign_trigger`** e **`premium_content`**.
3. Preencha as chaves públicas do RevenueCat e do Superwall da plataforma em `.env.local` e no ambiente de build.
4. Configure os secrets `REVENUECAT_SECRET_API_KEY` e `REVENUECAT_WEBHOOK_AUTH` no ambiente das Edge Functions do Supabase. A primeira é a chave secreta v1 do RevenueCat; a segunda deve ser um valor longo e aleatório para autenticar o webhook.
5. Publique as funções:

```bash
npx supabase functions deploy sync-subscription
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

No RevenueCat, configure o webhook com a URL `https://SEU_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook` e o mesmo valor de `REVENUECAT_WEBHOOK_AUTH` no campo `Authorization header`.

O app identifica o cliente no RevenueCat e no Superwall pelo ID do usuário do Supabase. O webhook e a função `sync-subscription` consultam o RevenueCat para atualizar `user_entitlements`. O webhook usa autenticação própria por segredo, por isso é publicado com `--no-verify-jwt`.

As assinaturas permanecem desativadas no Expo Go e na web. Consulte [src/features/subscription/config.ts](./src/features/subscription/config.ts) para os identificadores utilizados.

### Push do chat

O chat funciona sem envio de push. Para ativá-lo:

1. Vincule sua cópia do app a um projeto Expo próprio e configure as credenciais de push da plataforma.
2. No SQL Editor do seu projeto Supabase, crie os segredos do Vault, substituindo os valores fictícios:

```sql
select vault.create_secret('https://SEU_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('SUBSTITUA_POR_UM_SEGREDO_LONGO_E_ALEATORIO', 'chat_push_secret');
```

3. Configure `CHAT_PUSH_SECRET` no ambiente das Edge Functions com o mesmo valor de `chat_push_secret`.
4. Se usar Enhanced Push Security no Expo, configure também `EXPO_ACCESS_TOKEN` nas Edge Functions.
5. Publique a função:

```bash
npx supabase functions deploy chat-push --no-verify-jwt
```

O banco chama essa função por trigger e `pg_net`. Ela valida `CHAT_PUSH_SECRET` antes de processar a solicitação. Teste em uma build nativa com as permissões de notificações concedidas. Os detalhes estão na [migration de moderação, mídia e push](./supabase/migrations/20261111160000_chat_moderation_media_push.sql) e na [função chat-push](./supabase/functions/chat-push/index.ts).

### Monitoramento: Sentry

Preencha `EXPO_PUBLIC_SENTRY_DSN` para habilitar o monitoramento. Para envio de source maps durante o build, configure também `SENTRY_ORG`, `SENTRY_PROJECT` e `SENTRY_AUTH_TOKEN` no ambiente de build; o token deve ser secreto. A inicialização está em [src/lib/sentry.ts](./src/lib/sentry.ts), e o config plugin já está registrado em `app.json`.

## Estrutura do projeto

```text
assets/                  Ícones, fontes e imagens
jest/                    Mocks compartilhados dos testes
src/
  app/                   Telas e layouts do Expo Router
    (tabs)/              Feed, vídeos, chat, notificações e perfil
    auth/                Callback de autenticação
    chat/                Conversas e administração
    community/           Criação e entrada em comunidades
    people/              Perfis públicos de atletas
    playlist/            Detalhes e fila de uma trilha
    posts/               Composição e detalhes de publicações
    settings/            Conta, aparência, idioma e perfil
    video/               Detalhes de um vídeo
  components/            Componentes compartilhados e elementos de interface
  constants/             Tokens de tema
  features/              Módulos por funcionalidade
    auth/                Sessão, formulários e login
    chat/                API, Realtime, cache e interface do chat
    comments/            Comentários dos vídeos
    feed/                Publicações e relações sociais
    notifications/       Registro e tratamento de push
    player/              Reprodução de vídeo
    profile/             Perfis e informações esportivas
    subscription/        Compras, paywalls e acesso premium
    videos/              Catálogo, playlists e vídeos salvos
  hooks/                 Hooks compartilhados
  lib/                   Clientes, armazenamento, erros e traduções
supabase/
  functions/             Edge Functions e código compartilhado do servidor
  migrations/            Schema, políticas, funções SQL e dados de exemplo
  tests/                 Verificações SQL de comportamento e acesso
```

As rotas ficam em `src/app/`; componentes, hooks e lógica de negócio ficam fora dessa pasta. Os módulos de `features/` agrupam suas APIs, tipos, hooks, componentes e testes. O alias `@/` aponta para `src/`, e `@/assets/` aponta para `assets/`.

O TanStack Query gerencia o cache de dados remotos. No chat, o banco é a fonte de verdade, e o Realtime sinaliza mudanças que o cliente pode recuperar por consulta. A proteção dos dados depende das políticas de acesso e funções no Supabase, além das validações da interface.

## Comandos e verificações

| Comando | Finalidade |
| --- | --- |
| `npm start` | Inicia o servidor de desenvolvimento Expo |
| `npm start -- --dev-client` | Inicia o servidor direcionado à development build |
| `npm run android` | Compila e executa o app Android localmente |
| `npm run ios` | Compila e executa o app iOS localmente |
| `npm run web` | Inicia a versão web |
| `npm run lint` | Verifica o código com ESLint |
| `npm run typecheck` | Verifica os tipos sem emitir arquivos |
| `npm test` | Executa os testes Jest |
| `npm test -- --watch` | Executa os testes em modo de observação |
| `npx expo-doctor` | Diagnostica dependências e configuração do Expo |

Antes de abrir um pull request, execute:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

Os testes do app ficam nas pastas `__tests__` dos módulos e usam o preset `jest-expo`. Os arquivos em `supabase/tests/` são verificações SQL separadas, que devem ser executadas após as migrations em um banco de teste. O `typecheck` do app exclui as Edge Functions, que usam o runtime Deno.

Para adicionar dependências, utilize a resolução de versões compatíveis do Expo:

```bash
npx expo install NOME_DO_PACOTE
```

O script legado `reset-project` ainda está declarado no `package.json`, mas o arquivo `scripts/reset-project.js` não está presente. Ele não faz parte do fluxo de desenvolvimento deste aplicativo.

## Builds e distribuição

Os perfis estão em [eas.json](./eas.json):

| Perfil | Uso | Ambiente |
| --- | --- | --- |
| `development` | Cliente de desenvolvimento com distribuição interna | `development` |
| `preview` | Build para testes com distribuição interna | `preview` |
| `production` | Build para as lojas, com incremento automático de versão | `production` |

Ao usar um fork, revise `owner`, `extra.eas.projectId`, `ios.bundleIdentifier`, `android.package` e `scheme` em `app.json`. O projeto está atualmente vinculado à conta do mantenedor. Para vincular sua cópia a um projeto próprio, remova o `extra.eas.projectId` existente e ajuste `owner` para sua conta antes de executar:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Se alterar o scheme, atualize também os endereços autorizados no Supabase. Configure as variáveis necessárias no ambiente EAS correspondente: `.env.local` é ignorado pelo Git e não deve ser considerado a configuração do build na nuvem.

Exemplos para Android:

```bash
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile production
```

Para iOS, substitua `android` por `ios`. O perfil atual de desenvolvimento não define `ios.simulator`; uma build para o simulador exige um perfil com essa opção habilitada. A distribuição em aparelhos iOS e nas lojas depende das contas e credenciais exigidas pela Apple e pelo Google.

Após configurar as credenciais e gerar a build de produção, a submissão pode ser feita com:

```bash
npx eas-cli@latest submit --platform android --profile production
```

Consulte a [documentação de builds do Expo](https://docs.expo.dev/build/setup.md). Atualizações OTA ainda exigem configuração adicional: o projeto não declara `expo-updates` entre as dependências atuais.

## Solução de problemas

| Problema | O que verificar |
| --- | --- |
| Erro pedindo variáveis do Supabase ao abrir | Preencha as duas variáveis obrigatórias em `.env.local` e reinicie o servidor |
| Login social não retorna ao app | Confira as credenciais do provedor e autorize o endereço mostrado em `[auth] redirectTo:` no Supabase |
| Cadastro não inicia uma sessão | Verifique se a confirmação de e-mail está habilitada e confirme a conta |
| Tabela ou função SQL não encontrada | Confira se todas as migrations foram aplicadas no mesmo projeto usado pelo app |
| Chat sem atualizações em tempo real | Confira a sessão, as políticas de Realtime e a configuração de canais privados |
| Paywall não abre | Use uma build nativa e confira as chaves da plataforma, os placements e os produtos |
| Compra não libera conteúdo | Verifique a entitlement `premium`, `sync-subscription`, webhook e secrets do RevenueCat no Supabase |
| Push não chega | Confira permissões, projeto Expo, credenciais da plataforma, Vault e `CHAT_PUSH_SECRET` |
| Módulo nativo ausente | Gere outra development build após instalar ou alterar dependências nativas |

Se houver suspeita de cache desatualizado do Metro:

```bash
npm start -- --clear
```

## Como contribuir

Contribuições de código, documentação, traduções e relatos de bugs são bem-vindas.

1. Consulte as [issues](https://github.com/Ruanv123/bjj-app/issues) existentes. Para mudanças maiores, abra uma issue descrevendo o problema e a proposta.
2. Faça um fork, crie uma branch com um nome descritivo e prepare seu ambiente com um projeto Supabase de desenvolvimento.
3. Leia [AGENTS.md](./AGENTS.md) e siga a organização existente. Para mudanças em APIs do Expo, consulte a [documentação do SDK 58](https://docs.expo.dev/versions/v58.0.0/).
4. Mantenha componentes e lógica fora de `src/app/`, preserve o comportamento entre plataformas e adicione traduções em `src/lib/i18n/locales/` ao introduzir textos na interface.
5. Para alterações no banco, crie uma nova migration e revise as políticas de acesso. Evite modificar migrations já aplicadas.
6. Execute lint, typecheck e os testes relevantes. Ao alterar a interface, registre as plataformas testadas e inclua capturas ou uma gravação no pull request.
7. Abra um [pull request](https://github.com/Ruanv123/bjj-app/pulls) explicando o problema, a solução e como verificou a alteração.

Ao relatar um bug, informe os passos para reproduzir, o comportamento esperado, a plataforma, a versão do sistema e se usou web ou uma build nativa. Remova dados pessoais, credenciais e tokens dos logs antes de compartilhá-los. Não publique segredos em issues ou pull requests.

## Licença

Distribuído sob a licença [MIT](./LICENSE). O arquivo de licença atual preserva o aviso de copyright da Expo (650 Industries, Inc.).
