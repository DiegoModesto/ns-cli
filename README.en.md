# @diegomodesto/ns

[🇧🇷 Português](README.md) | 🇺🇸 English

A TypeScript-first CLI for NetSuite SuiteCloud projects. It is a layer on top of the official [SuiteCloud CLI](https://www.npmjs.com/package/@oracle/suitecloud-cli): `suitecloud` still handles authentication and deployment, while `nsk` handles what is manual today — compiling TypeScript, finding the right `.js` in the File Cabinet, generating typed scripts and switching accounts.

> **Status:** in development (`0.0.0`). The CLI currently ships the templates, the snippets and `nsk doctor`; the other project commands are on the [roadmap](#roadmap).

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
nsk doctor                                       # check the environment and show how nsk sees the project
nsk templates list                               # list the available templates
nsk templates show user-event-script             # print the TypeScript template
nsk templates show restlet --language javascript # JavaScript version
nsk templates show script-object                 # SDF object (XML) with deployment
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
  "outDir": "src/FileCabinet/SuiteScripts"    // overrides compilerOptions.outDir
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

The `script-object` template uses the `{{scriptType}}`, `{{scriptId}}`, `{{description}}`, `{{name}}`, `{{scriptFile}}`, `{{logLevel}}`, `{{recordType}}` and `{{status}}` markers, which `nsk generate` will fill in.

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
| `nsk init` | Create an SDF project already set up for TypeScript (`tsconfig`, `@hitc/netsuite-types`, `src/Source`, `ns.config.json`) |
| `nsk generate <type> <name>` | Generate a script from the templates; with `--object`, also generate the SDF XML with its deployment |
| `nsk upload [files]` | Compile and upload the matching `.js` to the File Cabinet |
| `nsk watch` | Compile and upload automatically every time a file is saved |
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
  commands/          CLI commands (doctor, templates)
  core/              config, paths, suitecloud and tsc wrappers
templates/           generated templates (javascript/, typescript/, sdf/, manifest.json)
snippets/            VS Code snippets (source of the templates)
scripts/             maintenance scripts
test/                tests
```
