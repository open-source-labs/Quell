import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FileCreationResult {
  created: boolean;
  existed: boolean;
  path: string;
}

export interface InstallResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Detects which package manager is being used in the project
 */
export function detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  return 'npm';
}

/**
 * Installs packages using the detected package manager
 */
export async function installPackages(
  dependencies: string[],
  devDependencies: string[] = [],
  logger?: any
): Promise<InstallResult> {
  const packageManager = detectPackageManager();
  
  try {
    if (dependencies.length > 0) {
      logger?.info(`Installing dependencies with ${packageManager}...`);
      const depCommand = getInstallCommand(packageManager, dependencies, false);
      logger?.code(`   ${depCommand}`);
      
      const { stdout, stderr } = await execAsync(depCommand);
      if (stderr && !stderr.includes('npm WARN')) {
        throw new Error(stderr);
      }
    }
    
    if (devDependencies.length > 0) {
      logger?.info(`Installing dev dependencies with ${packageManager}...`);
      const devCommand = getInstallCommand(packageManager, devDependencies, true);
      logger?.code(`   ${devCommand}`);
      
      const { stdout, stderr } = await execAsync(devCommand);
      if (stderr && !stderr.includes('npm WARN')) {
        throw new Error(stderr);
      }
    }
    
    return {
      success: true,
      output: 'Packages installed successfully'
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Gets the install command for the specified package manager
 */
function getInstallCommand(
  packageManager: 'npm' | 'yarn' | 'pnpm',
  packages: string[],
  isDev: boolean
): string {
  const packageList = packages.join(' ');
  
  switch (packageManager) {
    case 'yarn':
      return isDev ? `yarn add -D ${packageList}` : `yarn add ${packageList}`;
    case 'pnpm':
      return isDev ? `pnpm add -D ${packageList}` : `pnpm add ${packageList}`;
    default:
      return isDev ? `npm install -D ${packageList}` : `npm install ${packageList}`;
  }
}

/**
 * Creates a file with content, optionally checking if it already exists
 */
export async function createFile(
  filePath: string, 
  content: string, 
  overwrite: boolean = false
): Promise<FileCreationResult> {
  const fullPath = path.resolve(filePath);
  const exists = await fs.pathExists(fullPath);
  
  if (exists && !overwrite) {
    return {
      created: false,
      existed: true,
      path: fullPath
    };
  }
  
  // Ensure directory exists
  await fs.ensureDir(path.dirname(fullPath));
  
  // Write file
  await fs.writeFile(fullPath, content, 'utf8');
  
  return {
    created: true,
    existed: exists,
    path: fullPath
  };
}

/**
 * Appends content to an existing file or creates it if it doesn't exist
 */
export async function appendToFile(
  filePath: string,
  content: string,
  separator: string = '\n'
): Promise<FileCreationResult> {
  const fullPath = path.resolve(filePath);
  const exists = await fs.pathExists(fullPath);
  
  if (exists) {
    const existingContent = await fs.readFile(fullPath, 'utf8');
    const newContent = existingContent + separator + content;
    await fs.writeFile(fullPath, newContent, 'utf8');
  } else {
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');
  }
  
  return {
    created: true,
    existed: exists,
    path: fullPath
  };
}

/**
 * Updates .gitignore file with Quell-specific entries
 */
export async function updateGitignore(additions: string): Promise<FileCreationResult> {
  const gitignorePath = '.gitignore';
  const exists = await fs.pathExists(gitignorePath);
  
  if (exists) {
    const existingContent = await fs.readFile(gitignorePath, 'utf8');
    
    // Check if Quell entries already exist
    if (existingContent.includes('# Quell cache configuration')) {
      return {
        created: false,
        existed: true,
        path: path.resolve(gitignorePath)
      };
    }
    
    // Append Quell entries
    await appendToFile(gitignorePath, additions);
  } else {
    // Create new .gitignore
    await createFile(gitignorePath, additions.trim());
  }
  
  return {
    created: true,
    existed: exists,
    path: path.resolve(gitignorePath)
  };
}

/**
 * Checks if a package.json exists and reads it
 */
export async function readPackageJson(): Promise<any | null> {
  const packagePath = 'package.json';
  const exists = await fs.pathExists(packagePath);
  
  if (!exists) {
    return null;
  }
  
  try {
    const content = await fs.readFile(packagePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Updates package.json with new scripts and dependencies
 */
export async function updatePackageJson(
  scripts: Record<string, string>,
  dependencies: string[],
  devDependencies: string[]
): Promise<FileCreationResult> {
  const packagePath = 'package.json';
  const exists = await fs.pathExists(packagePath);
  
  if (!exists) {
    // Create a basic package.json
    const basicPackage = {
      name: path.basename(process.cwd()),
      version: '1.0.0',
      description: 'GraphQL server with Quell caching',
      main: 'dist/server.js',
      scripts: {
        ...scripts
      },
      dependencies: {},
      devDependencies: {},
      type: 'module'
    };
    
    await fs.writeFile(packagePath, JSON.stringify(basicPackage, null, 2), 'utf8');
    return {
      created: true,
      existed: false,
      path: path.resolve(packagePath)
    };
  }
  
  // Read existing package.json
  const packageJson = await readPackageJson();
  if (!packageJson) {
    throw new Error('Failed to read existing package.json');
  }
  
  // Update scripts (don't overwrite existing ones)
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  
  Object.entries(scripts).forEach(([key, value]) => {
    if (!packageJson.scripts[key]) {
      packageJson.scripts[key] = value;
    }
  });
  
  // Initialize dependencies objects if they don't exist
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  
  await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
  
  return {
    created: true,
    existed: true,
    path: path.resolve(packagePath)
  };
}

/**
 * Creates a directory structure
 */
export async function createDirectories(dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }
}

/**
 * Checks if we're in a Git repository
 */
export async function isGitRepository(): Promise<boolean> {
  return fs.pathExists('.git');
}

/**
 * Gets the current working directory name
 */
export function getCurrentDirName(): string {
  return path.basename(process.cwd());
}