# @diegomodesto/ns

🇧🇷 Português | [🇺🇸 English](README.en.md)

CLI para projetos NetSuite SuiteCloud com foco em TypeScript. Funciona como uma camada sobre o [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli) oficial: o `suitecloud` continua cuidando da autenticação e do deploy, e o `nsk` cuida do que hoje é manual — compilar o TypeScript, encontrar o `.js` certo no File Cabinet, gerar scripts tipados e trocar de conta.

> **Status:** em desenvolvimento (`0.0.0`). Hoje o CLI traz os templates, os snippets e o `nsk doctor`; os demais comandos de projeto estão no [roadmap](#roadmap).

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
| `nsk upload [arquivos]` | Compila e envia o `.js` correspondente para o File Cabinet |
| `nsk watch` | Compila e envia automaticamente a cada vez que um arquivo é salvo |
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
  commands/          comandos do CLI (doctor, templates)
  core/              config, caminhos, wrapper do suitecloud e do tsc
templates/           templates gerados (javascript/, typescript/, sdf/, manifest.json)
snippets/            snippets do VS Code (fonte dos templates)
scripts/             scripts de manutenção
test/                testes
```
