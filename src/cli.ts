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

    } catch (error) {
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
  .action(async (optio
