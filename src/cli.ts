#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { NeexDetector } from './detector.js';
import { Deployer } from './deployer.js';
import { DeployConfig } from './types.js';
import { Logger } from './utils/logger.js';

const program = new Command();
const logger = new Logger();

async function promptForConfig(project: any, clientPort: number, serverPort: number, options: any): Promise<DeployConfig> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Enter project name:',
      default: 'neex-app',
      validate: (input: string) => {
        if (!input.trim()) return 'Project name is required';
        if (!/^[a-zA-Z0-9-_]+$/.test(input)) return 'Project name can only contain letters, numbers, hyphens, and underscores';
        return true;
      }
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Enter domain name:',
      default: options.domain || 'localhost',
      validate: (input: string) => {
        if (!input.trim()) return 'Domain is required';
        return true;
      }
    },
    {
      type: 'list',
      name: 'environment',
      message: 'Select environment:',
      choices: ['production', 'staging'],
      default: 'production'
    },
    {
      type: 'confirm',
      name: 'nginxConfig',
      message: 'Setup Nginx configuration?',
      default: !options.noNginx
    },
    {
      type: 'confirm',
      name: 'ssl',
      message: 'Setup SSL certificate?',
      default: !options.noSsl,
      when: (answers: any) => answers.nginxConfig && answers.domain !== 'localhost'
    },
    {
      type: 'input',
      name: 'email',
      message: 'Enter email for SSL certificate:',
      when: (answers: any) => answers.ssl,
      validate: (input: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input)) return 'Please enter a valid email address';
        return true;
      }
    },
    {
      type: 'input',
      name: 'clientPort',
      message: 'Client port:',
      default: clientPort.toString(),
      when: () => project.hasClient,
      validate: (input: string) => {
        const port = parseInt(input);
        if (isNaN(port) || port < 1 || port > 65535) return 'Please enter a valid port number (1-65535)';
        return true;
      }
    },
    {
      type: 'input',
      name: 'serverPort',
      message: 'Server port:',
      default: serverPort.toString(),
      when: () => project.hasServer,
      validate: (input: string) => {
        const port = parseInt(input);
        if (isNaN(port) || port < 1 || port > 65535) return 'Please enter a valid port number (1-65535)';
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'autoStart',
      message: 'Auto-start services on system boot?',
      default: true
    }
  ]);

  return {
    projectName: answers.projectName,
    domain: answers.domain,
    ssl: answers.ssl || false,
    email: answers.email,
    clientPort: project.hasClient ? parseInt(answers.clientPort) : clientPort,
    serverPort: project.hasServer ? parseInt(answers.serverPort) : serverPort,
    packageManager: project.packageManager as any,
    environment: answers.environment,
    autoStart: answers.autoStart,
    nginxConfig: answers.nginxConfig
  };
}

program
  .name('deploy-neex')
  .description('CLI tool for deploying Neex applications')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy a Neex application')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('--domain <domain>', 'Domain name')
  .option('--no-nginx', 'Skip Nginx configuration')
  .option('--no-ssl', 'Skip SSL setup')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🚀 Neex Deployment Tool\n'));

      // Detect project
      const detector = new NeexDetector(logger);
      const project = await detector.detectProject();
      
      if (!project) {
        process.exit(1);
      }

      // Detect ports
      const { clientPort, serverPort } = await detector.detectPorts(project);

      // Get configuration
      let config: DeployConfig;
      
      if (options.yes) {
        config = {
          projectName: 'neex-app',
          domain: options.domain || 'localhost',
          ssl: !options.noSsl,
          clientPort,
          serverPort,
          packageManager: project.packageManager as any,
          environment: 'production',
          autoStart: true,
          nginxConfig: !options.noNginx
        };
      } else {
        config = await promptForConfig(project, clientPort, serverPort, options);
      }

      // Deploy
      const deployer = new Deployer();
      await deployer.deploy(config, project);

    } catch (error: any) {
      logger.error(`Deployment failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check deployment status')
  .action(async () => {
    try {
      const { execa } = await import('execa');
      await execa('pm2', ['status'], { stdio: 'inherit' });
    } catch (error) {
      logger.error('Failed to get status. Is PM2 installed?');
    }
  });

program
  .command('logs')
  .description('Show application logs')
  .option('-f, --follow', 'Follow logs')
  .option('-l, --lines <number>', 'Number of lines to show', '50')
  .action(async (options) => {
    try {
      const { execa } = await import('execa');
      const args = ['logs'];
      
      if (options.follow) args.push('-f');
      if (options.lines) args.push('--lines', options.lines);
      
      await execa('pm2', args, { stdio: 'inherit' });
    } catch (error) {
      logger.error('Failed to show logs. Is PM2 installed?');
    }
  });

program
  .command('stop')
  .description('Stop all services')
  .action(async () => {
    try {
      const { execa } = await import('execa');
      await execa('pm2', ['stop', 'all'], { stdio: 'inherit' });
      logger.success('All services stopped');
    } catch (error) {
      logger.error('Failed to stop services. Is PM2 installed?');
    }
  });

program
  .command('restart')
  .description('Restart all services')
  .action(async () => {
    try {
      const { execa } = await import('execa');
      await execa('pm2', ['restart', 'all'], { stdio: 'inherit' });
      logger.success('All services restarted');
    } catch (error) {
      logger.error('Failed to restart services. Is PM2 installed?');
    }
  });

program
  .command('delete')
  .description('Delete all services')
  .action(async () => {
    try {
      const { execa } = await import('execa');
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: 'Are you sure you want to delete all PM2 processes?',
          default: false
        }
      ]);

      if (confirm.confirmDelete) {
        await execa('pm2', ['delete', 'all'], { stdio: 'inherit' });
        logger.success('All services deleted');
      } else {
        logger.info('Operation cancelled');
      }
    } catch (error) {
      logger.error('Failed to delete services. Is PM2 installed?');
    }
  });

program.parse();