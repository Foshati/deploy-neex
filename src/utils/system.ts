// src/utils/system.ts
import { execa } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from './logger.js';

export class SystemUtils {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async checkCommand(command: string): Promise<boolean> {
        try {
            await execa('which', [command]);
            return true;
        } catch {
            return false;
        }
    }

    async installPackage(packageName: string, global: boolean = true): Promise<void> {
        const args = global ? ['install', '-g', packageName] : ['install', packageName];
        await execa('npm', args);
    }

    async executeCommand(command: string, args: string[], cwd?: string): Promise<void> {
        await execa(command, args, { cwd, stdio: 'inherit' });
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
    }

    async copyTemplate(templatePath: string, targetPath: string, replacements: Record<string, string>): Promise<void> {
        let content = await fs.readFile(templatePath, 'utf-8');

        for (const [key, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }

        await this.writeFile(targetPath, content);
    }

    async isPortAvailable(port: number): Promise<boolean> {
        try {
            const detectPort = await import('detect-port');
            const availablePort = await detectPort.default(port);
            return availablePort === port;
        } catch {
            return false;
        }
    }

    getOS(): 'linux' | 'darwin' | 'windows' {
        const platform = process.platform;
        if (platform === 'darwin') return 'darwin';
        if (platform === 'win32') return 'windows';
        return 'linux';
    }
}