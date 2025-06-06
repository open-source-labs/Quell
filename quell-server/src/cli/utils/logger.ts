import chalk from 'chalk';

export const logger = {
  success: (message: string) => console.log(chalk.green('✔'), message),
  error: (message: string) => console.log(chalk.red('✖'), message),
  warning: (message: string) => console.log(chalk.yellow('⚠'), message),
  info: (message: string) => console.log(chalk.blue('ℹ'), message),
  log: (message: string) => console.log(message),
  
  // Special formatters
  title: (message: string) => console.log(chalk.bold.cyan(message)),
  code: (message: string) => console.log(chalk.gray(message)),
  highlight: (message: string) => console.log(chalk.yellow(message)),
};
