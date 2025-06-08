// src/utils/logger.ts
import chalk from 'chalk';
import ora from 'ora';

export class Logger {
    private spinner = ora();

    success(message: string) {
        console.log(chalk.green('✓'), message);
    }

    error(message: string) {
        console.log(chalk.red('✗'), message);
    }

    warning(message: string) {
        console.log(chalk.yellow('⚠'), message);
    }

    info(message: string) {
        console.log(chalk.blue('ℹ'), message);
    }

    step(message: string) {
        console.log(chalk.cyan('→'), message);
    }

    startSpinner(text: string) {
        this.spinner.start(text);
    }

    stopSpinner(success: boolean = true) {
        if (success) {
            this.spinner.succeed();
        } else {
            this.spinner.fail();
        }
    }

    updateSpinner(text: string) {
        this.spinner.text = text;
    }
}