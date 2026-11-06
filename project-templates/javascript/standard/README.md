# {{name}}

NetSuite SuiteCloud project in JavaScript (SuiteScript 2.1, AMD), created with [nsk](https://github.com/DiegoModesto/ns-cli).

## Layout

```
{{outDir}}/App/
  _EntryPoints/     scripts NetSuite runs (one file per script, with @NScriptType)
  lib/              pure helpers, no N/* modules: easy to test
  services/         code that uses N/* modules (search, record...)
test/
  App/              tests, mirroring the App folder
  mocks/N/          stand-ins for the N/* modules, used by Vitest
  amd.js            loadScript(): loads an AMD file with its dependencies, as NetSuite does
```

`_EntryPoints/ue_customer_email.js` is an example: replace it with your own scripts. Create new ones
with `npx nsk generate <template> <name> --dir App/_EntryPoints`, then run `npm run format`.

## Commands

- `npm run watch`: uploads each file to the account when it is saved
- `npm run upload -- <file>`: uploads one file
- `npm run deploy`: deploys the project (`suitecloud project:deploy`)
- `npm test`: runs the tests (Vitest)
- `npm run lint` / `npm run format`: checks / fixes lint and formatting (Biome)

Before the first upload or deploy, connect an account: `suitecloud account:setup` (or `npx nsk account setup`).

## Tests and N/* modules

NetSuite modules do not exist outside NetSuite. In tests, `loadScript('{{outDir}}/App/lib/email.js')` runs the
file's `define()` and returns what the factory returns: every `N/<module>` dependency comes from
`test/mocks/N/<module>.js`, and relative dependencies are loaded the same way (or replaced with the second
argument). Control the mocks with `search.create.mockReturnValue(...)`. When a script uses a module that has no
mock yet, add a file there exporting `vi.fn()` for the functions you use.
