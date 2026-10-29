# @diegomodesto/ns

🇧🇷 Português | [🇺🇸 English](README.en.md)

CLI para projetos NetSuite SuiteCloud com foco em TypeScript. Funciona como uma camada sobre o [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli) oficial: o `suitecloud` continua cuidando da autenticação e do deploy, e o `nsk` cuida do que hoje é manual — compilar o TypeScript, encontrar o `.js` certo no File Cabinet, gerar scripts tipados e trocar de conta.

> **Status:** `0.1.0`, primeira versão. Validado em sandbox: `init`, `generate`, `build`, `validate` e `deploy --dry-run`. `upload`, `watch`, `deploy` e `account` ainda não foram validados contra uma conta real — se algo falhar, abra uma [issue](https://github.com/DiegoModesto/ns-cli/issues).

## Requisitos

- Node.js `>= 22.12`
- [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli) instalado e configurado (`suitecloud account:setup`)

## Instalação

```bash
npm install -g @diegomodesto/ns
nsk --version
```

Projetos criados pelo `nsk init` também recebem o `@diegomodesto/ns` nas `devDependencies`, então os scripts `npm run build`/`watch`/`deploy` funcionam sem a instalação global.

Para usar a partir do código-fonte:

```bash
git clone git@github.com:DiegoModesto/ns-cli.git
cd ns-cli
npm install
npm run build
npm link        # disponibiliza o comando "nsk" globalmente
```

## Uso

```bash
nsk --version
nsk init meu-projeto                             # cria um projeto SDF pronto para TypeScript
nsk doctor                                       # verifica o ambiente e mostra como o nsk enxerga o projeto
nsk templates list                               # lista os templates disponíveis
nsk templates show user-event-script             # imprime o template TypeScript
nsk templates show restlet --language javascript # versão JavaScript
nsk templates show script-object                 # objeto SDF (XML) com deployment
nsk generate user-event-script ue_sales_order    # cria src/Source/ue_sales_order.ts a partir do template
nsk upload src/Source/App/ue_sales_order.ts      # compila e envia o .js correspondente
nsk watch                                        # compila e envia a cada arquivo salvo
nsk deploy                                       # compila e faz o deploy do projeto
nsk account use sandbox                          # troca a conta do projeto
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

### Ajuda e idioma

```bash
nsk --help                   # comandos agrupados, com explicação
nsk deploy --help            # opções e exemplos de um comando (ou: nsk help deploy)
nsk --help --lang en         # ajuda em inglês
```

A ajuda está em português e inglês. O idioma vem de `--lang pt|en` (vale em qualquer posição do comando), da variável `NSK_LANG` ou do idioma do sistema (`LC_ALL`, `LC_MESSAGES`, `LANG`): tudo que começa com `pt` mostra português, o resto mostra inglês. Para fixar: `export NSK_LANG=pt`. As mensagens de erro e de progresso continuam em inglês.

### `nsk init`

Cria um projeto SuiteCloud já pronto para TypeScript:

```bash
nsk init meu-projeto                     # account customization project
nsk init meu-app --suiteapp --publisher-id com.acme --project-id myapp [--project-version 1.0.0]
```

Roda o `suitecloud project:create` e adiciona `package.json`, `tsconfig.json`, `ns.config.json`, `rollup.config.mjs` e `src/Source/`, depois executa `npm install` (pule com `--no-install`). A pasta criada é `<nome>` ou, em SuiteApps, `<publisherid>.<projectid>`. Uma pasta que não está vazia só é usada com `--force`.

**TypeScript 7 + rollup:** o TypeScript 7 não gera mais AMD (`define`), que o SuiteScript exige. Nos projetos criados pelo `nsk init`, o `tsc` só faz a checagem de tipos (`noEmit`) e o rollup gera um `.js` AMD por módulo, mantendo a estrutura de pastas e o cabeçalho `@NApiVersion`/`@NScriptType`. O `nsk build`, o `nsk upload` e o `nsk watch` rodam os dois em sequência, e o rollup só roda quando a checagem passa sem erros. Importe os módulos do NetSuite como namespace (`import * as record from 'N/record'`): eles não têm export default, e o build recusa `import record from 'N/record'`.

### `nsk build`

Compila o projeto: `tsc -p <tsconfig>` e, se o `ns.config.json` define `"bundler": "rollup"`, `rollup -c` em seguida.

### `nsk generate`

Cria um script a partir dos [templates](#templates) (alias `nsk g`):

```bash
nsk generate user-event-script ue_sales_order --dir App/_EntryPoints
nsk generate restlet rl_orders --language javascript
nsk generate user-event-script ue_sales_order --dir App/_EntryPoints --object --record-type SALESORDER
```

| Opção | Descrição |
|---|---|
| `-l, --language` | `typescript` (padrão quando o projeto tem `tsconfig`) ou `javascript` |
| `-d, --dir` | Subpasta dentro da pasta de scripts |
| `--object` | Gera também `Objects/customscript_<id>.xml` com o deployment, apontando para o `.js` no File Cabinet |
| `--script-id` | Id depois de `customscript_` (padrão: o nome em snake_case) |
| `--record-type` | Registro do deployment, ex.: `SALESORDER` (obrigatório com `--object`) |
| `--force` | Sobrescreve arquivos existentes (por padrão, nunca sobrescreve) |

Destino: TypeScript vai para o `rootDir` do tsconfig; JavaScript vai para `FileCabinet/SuiteScripts` (em SuiteApps, `FileCabinet/SuiteApps/<publisherid>.<projectid>`). Por enquanto o `--object` funciona para Client Script e User Event Script, que são os tipos que o template XML cobre.

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

### `nsk validate` e `nsk deploy`

Compilam o projeto (quando há `tsconfig`; pule com `--no-compile`) e chamam o `suitecloud`:

```bash
nsk validate                 # suitecloud project:validate
nsk validate --server        # validação no servidor
nsk deploy --dry-run         # prévia, sem alterar a conta
nsk deploy                   # suitecloud project:deploy
nsk deploy --asv WARNING     # continua mesmo com account-specific values
```

`--asv` (`--accountspecificvalues`) só vale para account customization projects; em SuiteApps o `nsk` recusa.

### `nsk account`

```bash
nsk account list             # auth IDs configurados (→ marca o do projeto)
nsk account use sandbox      # troca o defaultAuthId do project.json
nsk account setup            # login em uma conta (suitecloud account:setup)
```

O `account use` confere se o auth ID existe antes de gravar no `project.json`, mantendo as outras chaves.

### Contas protegidas

Liste em `protectedAuthIds` (no `ns.config.json`) os auth IDs que não podem receber alterações por engano, como produção. Com um deles no `project.json`, `nsk deploy`, `nsk upload` e `nsk watch` pedem confirmação antes de alterar a conta; `--yes` pula a pergunta. Sem terminal interativo (CI), falham se não houver `--yes`. `nsk deploy --dry-run` e `nsk validate` não pedem confirmação.

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
  "outDir": "src/FileCabinet/SuiteScripts",   // sobrescreve compilerOptions.outDir
  "bundler": "rollup",                        // roda "rollup -c" depois de uma checagem sem erros (criado pelo nsk init)
  "protectedAuthIds": ["producao"]            // pede confirmação antes de deploy/upload/watch nesses auth IDs
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

O template `script-object` usa marcadores `{{scriptType}}`, `{{scriptId}}`, `{{description}}`, `{{name}}`, `{{scriptFile}}`, `{{logLevel}}`, `{{recordType}}` e `{{status}}`, preenchidos pelo `nsk generate --object` (`{{scriptFile}}` é o caminho completo no File Cabinet, ex.: `/SuiteScripts/App/ue.js`).

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
  commands/          comandos do CLI (um arquivo por comando)
  core/              config, caminhos, wrappers do suitecloud/tsc/rollup, fila de upload do watch, scaffold do init
templates/           templates gerados (javascript/, typescript/, sdf/, manifest.json)
snippets/            snippets do VS Code (fonte dos templates)
scripts/             scripts de manutenção
test/                testes
```
