# @diegomodesto/ns

🇧🇷 Português | [🇺🇸 English](README.en.md)

CLI para projetos NetSuite SuiteCloud com foco em TypeScript. Funciona como uma camada sobre o [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli) oficial: o `suitecloud` continua cuidando da autenticação e do deploy, e o `nsk` cuida do que hoje é manual — compilar o TypeScript, encontrar o `.js` certo no File Cabinet, gerar scripts tipados e trocar de conta.

> **Status:** `0.3.0` — novidades: modelos de projeto no `nsk init` (`--template`: `standard` com testes, Biome, VS Code e CI; `minimal`; ou um modelo próprio de pasta ou git). Validado em sandbox: `init`, `generate`, `build`, `validate` e `deploy --dry-run`. `upload`, `watch`, `deploy` e `account` ainda não foram validados contra uma conta real — se algo falhar, abra uma [issue](https://github.com/DiegoModesto/ns-cli/issues).

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

### Modo interativo

Não sabe qual comando usar? Abra o menu e responda as perguntas, como no `suitecloud -i`:

```bash
nsk                          # sem argumentos, no terminal: abre o menu
nsk -i                       # menu com todos os comandos
nsk deploy -i                # só as perguntas de um comando
```

Use as setas para navegar, digite para filtrar listas longas (templates, arquivos) e Enter para confirmar. O menu só pergunta o que faz sentido para o projeto: lista os templates, os arquivos que podem ser enviados e os auth IDs configurados, só oferece `--object` para os tipos com objeto SDF, só pergunta `--asv` em account customization projects e só pergunta se sobrescreve quando o arquivo já existe. No final, mostra o **comando equivalente** (por exemplo `nsk deploy --dry-run`) e pergunta se pode executar; assim, da próxima vez, dá para rodar direto. `Ctrl+C` cancela a qualquer momento.

### Ajuda e idioma

```bash
nsk --help                   # comandos agrupados, com explicação
nsk deploy --help            # opções e exemplos de um comando (ou: nsk help deploy)
nsk language                 # mostra o idioma atual e de onde ele veio
nsk language es              # passa a usar espanhol (en, es, pt)
nsk language auto            # volta a seguir o idioma do computador
nsk --help --lang en         # só este comando em inglês
```

A ajuda, o modo interativo e o `nsk language` estão em **português, inglês e espanhol**. Sem configuração nenhuma, o `nsk` usa o idioma do computador: o do terminal (`LC_ALL`, `LC_MESSAGES`, `LANG`) e, se ele não estiver definido, o idioma do sistema (no macOS, o configurado em Ajustes do Sistema → Idioma e Região). Idiomas sem tradução caem em inglês.

Ordem de prioridade: `--lang` (vale em qualquer posição do comando) → variável `NSK_LANG` → idioma salvo com `nsk language` → idioma do computador → inglês. O idioma salvo fica em `~/.config/nsk/settings.json` (Windows: `%APPDATA%\nsk\settings.json`). As mensagens de erro e de progresso continuam em inglês.

### `nsk init`

Cria um projeto SuiteCloud já pronto para TypeScript, a partir de um modelo de projeto:

```bash
nsk init meu-projeto                     # account customization project, modelo standard
nsk init meu-app --suiteapp --publisher-id com.acme --project-id myapp [--project-version 1.0.0]
nsk init meu-projeto --template minimal  # só a configuração do TypeScript
nsk init meu-projeto --language javascript           # JavaScript, sem build
nsk init meu-projeto -t github:acme/ns-template#v2   # modelo próprio (pasta ou repositório git)
```

Roda o `suitecloud project:create` (que continua gerando `manifest.xml`, `deploy.xml` e `suitecloud.config.js`), adiciona `package.json`, `tsconfig.json`, `ns.config.json`, `rollup.config.mjs` e `src/Source/`, aplica o modelo por cima e executa `npm install` (pule com `--no-install`). A pasta criada é `<nome>` ou, em SuiteApps, `<publisherid>.<projectid>`. Uma pasta que não está vazia só é usada com `--force`.

Os `.js` ficam em uma pasta com o nome do projeto em PascalCase: `nsk init meu-projeto` usa `src/FileCabinet/SuiteScripts/MeuProjeto` (`outDir` do tsconfig) e envia para `/SuiteScripts/MeuProjeto/...`, para projetos diferentes não se misturarem na mesma conta. Em SuiteApps, a pasta continua sendo `SuiteApps/<publisherid>.<projectid>`.

**Linguagem (`-l, --language`):** `typescript` (padrão e recomendado) ou `javascript`. Em JavaScript, os scripts AMD (`define`) ficam direto em `src/FileCabinet/SuiteScripts/<NomeDoProjeto>` (em SuiteApps, `SuiteApps/<publisherid>.<projectid>`): não há `tsconfig`, rollup nem `nsk build`, o `package.json` traz só `watch`, `upload`, `deploy` e `validate`, e o `ns.config.json` aponta `scriptsDir` para essa pasta (usada pelo `nsk generate`). No modo interativo, a pergunta mostra **TypeScript (recomendado)** primeiro.

#### Modelos de projeto

| Modelo | O que traz |
|---|---|
| `standard` (padrão) | Estrutura `src/Source/App/{_EntryPoints,lib,services}` com um User Event de exemplo; testes com [Vitest](https://vitest.dev) e mocks dos módulos `N/*` em `test/mocks/N`; lint e formatação com [Biome](https://biomejs.dev); `.vscode/` (tarefas `nsk watch`/`upload`/`build`, [snippets](#snippets-para-vs-code) já instalados no projeto, extensões recomendadas, formatar ao salvar); GitHub Actions rodando lint, typecheck, testes e build; `README.md` |
| `minimal` | Só o que o `nsk init` sempre gera (tsconfig, rollup, `src/Source/` vazio) |

Em JavaScript, o `standard` traz a mesma estrutura e o mesmo exemplo em `src/FileCabinet/SuiteScripts/<NomeDoProjeto>/App`, testes em `test/*.test.js` (o `loadScript()` de `test/amd.js` carrega o arquivo AMD e entrega os mocks de `test/mocks/N` como dependências), Biome, `.vscode/` e CI (lint e testes). O `minimal` traz só o `package.json` com os scripts do `nsk`.

Scripts do `standard`: `npm test`, `npm run typecheck` (scripts e testes), `npm run lint`, `npm run format`, além de `build`, `watch`, `upload` e `deploy`. Depois de um `nsk generate`, rode `npm run format` para ajustar o arquivo ao estilo do Biome (a regra de parâmetros não usados fica desligada, porque os entry points sempre recebem `context`). O lint usa Biome em vez de ESLint porque o `typescript-eslint` ainda não funciona com o TypeScript 7.

Nos testes, todo import de `N/<módulo>` carrega `test/mocks/N/<módulo>.ts` (configurado no `vitest.config.mjs`), então dá para controlar o NetSuite com `vi.mocked(search.create).mockReturnValue(...)`. Quando um script usar um módulo sem mock, crie o arquivo exportando `vi.fn()` para as funções usadas.

**Modelo próprio:** `--template` aceita uma pasta (`./modelos/empresa`) ou um repositório git (`github:usuario/repo`, `https://…/repo.git`, `git@host:repo.git`; `#branch` ou `#tag` no final escolhe a versão). O repositório é clonado com `git clone --depth 1`. Os arquivos do modelo são copiados para o projeto, e:

- `package.json` é mesclado ao gerado: `scripts`, `devDependencies` e outros objetos ganham as chaves do modelo; os demais campos são substituídos.
- `.gitignore` (ou `_gitignore`) tem as linhas adicionadas ao `.gitignore` do projeto.
- Os outros arquivos substituem os gerados (por exemplo, um `tsconfig.json` próprio).
- `template.json` (opcional, com `description`) e `.git` não são copiados.
- Em arquivos de texto e nos caminhos dos arquivos (ex.: uma pasta `{{outDir}}`), os marcadores `{{name}}`, `{{packageName}}`, `{{sourceDir}}` (`src/Source`), `{{outDir}}` (ex.: `src/FileCabinet/SuiteScripts/MeuProjeto`) e `{{fileCabinetFolder}}` (ex.: `/SuiteScripts/MeuProjeto`) são preenchidos; outros `{{...}}` ficam como estão.

Um modelo que não existe ou não pode ser clonado falha antes de criar qualquer arquivo.

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

Destino: TypeScript vai para o `rootDir` do tsconfig; JavaScript vai para o `scriptsDir` do `ns.config.json` ou, sem ele, para `FileCabinet/SuiteScripts` (em SuiteApps, `FileCabinet/SuiteApps/<publisherid>.<projectid>`). Por enquanto o `--object` funciona para Client Script e User Event Script, que são os tipos que o template XML cobre.

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
  "scriptsDir": "src/FileCabinet/SuiteScripts/MeuProjeto", // onde o nsk generate cria scripts JavaScript
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

Projetos criados com o modelo `standard` já trazem os snippets em `.vscode/netsuite.code-snippets` (os da linguagem do projeto e os de XML): o VS Code carrega esse arquivo sozinho, sem instalar nada. Para usar em qualquer projeto, instale como snippets globais:

1. `Ctrl/Command + Shift + P` → **Snippets: Configure Snippets** → **New Global Snippets file...**
2. Cole o conteúdo de `snippets/NetSuiteSnippets.json` e salve.
3. Digite o prefixo (ex.: `tsUserEvent`) em um arquivo `.ts` e pressione `Tab`.

Os snippets são a fonte dos templates: ao alterar o JSON, rode `npm run sync:templates` para regenerar a pasta `templates/` e os `.code-snippets` dos modelos de projeto. O CI falha se as duas coisas estiverem fora de sincronia.

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
project-templates/   modelos de projeto do nsk init (typescript/ e javascript/: standard, minimal)
snippets/            snippets do VS Code (fonte dos templates)
scripts/             scripts de manutenção
test/                testes
```
