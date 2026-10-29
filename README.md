# @diegomodesto/ns

🇧🇷 Português | [🇺🇸 English](README.en.md)

CLI para projetos NetSuite SuiteCloud com foco em TypeScript. Funciona como uma camada sobre o [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli) oficial: o `suitecloud` continua cuidando da autenticação e do deploy, e o `nsk` cuida do que hoje é manual — compilar o TypeScript, encontrar o `.js` certo no File Cabinet, gerar scripts tipados e trocar de conta.

> **Status:** em desenvolvimento (`0.0.0`). Hoje o CLI traz os templates, os snippets, o `nsk doctor`, o `nsk upload` e o `nsk watch`; os demais comandos de projeto estão no [roadmap](#roadmap).

## Requisitos

- Node.js `>= 22.12`
- [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli) instalado e configurado (`suitecloud account:setup`)

## Instalação

Ainda não publicado no npm. Para usar a partir do código-fonte:

```bash
git clone git@github.com:DiegoModesto/ns-cli.git
cd ns-cli
npm install
npm run build
npm link        # disponibiliza o comando "nsk" globalmente
```

Depois da primeira release:

```bash
npm install -g @diegomodesto/ns
```

## Uso

```bash
nsk --version
nsk doctor                                       # verifica o ambiente e mostra como o nsk enxerga o projeto
nsk templates list                               # lista os templates disponíveis
nsk templates show user-event-script             # imprime o template TypeScript
nsk templates show restlet --language javascript # versão JavaScript
nsk templates show script-object                 # objeto SDF (XML) com deployment
nsk upload src/Source/App/ue_sales_order.ts      # compila e envia o .js correspondente
nsk watch                                        # compila e envia a cada arquivo salvo
```

### `nsk doctor`

Rode dentro de um projeto SuiteCloud (em qualquer subpasta):

```text
✔ Node.js          v22.18.0
✔ SuiteCloud CLI   3.0.2
✔ Project root     /Users/voce/Repos/meu-projeto
✔ Config           defaults (no ns.config.json)
✔ FileCabinet      src/FileCabinet
✔ TypeScript       src/Source → src/FileCabinet/SuiteScripts (tsconfig.json)
✔ Auth ID          sandbox
```

Termina com código `1` se algo estiver faltando (CLI não instalado, `ns.config.json` inválido, conta não configurada).

### `nsk upload`

Envia arquivos para o File Cabinet. Aceita fontes `.ts` (envia o `.js` compilado) e arquivos que já estão dentro da pasta `FileCabinet`:

```bash
nsk upload src/Source/App/ue_sales_order.ts
nsk upload src/FileCabinet/SuiteScripts/lib/utils.js src/Source/App/cs_order.ts
nsk upload --dry-run src/Source/App/*.ts     # só mostra fonte → caminho no File Cabinet
nsk upload --no-compile src/Source/App/a.ts  # envia o .js existente sem compilar
```

Se algum arquivo for `.ts`, o projeto é compilado uma vez (com o `tsc` do próprio projeto) e todos os arquivos vão em uma única chamada ao `suitecloud file:upload`. O SuiteCloud só aceita arquivos dentro de `/SuiteScripts`, `/SuiteApps`, `/Templates/E-mail Templates`, `/Templates/Marketing Templates` e `/Web Site Hosting Files`; o `nsk` recusa os demais antes de chamar o `suitecloud`.

### `nsk watch`

Substitui as tasks do VS Code de "compile watch" + "upload": roda o `tsc --watch` e envia cada arquivo alterado dentro do `FileCabinet`.

```bash
nsk watch              # compila e envia a cada arquivo salvo
nsk watch --no-upload  # só compila
```

- Nada é enviado na primeira compilação; só as alterações feitas depois dela.
- **Com erro de TypeScript, nada é enviado** até o erro ser corrigido (o `tsc` gera o `.js` mesmo com erro).
- Alterações próximas são agrupadas em um único upload, e um upload nunca roda em paralelo com outro.
- Arquivos com o mesmo conteúdo do último envio não são reenviados.
- `.map`, `.d.ts`, `.tsbuildinfo` e arquivos ocultos são ignorados. Arquivos apagados continuam na conta.
- Uma falha de upload é mostrada e o `watch` continua rodando. `Ctrl+C` encerra tudo.
- Em projetos sem `tsconfig`, envia os arquivos alterados no `FileCabinet` sem compilar.

## Configuração

O `nsk` lê o projeto a partir de:

| Fonte | O que é usado |
|---|---|
| `suitecloud.config.js` | `defaultProjectFolder` (padrão `src`) → a pasta `FileCabinet` fica dentro dele |
| `tsconfig.json` | `compilerOptions.rootDir` (fontes `.ts`) e `outDir` (`.js` compilado, dentro do `FileCabinet`); segue `extends` relativos |
| `project.json` | `defaultAuthId`, criado pelo `suitecloud account:setup` |
| `ns.config.json` | Opcional, para sobrescrever os valores acima |

Exemplo de `ns.config.json` (todos os campos são opcionais):

```jsonc
{
  "tsconfig": "tsconfig.build.json",          // padrão: tsconfig.json
  "sourceDir": "src/Source",                  // sobrescreve compilerOptions.rootDir
  "outDir": "src/FileCabinet/SuiteScripts"    // sobrescreve compilerOptions.outDir
}
```

Com essa configuração, `src/Source/App/ue_sales_order.ts` é compilado para `src/FileCabinet/SuiteScripts/App/ue_sales_order.js` e enviado como `/SuiteScripts/App/ue_sales_order.js`. Projetos sem `tsconfig` funcionam como JavaScript puro.

## Templates

Todos usam `@NApiVersion 2.1` e `@NModuleScope SameAccount`. As versões TypeScript usam os tipos de [`@hitc/netsuite-types`](https://www.npmjs.com/package/@hitc/netsuite-types), e as JavaScript usam `define` (AMD).

| Id | `@NScriptType` | Linguagens |
|---|---|---|
| `custom-module` | — (módulo) | JS, TS |
| `scheduled-script` | `ScheduledScript` | JS, TS |
| `client-script` | `ClientScript` | JS, TS |
| `user-event-script` | `UserEventScript` | JS, TS |
| `map-reduce-script` | `MapReduceScript` | JS, TS |
| `suitelet` | `Suitelet` | JS, TS |
| `restlet` | `Restlet` | JS, TS |
| `event-subscriber` | `EventSubscriber` | JS, TS |
| `mass-update-script` | `MassUpdateScript` | JS, TS |
| `portlet-script` | `Portlet` | JS, TS |
| `workflow-action-script` | `WorkflowActionScript` | JS, TS |
| `bundle-installation-script` | `BundleInstallationScript` | JS, TS |
| `sdf-installation-script` | `SDFInstallationScript` | JS, TS |
| `script-object` | Objeto SDF (Client/User Event + deploy) | XML |

O template `script-object` usa marcadores `{{scriptType}}`, `{{scriptId}}`, `{{description}}`, `{{name}}`, `{{scriptFile}}`, `{{logLevel}}`, `{{recordType}}` e `{{status}}`, que serão preenchidos pelo `nsk generate`.

Boas práticas já embutidas:

- Entry points de validação do Client Script (`saveRecord`, `validateField`, `validateLine`, `validateInsert`, `validateDelete`) retornam `true` — caso contrário o NetSuite bloqueia a ação.
- RESTlets retornam um corpo de resposta; no TypeScript, `delete_` é exportado como `delete`.
- O `summarize` do Map/Reduce registra os erros das etapas `getInputData`, `map` e `reduce`.

## Snippets para VS Code

O arquivo [`snippets/NetSuiteSnippets.json`](snippets/NetSuiteSnippets.json) tem os mesmos templates como snippets do VS Code (prefixos `ns*` para JavaScript e `ts*` para TypeScript), além de imports e utilitários.

1. `Ctrl/Command + Shift + P` → **Snippets: Configure Snippets** → **New Global Snippets file...**
2. Cole o conteúdo de `snippets/NetSuiteSnippets.json` e salve.
3. Digite o prefixo (ex.: `tsUserEvent`) em um arquivo `.ts` e pressione `Tab`.

Os snippets são a fonte dos templates: ao alterar o JSON, rode `npm run sync:templates` para regenerar a pasta `templates/`. O CI falha se as duas coisas estiverem fora de sincronia.

## Roadmap

| Comando | Descrição |
|---|---|
| `nsk init` | Cria um projeto SDF já configurado para TypeScript (`tsconfig`, `@hitc/netsuite-types`, `src/Source`, `ns.config.json`) |
| `nsk generate <tipo> <nome>` | Gera um script a partir dos templates; com `--object`, gera também o XML SDF com deploy |
| `nsk validate` / `nsk deploy` | Compila e executa `project:validate` / `project:deploy` |
| `nsk account` | Lista, troca e configura contas (sandbox, produção) |

## Desenvolvimento

```bash
npm install
npm run typecheck        # código do CLI + templates TypeScript
npm test                 # vitest
npm run build            # gera dist/ com tsup
npm run sync:templates   # regenera templates/ a partir dos snippets
```

Estrutura:

```
src/
  commands/          comandos do CLI (doctor, templates, upload, watch)
  core/              config, caminhos, wrappers do suitecloud e do tsc, fila de upload do watch
templates/           templates gerados (javascript/, typescript/, sdf/, manifest.json)
snippets/            snippets do VS Code (fonte dos templates)
scripts/             scripts de manutenção
test/                testes
```
