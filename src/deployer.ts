// src/deployer.ts
import { DeployConfig, NeexProject } from './types.js';
import { Logger } from './utils/logger.js';
import { SystemUtils } from './utils/system.js';
import { PM2Generator } from './generators/pm2.js';
import { NginxGenerator } from './generators/nginx.js';

export class Deployer {
    private logger: Logger;
    private system: SystemUtils;
    private pm2: PM2Generator;
    private nginx: NginxGenerator;

    constructor() {
        this.logger = new Logger();
        this.system = new SystemUtils(this.logger);
        this.pm2 = new PM2Generator(this.logger, this.system);
        this.nginx = new NginxGenerator(this.logger, this.system);
    }

    async deploy(config: DeployConfig, project: NeexProject): Promise<void> {
        this.logger.info(`🚀 Starting deployment of ${config.projectName}`);

        try {
            // Step 1: Prerequisites
            await this.checkPrerequisites(project);

            // Step 2: Build project
            await this.buildProject(project);

            // Step 3: Generate environment file
            await this.generateEnvironment(config, project);

            // Step 4: Setup PM2
            await this.setupPM2(config, project);

            // Step 5: Setup Nginx (if requested)
            if (config.nginxConfig) {
                await this.setupNginx(config, project);
            }

            // Step 6: Create management scripts
            await this.createManagementScripts(config, project);

            // Step 7: Final checks
            await this.performFinalChecks(config, project);

            this.logger.success(`🎉 Deployment completed successfully!`);
            this.printPostDeploymentInfo(config, project);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Deployment failed: ${errorMessage}`);
            throw error;
        }
    }

    private async checkPrerequisites(project: NeexProject): Promise<void> {
        this.logger.step('Checking prerequisites...');

        // Check Node.js
        if (!await this.system.checkCommand('node')) {
            throw new Error('Node.js is not installed');
        }

        // Check package manager
        if (!await this.system.checkCommand(project.packageManager)) {
            throw new Error(`${project.packageManager} is not installed`);
        }

        this.logger.success('Prerequisites checked');
    }

    private async buildProject(project: NeexProject): Promise<void> {
        this.logger.step('Building project...');

        this.logger.startSpinner('Installing dependencies...');
        await this.system.executeCommand(project.packageManager, ['install'], project.rootPath);
        this.logger.updateSpinner('Building applications...');
        await this.system.executeCommand(project.packageManager, ['run', 'build'], project.rootPath);
        this.logger.stopSpinner();

        this.logger.success('Project built successfully');
    }

    private async generateEnvironment(config: DeployConfig, project: NeexProject): Promise<void> {
        const envPath = `${project.rootPath}/.env`;
        const envExists = await this.system.checkCommand(`test -f ${envPath}`);

        if (!envExists) {
            const envContent = `NODE_ENV=${config.environment}
DATABASE_URL="your-database-connection-string"
PORT_CLIENT=${config.clientPort}
PORT_SERVER=${config.serverPort}
# Add your other environment variables here
`;

            await this.system.writeFile(envPath, envContent);
            this.logger.success('.env file created');
            this.logger.warning('Please update .env with your actual values');
        } else {
            this.logger.success('.env file already exists');
        }
    }

    private async setupPM2(config: DeployConfig, project: NeexProject): Promise<void> {
        this.logger.step('Setting up PM2...');

        await this.pm2.install();
        await this.pm2.generate(config, project);
        await this.pm2.start(config, project);
    }

    private async setupNginx(config: DeployConfig, project: NeexProject): Promise<void> {
        this.logger.step('Setting up Nginx...');

        try {
            await this.nginx.install();
            await this.nginx.generate(config, project);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warning(`Nginx setup requires manual intervention: ${errorMessage}`);
        }
    }

    private async createManagementScripts(config: DeployConfig, project: NeexProject): Promise<void> {
        this.logger.step('Creating management scripts...');

        // Status script
        const statusScript = `#!/bin/bash
echo "=== PM2 Status ==="
pm2 status

echo -e "\\n=== PM2 Logs (last 20 lines) ==="
pm2 logs --lines 20

echo -e "\\n=== Port Status ==="
netstat -tulpn | grep -E ":(${config.clientPort}|${config.serverPort}|80|443)" || true

echo -e "\\n=== System Resources ==="
df -h
free -h 2>/dev/null || top -l 1 | grep -E "^(Processes|PhysMem)"
`;

        await this.system.writeFile(`${project.rootPath}/status.sh`, statusScript);
        await this.system.executeCommand('chmod', ['+x', 'status.sh'], project.rootPath);

        // Restart script
        const restartScript = `#!/bin/bash
echo "Restarting services..."
pm2 restart all
echo "Services restarted!"
`;

        await this.system.writeFile(`${project.rootPath}/restart.sh`, restartScript);
        await this.system.executeCommand('chmod', ['+x', 'restart.sh'], project.rootPath);

        this.logger.success('Management scripts created');
    }

    private async performFinalChecks(config: DeployConfig, project: NeexProject): Promise<void> {
        this.logger.step('Performing final checks...');

        // Wait a moment for services to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if ports are accessible
        if (project.hasClient) {
            const clientAvailable = await this.system.isPortAvailable(config.clientPort);
            if (clientAvailable) {
                this.logger.warning(`Client port ${config.clientPort} seems to be available (service might not be running)`);
            } else {
                this.logger.success(`Client is running on port ${config.clientPort}`);
            }
        }

        if (project.hasServer) {
            const serverAvailable = await this.system.isPortAvailable(config.serverPort);
            if (serverAvailable) {
                this.logger.warning(`Server port ${config.serverPort} seems to be available (service might not be running)`);
            } else {
                this.logger.success(`Server is running on port ${config.serverPort}`);
            }
        }
    }

    private printPostDeploymentInfo(config: DeployConfig, project: NeexProject): void {
        console.log('\n' + '='.repeat(60));
        console.log('🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));

        console.log('\n📋 Your application is now running:');
        if (project.hasClient) {
            console.log(`   Frontend: http://localhost:${config.clientPort}`);
        }
        if (project.hasServer) {
            console.log(`   Backend:  http://localhost:${config.serverPort}`);
        }
        if (config.domain !== 'localhost') {
            console.log(`   Public:   http://${config.domain}`);
        }

        console.log('\n🔧 Management commands:');
        console.log('   Check status: ./status.sh');
        console.log('   Restart:      ./restart.sh');
        console.log('   PM2 logs:     pm2 logs');
        console.log('   PM2 monitor:  pm2 monit');

        console.log('\n📝 Next steps:');
        console.log('   1. Update .env file with your actual values');
        if (config.nginxConfig) {
            console.log('   2. Follow nginx-setup.md for Nginx configuration');
            console.log('   3. Setup SSL certificate for production');
        }
        console.log('   4. Configure your firewall to allow HTTP/HTTPS traffic');

        console.log('\n' + '='.repeat(60));
    }
}