import { logger } from '../utils/logger';
import { 
  createFile, 
  updateGitignore, 
  updatePackageJson, 
  createDirectories,
  readPackageJson,
  getCurrentDirName,
  installPackages,
  detectPackageManager
} from '../utils/file-helpers';
import { envTemplate } from '../templates/env.template';
import { configTemplate } from '../templates/config.template';
import { serverTemplate } from '../templates/server.template';
import { schemaTemplate } from '../templates/schema.template';
import { gitignoreAdditions } from '../templates/gitignore.template';
import { 
  packageScriptsAdditions,
  packageDependencies,
  packageDevDependencies
} from '../templates/package.template';

export interface InitOptions {
  typescript?: boolean;
  example?: boolean;
  force?: boolean;
  skipInstall?: boolean;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  try {
    logger.title('\n🚀 Initializing Quell in your project...\n');
    
    // Check if we're in a valid directory
    const currentDir = getCurrentDirName();
    const packageManager = detectPackageManager();
    logger.info(`Setting up Quell in: ${currentDir}`);
    logger.info(`Detected package manager: ${packageManager}`);
    
    // Create basic directory structure
    await createDirectories(['src', 'src/server', 'src/server/schema']);
    
    // 1. Create .env file
    logger.log('\nCreating configuration files...');
    const envResult = await createFile('.env', envTemplate, options.force);
    if (envResult.created) {
      logger.success('Created .env file with Redis configuration');
    } else if (envResult.existed) {
      logger.warning('.env file already exists (use --force to overwrite)');
    }
    
    // 2. Create Quell config file
    const configResult = await createFile('quell-config.ts', configTemplate, options.force);
    if (configResult.created) {
      logger.success('Created quell-config.ts');
    } else if (configResult.existed) {
      logger.warning('quell-config.ts already exists (use --force to overwrite)');
    }
    
    // 3. Create example server file if requested
    if (options.example) {
      const serverResult = await createFile('src/server/example-server.ts', serverTemplate, options.force);
      if (serverResult.created) {
        logger.success('Created src/server/example-server.ts with example GraphQL server');
      }
      
      const schemaResult = await createFile('src/server/schema/example-schema.ts', schemaTemplate, options.force);
      if (schemaResult.created) {
        logger.success('Created src/server/schema/example-schema.ts with example schema');
      }
    }
    
    // 4. Update .gitignore
    const gitignoreResult = await updateGitignore(gitignoreAdditions);
    if (gitignoreResult.created) {
      logger.success('Updated .gitignore');
    } else {
      logger.info('.gitignore already contains Quell entries');
    }
    
    // 5. Update package.json
    const packageResult = await updatePackageJson(
      packageScriptsAdditions,
      packageDependencies,
      packageDevDependencies
    );
    if (packageResult.created) {
      if (packageResult.existed) {
        logger.success('Updated package.json with Quell scripts');
      } else {
        logger.success('Created package.json');
      }
    }
    
    // 6. Install dependencies automatically (unless --skip-install)
    if (!options.skipInstall) {
      logger.log('\nInstalling dependencies...');
      
      // Check existing package.json for missing dependencies
      const packageJson = await readPackageJson();
      const missingDeps = packageDependencies.filter(dep => 
        !packageJson?.dependencies?.[dep] && !packageJson?.devDependencies?.[dep]
      );
      const missingDevDeps = packageDevDependencies.filter(dep => 
        !packageJson?.devDependencies?.[dep] && !packageJson?.dependencies?.[dep]
      );
      
      if (missingDeps.length > 0 || missingDevDeps.length > 0) {
        const installResult = await installPackages(missingDeps, missingDevDeps, logger);
        
        if (installResult.success) {
          logger.success('All dependencies installed successfully! 📦');
        } else {
          logger.error(`Failed to install dependencies: ${installResult.error}`);
          logger.warning('You can install manually with:');
          if (missingDeps.length > 0) {
            logger.code(`   ${packageManager} ${packageManager === 'npm' ? 'install' : 'add'} ${missingDeps.join(' ')}`);
          }
          if (missingDevDeps.length > 0) {
            const devFlag = packageManager === 'npm' ? 'install -D' : 'add -D';
            logger.code(`   ${packageManager} ${devFlag} ${missingDevDeps.join(' ')}`);
          }
        }
      } else {
        logger.info('All dependencies already installed');
      }
    } else {
      logger.info('Skipping dependency installation (--skip-install)');
    }
    
    // Print success summary
    logger.log('\n' + '='.repeat(60));
    logger.success('Quell initialization complete! 🎉');
    logger.log('='.repeat(60));
    
    // Print next steps
    logger.title('\nNext steps:');
    logger.log('');
    
    // Step 1: Install dependencies (if skipped)
    if (options.skipInstall) {
      logger.info('1. Install dependencies:');
      logger.code(`   ${packageManager} ${packageManager === 'npm' ? 'install' : 'install'}`);
      logger.log('');
    }
    
    // Step 2: Redis setup
    const stepNum = options.skipInstall ? '2' : '1';
    logger.info(`${stepNum}. Set up Redis:`);
    logger.log('   • Install Redis locally: https://redis.io/docs/getting-started/installation/');
    logger.log('   • Or use a cloud provider like Redis Cloud, Upstash, or Railway');
    logger.log('   • Update Redis credentials in your .env file');
    logger.log('');
    
    // Step 3: Configuration
    const step3Num = options.skipInstall ? '3' : '2';
    logger.info(`${step3Num}. Configure your GraphQL schema:`);
    if (options.example) {
      logger.log('   • Modify the example schema in src/schema.ts');
      logger.log('   • Replace sample data with your database queries');
    } else {
      logger.log('   • Create your GraphQL schema file');
      logger.log('   • Update quell-config.ts to use your schema');
    }
    logger.log('');
    
    // Step 4: Usage
    const step4Num = options.skipInstall ? '4' : '3';
    logger.info(`${step4Num}. Use Quell in your GraphQL server:`);
    logger.code('   import { quellCache } from \'./quell-config\';');
    logger.code('   app.use(\'/graphql\', quellCache.query);');
    logger.log('');
    
    // Example usage
    if (options.example) {
      const step5Num = options.skipInstall ? '5' : '4';
      logger.info(`${step5Num}. Run the example server:`);
      logger.code('   npm run dev');
      logger.log('   Visit http://localhost:4000/graphql for GraphiQL');
      logger.log('');
    }
    
    // Additional resources
    logger.info('📚 Learn more:');
    logger.log('   • Documentation: https://github.com/open-source-labs/Quell');
    logger.log('   • Redis setup guide: https://redis.io/docs/getting-started/');
    logger.log('   • GraphQL best practices: https://graphql.org/learn/best-practices/');
    logger.log('');
    
    // Redis connection test suggestion
    logger.info('💡 Pro tip:');
    logger.log('   Test your Redis connection with: redis-cli ping');
    logger.log('   (should return PONG if Redis is running)');
    logger.log('');
    
  } catch (error) {
    logger.error(`Failed to initialize Quell: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}