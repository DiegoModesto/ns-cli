export type Locale = 'en' | 'pt';

export const LOCALES: Locale[] = ['en', 'pt'];

/** [command line, comment] pairs shown under "Examples:" in a command's help. */
type Examples = [string, string][];

const en = {
  help: {
    usage: 'Usage:',
    arguments: 'Arguments:',
    options: 'Options:',
    globalOptions: 'Global Options:',
    commands: 'Commands:',
    examples: 'Examples:',
    optionsPlaceholder: '[options]',
    commandPlaceholder: '[command]',
    default: 'default',
    choices: 'choices',
    helpOption: 'show help for the command',
    helpCommand: 'show help for a command',
    version: 'show the nsk version',
    lang: 'help language: en or pt (default: NSK_LANG or the system language)',
    groups: {
      project: 'Project:',
      sync: 'Sync with NetSuite:',
      accounts: 'Accounts:',
    },
    description:
      'TypeScript-first CLI for NetSuite SuiteCloud projects. It works on top of the SuiteCloud CLI ' +
      '(suitecloud), which keeps handling authentication and deployment.',
    footer:
      'Run "nsk <command> --help" for the options and examples of a command.\n' +
      'Documentation: https://github.com/DiegoModesto/ns-cli/blob/main/README.en.md',
  },
  init: {
    description: 'Create a SuiteCloud project set up for TypeScript (tsconfig, rollup, src/Source)',
    name: 'project name (also the folder name for account customization projects)',
    suiteapp: 'create a SuiteApp instead of an account customization project',
    publisherId: 'SuiteApp publisher id, e.g. com.acme',
    projectId: 'SuiteApp project id, e.g. myapp',
    projectVersion: 'SuiteApp version',
    noInstall: 'do not run "npm install" at the end',
    force: 'use the folder even if it is not empty (suitecloud --overwrite)',
    examples: [
      ['nsk init my-project', 'account customization project in ./my-project'],
      ['nsk init my-app --suiteapp --publisher-id com.acme --project-id myapp', 'SuiteApp in ./com.acme.myapp'],
    ] as Examples,
  },
  doctor: {
    description: 'Check the environment and show how nsk sees the current project',
    examples: [['nsk doctor', 'Node, SuiteCloud CLI, folders, TypeScript and auth ID']] as Examples,
  },
  templates: {
    description: 'Browse the built-in SuiteScript templates',
    list: 'List the available templates',
    show: 'Print a template',
    id: 'template id (see "nsk templates list")',
    language: 'template language',
    examples: [
      ['nsk templates list', 'ids, script types and languages'],
      ['nsk templates show restlet -l javascript', 'print the JavaScript RESTlet'],
    ] as Examples,
  },
  generate: {
    description: 'Create a script from a template, optionally with its SDF object (XML)',
    template: 'template id (see "nsk templates list")',
    name: 'file name without extension, e.g. ue_sales_order',
    language: 'script language (default: typescript when the project has a tsconfig)',
    dir: 'subfolder inside the scripts folder, e.g. App/_EntryPoints',
    object: 'also create Objects/customscript_<id>.xml with a deployment',
    scriptId: 'id after customscript_ (default: the name in snake_case)',
    recordType: 'record the deployment applies to, e.g. SALESORDER (required with --object)',
    force: 'overwrite existing files',
    examples: [
      ['nsk generate user-event-script ue_sales_order --dir App', 'src/Source/App/ue_sales_order.ts'],
      ['nsk g user-event-script ue_order --object --record-type SALESORDER', 'script + SDF object'],
      ['nsk g restlet rl_orders -l javascript', 'JavaScript in FileCabinet/SuiteScripts'],
    ] as Examples,
  },
  build: {
    description: 'Compile the project: tsc, then rollup when ns.config.json sets a bundler',
    examples: [['nsk build', 'type-check and emit the .js files into the FileCabinet']] as Examples,
  },
  upload: {
    description: 'Compile (when needed) and upload files to the File Cabinet',
    files: '.ts sources or files inside the FileCabinet folder',
    dryRun: 'only show what would be uploaded',
    noCompile: 'upload the existing .js without compiling first',
    yes: 'do not ask for confirmation on protected accounts',
    examples: [
      ['nsk upload src/Source/App/ue_sales_order.ts', 'compile and upload the matching .js'],
      ['nsk upload --dry-run src/Source/App/*.ts', 'show source → File Cabinet path'],
    ] as Examples,
  },
  watch: {
    description: 'Compile on save and upload every changed file (never while TypeScript reports errors)',
    noUpload: 'only compile, do not upload',
    yes: 'do not ask for confirmation on protected accounts',
    examples: [
      ['nsk watch', 'compile and upload on every save (Ctrl+C to stop)'],
      ['nsk watch --no-upload', 'compile only'],
    ] as Examples,
  },
  validate: {
    description: 'Compile and validate the project (suitecloud project:validate)',
    server: 'validate on the server instead of locally',
    asv: 'account-specific values: ERROR stops, WARNING continues (account customization only)',
    noCompile: 'do not compile first',
    examples: [['nsk validate --server', 'server-side validation']] as Examples,
  },
  deploy: {
    description: 'Compile and deploy the project (suitecloud project:deploy)',
    dryRun: 'preview the deployment without changing the account',
    asv: 'account-specific values: ERROR stops, WARNING continues (account customization only)',
    noCompile: 'do not compile first',
    yes: 'do not ask for confirmation on protected accounts',
    examples: [
      ['nsk deploy --dry-run', 'preview'],
      ['nsk deploy --yes', 'deploy without the protected-account question'],
    ] as Examples,
  },
  account: {
    description: 'List, switch and set up NetSuite accounts (auth IDs)',
    list: 'List the auth IDs configured on this machine (→ marks the project one)',
    use: "Set the project's default auth ID (project.json)",
    authId: 'auth ID (see "nsk account list")',
    setup: 'Log in to an account and set it as the project default (suitecloud account:setup)',
    examples: [
      ['nsk account list', 'configured auth IDs'],
      ['nsk account use sandbox', 'switch the project to "sandbox"'],
    ] as Examples,
  },
};

export type Messages = typeof en;

const pt: Messages = {
  help: {
    usage: 'Uso:',
    arguments: 'Argumentos:',
    options: 'Opções:',
    globalOptions: 'Opções globais:',
    commands: 'Comandos:',
    examples: 'Exemplos:',
    optionsPlaceholder: '[opções]',
    commandPlaceholder: '[comando]',
    default: 'padrão',
    choices: 'opções',
    helpOption: 'mostra a ajuda do comando',
    helpCommand: 'mostra a ajuda de um comando',
    version: 'mostra a versão do nsk',
    lang: 'idioma da ajuda: en ou pt (padrão: NSK_LANG ou o idioma do sistema)',
    groups: {
      project: 'Projeto:',
      sync: 'Sincronizar com o NetSuite:',
      accounts: 'Contas:',
    },
    description:
      'CLI para projetos NetSuite SuiteCloud com foco em TypeScript. Funciona sobre o SuiteCloud CLI ' +
      '(suitecloud), que continua cuidando da autenticação e do deploy.',
    footer:
      'Rode "nsk <comando> --help" para ver as opções e exemplos de um comando.\n' +
      'Documentação: https://github.com/DiegoModesto/ns-cli#readme',
  },
  init: {
    description: 'Cria um projeto SuiteCloud pronto para TypeScript (tsconfig, rollup, src/Source)',
    name: 'nome do projeto (também é o nome da pasta em account customization projects)',
    suiteapp: 'cria uma SuiteApp em vez de um account customization project',
    publisherId: 'publisher id da SuiteApp, ex.: com.acme',
    projectId: 'project id da SuiteApp, ex.: myapp',
    projectVersion: 'versão da SuiteApp',
    noInstall: 'não roda o "npm install" no final',
    force: 'usa a pasta mesmo que não esteja vazia (suitecloud --overwrite)',
    examples: [
      ['nsk init meu-projeto', 'account customization project em ./meu-projeto'],
      ['nsk init meu-app --suiteapp --publisher-id com.acme --project-id myapp', 'SuiteApp em ./com.acme.myapp'],
    ],
  },
  doctor: {
    description: 'Verifica o ambiente e mostra como o nsk enxerga o projeto atual',
    examples: [['nsk doctor', 'Node, SuiteCloud CLI, pastas, TypeScript e auth ID']],
  },
  templates: {
    description: 'Mostra os templates de SuiteScript incluídos',
    list: 'Lista os templates disponíveis',
    show: 'Imprime um template',
    id: 'id do template (veja "nsk templates list")',
    language: 'linguagem do template',
    examples: [
      ['nsk templates list', 'ids, tipos de script e linguagens'],
      ['nsk templates show restlet -l javascript', 'imprime o RESTlet em JavaScript'],
    ],
  },
  generate: {
    description: 'Cria um script a partir de um template, com o objeto SDF (XML) se quiser',
    template: 'id do template (veja "nsk templates list")',
    name: 'nome do arquivo sem extensão, ex.: ue_sales_order',
    language: 'linguagem do script (padrão: typescript quando o projeto tem tsconfig)',
    dir: 'subpasta dentro da pasta de scripts, ex.: App/_EntryPoints',
    object: 'cria também Objects/customscript_<id>.xml com um deployment',
    scriptId: 'id depois de customscript_ (padrão: o nome em snake_case)',
    recordType: 'registro do deployment, ex.: SALESORDER (obrigatório com --object)',
    force: 'sobrescreve arquivos existentes',
    examples: [
      ['nsk generate user-event-script ue_sales_order --dir App', 'src/Source/App/ue_sales_order.ts'],
      ['nsk g user-event-script ue_order --object --record-type SALESORDER', 'script + objeto SDF'],
      ['nsk g restlet rl_orders -l javascript', 'JavaScript em FileCabinet/SuiteScripts'],
    ],
  },
  build: {
    description: 'Compila o projeto: tsc e, se o ns.config.json define um bundler, rollup',
    examples: [['nsk build', 'checa os tipos e gera os .js no FileCabinet']],
  },
  upload: {
    description: 'Compila (quando preciso) e envia arquivos para o File Cabinet',
    files: 'fontes .ts ou arquivos dentro da pasta FileCabinet',
    dryRun: 'só mostra o que seria enviado',
    noCompile: 'envia o .js existente sem compilar antes',
    yes: 'não pede confirmação em contas protegidas',
    examples: [
      ['nsk upload src/Source/App/ue_sales_order.ts', 'compila e envia o .js correspondente'],
      ['nsk upload --dry-run src/Source/App/*.ts', 'mostra fonte → caminho no File Cabinet'],
    ],
  },
  watch: {
    description: 'Compila ao salvar e envia cada arquivo alterado (nunca com erro de TypeScript)',
    noUpload: 'só compila, sem enviar',
    yes: 'não pede confirmação em contas protegidas',
    examples: [
      ['nsk watch', 'compila e envia a cada arquivo salvo (Ctrl+C para parar)'],
      ['nsk watch --no-upload', 'só compila'],
    ],
  },
  validate: {
    description: 'Compila e valida o projeto (suitecloud project:validate)',
    server: 'valida no servidor em vez de localmente',
    asv: 'account-specific values: ERROR para, WARNING continua (só account customization)',
    noCompile: 'não compila antes',
    examples: [['nsk validate --server', 'validação no servidor']],
  },
  deploy: {
    description: 'Compila e faz o deploy do projeto (suitecloud project:deploy)',
    dryRun: 'prévia do deploy, sem alterar a conta',
    asv: 'account-specific values: ERROR para, WARNING continua (só account customization)',
    noCompile: 'não compila antes',
    yes: 'não pede confirmação em contas protegidas',
    examples: [
      ['nsk deploy --dry-run', 'prévia'],
      ['nsk deploy --yes', 'deploy sem a pergunta de conta protegida'],
    ],
  },
  account: {
    description: 'Lista, troca e configura contas NetSuite (auth IDs)',
    list: 'Lista os auth IDs configurados nesta máquina (→ marca o do projeto)',
    use: 'Define o auth ID padrão do projeto (project.json)',
    authId: 'auth ID (veja "nsk account list")',
    setup: 'Faz login em uma conta e a define como padrão do projeto (suitecloud account:setup)',
    examples: [
      ['nsk account list', 'auth IDs configurados'],
      ['nsk account use sandbox', 'troca o projeto para "sandbox"'],
    ],
  },
};

const MESSAGES: Record<Locale, Messages> = { en, pt };

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}

/**
 * Picks the help language: `--lang`, then NSK_LANG, then the usual locale variables (LC_ALL, LC_MESSAGES, LANG).
 * Anything starting with "pt" is Portuguese; everything else is English.
 */
export function detectLocale(argv: string[], env: NodeJS.ProcessEnv): Locale {
  const value = readLangArg(argv) ?? env.NSK_LANG ?? env.LC_ALL ?? env.LC_MESSAGES ?? env.LANG ?? '';
  return value.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

/** Removes `--lang <value>` / `--lang=<value>` from argv, so it works before or after any command. */
export function stripLangArg(argv: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') i++;
    else if (!argv[i]!.startsWith('--lang=')) result.push(argv[i]!);
  }
  return result;
}

function readLangArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') return argv[i + 1];
    if (argv[i]!.startsWith('--lang=')) return argv[i]!.slice('--lang='.length);
  }
  return undefined;
}

/** Formats examples as aligned "  command   # comment" lines. */
export function formatExamples(title: string, examples: Examples): string {
  const width = Math.max(...examples.map(([command]) => command.length));
  return `\n${title}\n${examples.map(([command, comment]) => `  ${command.padEnd(width)}  # ${comment}`).join('\n')}`;
}
