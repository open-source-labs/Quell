import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';

/**
 * Display the CLI banner
 */
function showBanner(): void {
  console.log(chalk.cyan(`
  ██████╗ ██╗   ██╗███████╗██╗     ██╗     
  ██╔═══██╗██║   ██║██╔════╝██║     ██║     
  ██║   ██║██║   ██║█████╗  ██║     ██║     
  ██║▄▄ ██║██║   ██║██╔══╝  ██║     ██║     
  ╚██████╔╝╚██████╔╝███████╗███████╗███████╗
   ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝╚══════╝
  `));
  console.log(chalk.white('GraphQL Caching for all schema formats\n'));
}

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(chalk.cyan(`
Quell CLI - GraphQL Caching Made Easy

${chalk.bold('USAGE:')}
  quell <command> [options]

${chalk.bold('COMMANDS:')}
  init     Initialize Quell in your project
  help     Display this help message
  version  Show version information

${chalk.bold('INIT OPTIONS:')}
  -e, --example        Create example server and schema files
  -f, --force          Overwrite existing files
  -t, --typescript     Use TypeScript templates (default)
  -j, --javascript     Use JavaScript templates
  --skip-install       Skip automatic dependency installation
  --redis-host <host>  Redis host (default: 127.0.0.1)
  --redis-port <port>  Redis port (default: 6379)

${chalk.bold('EXAMPLES:')}
  quell init                       ${chalk.gray('# Basic initialization with auto-install')}
  quell init --example             ${chalk.gray('# Initialize with example files')}
  quell init --skip-install        ${chalk.gray('# Initialize without installing dependencies')}
  quell init --force               ${chalk.gray('# Overwrite existing files')}
  quell init --javascript          ${chalk.gray('# Use JavaScript templates instead of TypeScript')}

${chalk.bold('MORE INFO:')}
  Documentation: https://github.com/open-source-labs/Quell
  Issues:        https://github.com/open-source-labs/Quell/issues
`));
}

/**
 * Main CLI program setup
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('quell')
    .description('CLI for Quell GraphQL caching')
    .version('1.0.0')
    .hook('preAction', () => {
      // Only show banner for actual commands, not for --help or --version
      const args = process.argv.slice(2);
      if (!args.includes('--help') && !args.includes('-h') && !args.includes('--version') && !args.includes('-V')) {
        showBanner();
      }
    });

  // Init command
  program
    .command('init')
    .description('Initialize Quell in your project')
    .option('-e, --example', 'Create example server and schema files')
    .option('-f, --force', 'Overwrite existing files')
    .option('-t, --typescript', 'Use TypeScript templates (default)', true)
    .option('-j, --javascript', 'Use JavaScript templates')
    .option('--skip-install', 'Skip automatic dependency installation')
    .option('--redis-host <host>', 'Redis host', "'127.0.0.1'")
    .option('--redis-port <port>', 'Redis port', '6379')
    .action(initCommand);

  // Help command
  program
    .command('help')
    .description('Display detailed help information')
    .action(() => {
      displayHelp();
    });

  // Version command
  program
    .command('version')
    .description('Show version information')
    .action(() => {
      console.log(chalk.cyan('Quell CLI v1.0.0'));
      console.log(chalk.gray('GraphQL Caching Library'));
    });

  return program;
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const program = createProgram();
    
    // Parse command line arguments
    await program.parseAsync();

    // If no command provided, show help
    if (!process.argv.slice(2).length) {
      showBanner();
      displayHelp();
    }
  } catch (error) {
    console.error(chalk.red('❌ CLI Error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the CLI
main();