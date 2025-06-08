// src/generators/pm2.ts
import { DeployConfig, NeexProject } from '../types.js';
import { Logger } from '../utils/logger.js';
import { SystemUtils } from '../utils/system.js';

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
        const apps = [];

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

        await this.system.executeCommand('pm2', ['start', 'ecosystem.config.js'], project.rootPath);
        await this.system.executeCommand('pm2', ['save']);

        if (config.autoStart) {
            await this.system.executeCommand('pm2', ['startup']);
        }

        this.logger.success('PM2 applications started');
    }
}
