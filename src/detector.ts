// src/detector.ts
import fs from 'fs-extra';
import path from 'path';
import { NeexProject } from './types.js';
import { Logger } from './utils/logger.js';

export class NeexDetector {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async detectProject(rootPath: string = process.cwd()): Promise<NeexProject | null> {
        const packageJsonPath = path.join(rootPath, 'package.json');

        if (!await fs.pathExists(packageJsonPath)) {
            this.logger.error('package.json not found. Are you in a Node.js project?');
            return null;
        }

        const packageJson = await fs.readJson(packageJsonPath);

        // Check if it's a Neex project
        const isNeexProject =
            packageJson.devDependencies?.neex ||
            packageJson.dependencies?.neex ||
            packageJson.workspaces?.includes('apps/client') ||
            packageJson.workspaces?.includes('apps/server');

        if (!isNeexProject) {
            this.logger.error('This doesn\'t appear to be a Neex project.');
            return null;
        }

        const clientPath = path.join(rootPath, 'apps', 'client');
        const serverPath = path.join(rootPath, 'apps', 'server');

        const hasClient = await fs.pathExists(clientPath);
        const hasServer = await fs.pathExists(serverPath);

        if (!hasClient && !hasServer) {
            this.logger.error('No client or server found in apps/ directory.');
            return null;
        }

        // Detect package manager
        let packageManager = 'npm';
        if (await fs.pathExists(path.join(rootPath, 'bun.lockb'))) packageManager = 'bun';
        else if (await fs.pathExists(path.join(rootPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
        else if (await fs.pathExists(path.join(rootPath, 'yarn.lock'))) packageManager = 'yarn';

        this.logger.success(`Detected Neex project with ${packageManager}`);

        return {
            hasClient,
            hasServer,
            clientPath,
            serverPath,
            rootPath,
            packageManager
        };
    }

    async detectPorts(project: NeexProject): Promise<{ clientPort: number; serverPort: number }> {
        let clientPort = 3000;
        let serverPort = 8000;

        // Try to detect from package.json scripts or server files
        if (project.hasServer) {
            const serverPackageJson = path.join(project.serverPath, 'package.json');
            if (await fs.pathExists(serverPackageJson)) {
                const serverPkg = await fs.readJson(serverPackageJson);
                // Look for port in start script or dev script
                const startScript = serverPkg.scripts?.start || '';
                const devScript = serverPkg.scripts?.dev || '';

                const portMatch = (startScript + devScript).match(/(?:PORT|port)[=\s]+(\d+)/);
                if (portMatch) {
                    serverPort = parseInt(portMatch[1]);
                }
            }

            // Also check server.ts file for port configuration
            const serverTsPath = path.join(project.serverPath, 'src', 'server.ts');
            if (await fs.pathExists(serverTsPath)) {
                const serverContent = await fs.readFile(serverTsPath, 'utf-8');
                const portMatch = serverContent.match(/(?:PORT|port)[:\s=]+(\d+)/);
                if (portMatch) {
                    serverPort = parseInt(portMatch[1]);
                }
            }
        }

        this.logger.info(`Detected ports - Client: ${clientPort}, Server: ${serverPort}`);

        return { clientPort, serverPort };
    }
}