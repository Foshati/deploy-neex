// src/generators/pm2.ts
import { DeployConfig, NeexProject } from '../types.js';
import { Logger } from '../utils/logger.js';
import { SystemUtils } from '../utils/system.js';

interface PM2AppConfig {
  name: string;
  script: string;
  args: string;
  cwd: string;
  instances: number;
  autorestart: boolean;
  watch: boolean;
  max_memory_restart: string;
  env: {
    NODE_ENV: string;
    PORT: number;
  };
}

export class PM2Generator {
    private logger: Logger;
    private system: SystemUtils;

    constructor(logger: Logger, system: SystemUtils) {
        this.logger = logger;
        this.system = system;
    }

    async generate(config: DeployConfig, project: NeexProject): Promise<void> {
        const ecosystemConfig = this.generateEcosystemConfig(config, project);

        await this.system.writeFile(
            `${project.rootPath}/ecosystem.config.js`,
            ecosystemConfig
        );

        this.logger.success('PM2 ecosystem.config.js generated');
    }

    private generateEcosystemConfig(config: DeployConfig, project: NeexProject): string {
        const apps: PM2AppConfig[] = [];

        if (project.hasClient) {
            apps.push({
                name: `${config.projectName}-client`,
                script: config.packageManager,
                args: 'run start:client',
                cwd: project.rootPath,
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: '1G',
                env: {
                    NODE_ENV: config.environment,
                    PORT: config.clientPort
                }
            });
        }

        if (project.hasServer) {
            apps.push({
                name: `${config.projectName}-server`,
                script: config.packageManager,
                args: 'run start:server',
                cwd: project.rootPath,
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: '1G',
                env: {
                    NODE_ENV: config.environment,
                    PORT: config.serverPort
                }
            });
        }

        return `module.exports = {
  apps: ${JSON.stringify(apps, null, 2)}
};`;
    }

    async install(): Promise<void> {
        if (!await this.system.checkCommand('pm2')) {
            this.logger.step('Installing PM2 globally...');
            await this.system.installPackage('pm2', true);
            this.logger.success('PM2 installed');
        } else {
            this.logger.success('PM2 already installed');
        }
    }

    async start(config: DeployConfig, project: NeexProject): Promise<void> {
        this.logger.step('Starting PM2 applications...');

        try {
            // Stop existing processes if any
            await this.system.executeCommand('pm2', ['delete', 'all'], project.rootPath).catch(() => {
                // Ignore errors if no processes exist
            });

            // Start new processes
            await this.system.executeCommand('pm2', ['start', 'ecosystem.config.js'], project.rootPath);
            await this.system.executeCommand('pm2', ['save']);

            if (config.autoStart) {
                try {
                    await this.system.executeCommand('pm2', ['startup']);
                    this.logger.success('PM2 auto-startup configured');
                } catch (error) {
                    this.logger.warning('Could not configure PM2 auto-startup. You may need to run this manually with sudo.');
                }
            }

            this.logger.success('PM2 applications started');
        } catch (error: any) {
            this.logger.error(`Failed to start PM2 applications: ${error.message}`);
            throw error;
        }
    }

    async stop(): Promise<void> {
        this.logger.step('Stopping PM2 applications...');
        try {
            await this.system.executeCommand('pm2', ['stop', 'all']);
            this.logger.success('PM2 applications stopped');
        } catch (error: any) {
            this.logger.error(`Failed to stop PM2 applications: ${error.message}`);
            throw error;
        }
    }

    async restart(): Promise<void> {
        this.logger.step('Restarting PM2 applications...');
        try {
            await this.system.executeCommand('pm2', ['restart', 'all']);
            this.logger.success('PM2 applications restarted');
        } catch (error: any) {
            this.logger.error(`Failed to restart PM2 applications: ${error.message}`);
            throw error;
        }
    }

    async delete(): Promise<void> {
        this.logger.step('Deleting PM2 applications...');
        try {
            await this.system.executeCommand('pm2', ['delete', 'all']);
            this.logger.success('PM2 applications deleted');
        } catch (error: any) {
            this.logger.error(`Failed to delete PM2 applications: ${error.message}`);
            throw error;
        }
    }
}