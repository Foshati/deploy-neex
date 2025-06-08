// src/types.ts
export interface DeployConfig {
  projectName: string;
  domain: string;
  ssl: boolean;
  email?: string;
  clientPort: number;
  serverPort: number;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  environment: 'production' | 'staging';
  autoStart: boolean;
  nginxConfig: boolean;
}

export interface NeexProject {
  hasClient: boolean;
  hasServer: boolean;
  clientPath: string;
  serverPath: string;
  rootPath: string;
  packageManager: string;
}