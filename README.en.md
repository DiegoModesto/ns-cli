# @diegomodesto/ns

[🇧🇷 Português](README.md) | 🇺🇸 English

A TypeScript-first CLI for NetSuite SuiteCloud projects. It is a layer on top of the official [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli): `suitecloud` still handles authentication and deployment, while `nsk` handles what is manual today — compiling TypeScript, finding the right `.js` in the File Cabinet, generating typed scripts and switching accounts.

> **Status:** in development (`0.0.0`). The CLI currently ships the templates, the snippets, `nsk init`, `nsk doctor`, `nsk generate`, `nsk build`, `nsk upload` and `nsk watch`; the other project commands are on the [roadmap](#roadmap).

## Requirements

- Node.js `>= 22.12`
- [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli) installed and configured (`suitecloud account:setup`)

## Installation

Not published to npm yet. To use it from source:

```bash
git clone git@github.com:DiegoModesto/ns-cli.git
cd ns-cli
npm install
npm run build
npm link        # makes the "nsk" command available globally
```

After the first release:

```bash
npm install -g @diegomodesto/ns
```

## Usage

```bash
nsk --version
nsk init my-project                              # create an SDF project ready for TypeScript
nsk doctor                                       # check the environment and show how nsk sees the project
nsk templates list                               # list the available templates
nsk templates show user-event-script             # print the TypeScript template
nsk templates show restlet --language javascript # JavaScript version
nsk templates show script-object                 # SDF object (XML) with deployment
nsk generate user-event-script ue_sales_order    # create src/Source/ue_sales_order.ts from the template
nsk upload src/Source/App/ue_sales_order.ts      # compile and upload the matching .js
nsk watch                                        # compile and upload on every save
```

### `nsk doctor`

Run it inside a SuiteCloud project (from any subfolder):

```text
✔ Node.js          v22.18.0
✔ SuiteCloud CLI   3.0.2
✔ Project root     /Users/you/Repos/my-project
✔ Config           defaults (no ns.config.json)
✔ FileCabinet      src/FileCabinet
✔ TypeScript       src/Source → src/FileCabinet/SuiteScripts (tsconfig.json)
✔ Auth ID          sandbox
```

It exits with code `1` when something is missing (CLI not installed, invalid `ns.config.json`, account not set up).

### `nsk init`

Creates a SuiteCloud project ready for TypeScript:

```bash
nsk init my-project                      # account customization project
nsk init my-app --suiteapp --publisher-id com.acme --project-id myapp [--project-version 1.0.0]
```

It runs `suitecloud project:create` and adds `package.json`, `tsconfig.json`, `ns.config.json`, `rollup.config.mjs` and `src/Source/`, then runs `npm install` (skip it with `--no-install`). The folder is `<name>` or, for SuiteApps, `<publisherid>.<projectid>`. A folder that is not empty is only used with `--force`.

**TypeScript 7 + rollup:** TypeScript 7 no longer emits AMD (`define`), which SuiteScript requires. In projects created by `nsk init`, `tsc` only type-checks (`noEmit`) and rollup emits one AMD `.js` per module, keeping the folder structure and the `@NApiVersion`/`@NScriptType` header. `nsk build`, `nsk upload` and `nsk watch` run both in sequence, and rollup only runs when the check has no errors. Import NetSuite modules as namespaces (`import * as record from 'N/record'`): they have no default export, and the build rejects `import record from 'N/record'`.

### `nsk build`

Compiles the project: `tsc -p <tsconfig>` and, when `ns.config.json` sets `"bundler": "rollup"`, `rollup -c` afterwards.

### `nsk generate`

Creates a script from the [templates](#templates) (alias `nsk g`):

```bash
nsk generate user-event-script ue_sales_order --dir App/_EntryPoints
nsk generate restlet rl_orders --language javascript
nsk generate user-event-script ue_sales_order --dir App/_EntryPoints --object --record-type SALESORDER
```

| Option | Description |
|---|---|
| `-l, --language` | `typescript` (default when the project has a `tsconfig`) or `javascript` |
| `-d, --dir` | Subfolder inside the scripts folder |
| `--object` | Also generate `Objects/customscript_<id>.xml` with its deployment, pointing at the `.js` in the File Cabinet |
| `--script-id` | Id after `customscript_` (default: the name in snake_case) |
| `--record-type` | Deployment record, e.g. `SALESORDER` (required with `--object`) |
| `--force` | Overwrite existing files (by default nothing is overwritten) |

Destination: TypeScript goes to the tsconfig `rootDir`; JavaScript goes to `FileCabinet/SuiteScripts` (in SuiteApps, `FileCabinet/SuiteApps/<publisherid>.<projectid>`). For now `--object` supports Client Script and User Event Script, the types the XML template covers.

### `nsk upload`

Uploads files to the File Cabinet. It takes `.ts` sources (the compiled `.js` is uploaded) and files already inside the `FileCabinet` folder:

```bash
nsk upload src/Source/App/ue_sales_order.ts
nsk upload src/FileCabinet/SuiteScripts/lib/utils.js src/Source/App/cs_order.ts
nsk upload --dry-run src/Source/App/*.ts     # only print source → File Cabinet path
nsk upload --no-compile src/Source/App/a.ts  # upload the existing .js without compiling
```

When any file is a `.ts`, the project is compiled once (with the project's own `tsc`) and every file goes in a single `suitecloud file:upload` call. SuiteCloud only accepts files inside `/SuiteScripts`, `/SuiteApps`, `/Templates/E-mail Templates`, `/Templates/Marketing Templates` and `/Web Site Hosting Files`; `nsk` rejects anything else before calling `suitecloud`.

### `nsk watch`

Replaces the VS Code "compile watch" + "upload" tasks: runs `tsc --watch` and uploads every changed file inside `FileCabinet`.

```bash
nsk watch              # compile and upload on every save
nsk watch --no-upload  # compile only
```

- Nothing is uploaded on the first build; only changes made after it.
- **Nothing is uploaded while TypeScript reports errors** (tsc emits `.js` even with errors).
- Changes close together are batched into one upload, and uploads never run in parallel.
- Files with the same content as their last upload are not uploaded again.
- `.map`, `.d.ts`, `.tsbuildinfo` and hidden files are ignored. Deleted files stay in the account.
- A failed upload is printed and `watch` keeps running. `Ctrl+C` stops everything.
- In projects without a `tsconfig`, it uploads changed files in `FileCabinet` without compiling.

## Configuration

`nsk` reads the project from:

| Source | What is used |
|---|---|
| `suitecloud.config.js` | `defaultProjectFolder` (default `src`) → the `FileCabinet` folder lives inside it |
| `tsconfig.json` | `compilerOptions.rootDir` (`.ts` sources) and `outDir` (compiled `.js`, inside `FileCabinet`); follows relative `extends` |
| `project.json` | `defaultAuthId`, created by `suitecloud account:setup` |
| `ns.config.json` | Optional, to override the values above |

Example `ns.config.json` (every field is optional):

```jsonc
{
  "tsconfig": "tsconfig.build.json",          // default: tsconfig.json
  "sourceDir": "src/Source",                  // overrides compilerOptions.rootDir
  "outDir": "src/FileCabinet/SuiteScripts",   // overrides compilerOptions.outDir
  "bundler": "rollup"                         // runs "rollup -c" after a clean check (set by nsk init)
}
```

With this setup, `src/Source/App/ue_sales_order.ts` is compiled to `src/FileCabinet/SuiteScripts/App/ue_sales_order.js` and uploaded as `/SuiteScripts/App/ue_sales_order.js`. Projects without a `tsconfig` work as plain JavaScript.

## Templates

All of them use `@NApiVersion 2.1` and `@NModuleScope SameAccount`. The TypeScript versions use the [`@hitc/netsuite-types`](https://www.npmjs.com/package/@hitc/netsuite-types) types, and the JavaScript versions use `define` (AMD).

| Id | `@NScriptType` | Languages |
|---|---|---|
| `custom-module` | — (module) | JS, TS |
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
| `script-object` | SDF object (Client/User Event + deployment) | XML |

The `script-object` template uses the `{{scriptType}}`, `{{scriptId}}`, `{{description}}`, `{{name}}`, `{{scriptFile}}`, `{{logLevel}}`, `{{recordType}}` and `{{status}}` markers, filled in by `nsk generate --object` (`{{scriptFile}}` is the full File Cabinet path, e.g. `/SuiteScripts/App/ue.js`).

Built-in best practices:

- Client Script validation entry points (`saveRecord`, `validateField`, `validateLine`, `validateInsert`, `validateDelete`) return `true` — otherwise NetSuite blocks the action.
- RESTlets return a response body; in TypeScript, `delete_` is exported as `delete`.
- The Map/Reduce `summarize` logs the errors from the `getInputData`, `map` and `reduce` stages.

## VS Code snippets

[`snippets/NetSuiteSnippets.json`](snippets/NetSuiteSnippets.json) contains the same templates as VS Code snippets (`ns*` prefixes for JavaScript, `ts*` for TypeScript), plus imports and utilities.

1. `Ctrl/Command + Shift + P` → **Snippets: Configure Snippets** → **New Global Snippets file...**
2. Paste the content of `snippets/NetSuiteSnippets.json` and save.
3. Type a prefix (e.g. `tsUserEvent`) in a `.ts` file and press `Tab`.

The snippets are the source of the templates: after changing the JSON, run `npm run sync:templates` to regenerate the `templates/` folder. CI fails if they are out of sync.

## Roadmap

| Command | Description |
|---|---|
| `nsk validate` / `nsk deploy` | Compile and run `project:validate` / `project:deploy` |
| `nsk account` | List, switch and set up accounts (sandbox, production) |

## Development

```bash
npm install
npm run typecheck        # CLI code + TypeScript templates
npm test                 # vitest
npm run build            # build dist/ with tsup
npm run sync:templates   # regenerate templates/ from the snippets
```

Layout:

```
src/
  commands/          CLI commands (init, doctor, templates, generate, build, upload, watch)
  core/              config, paths, suitecloud and tsc wrappers, watch upload queue
templates/           generated templates (javascript/, typescript/, sdf/, manifest.json)
snippets/            VS Code snippets (source of the templates)
scripts/             maintenance scripts
test/                tests
```
