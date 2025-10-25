#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { LogAnalyzer } from '@website-log-insights/log-analyzer';
import { displayResults } from './display.js';
import { existsSync } from 'fs';
import chalk from 'chalk';

const program = new Command();

program
  .name('log-insights')
  .description('Analyze nginx access logs and generate insights')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a log file and display insights')
  .option('-f, --file <path>', 'Path to the log file')
  .option('-h, --host <hostname>', 'Hostname for the log file (e.g., example.com)')
  .option('-d, --database <path>', 'Path to the SQLite database (default: ./logs.db)')
  .option('--clear', 'Clear existing data before importing')
  .action(async (options) => {
    try {
      let logFilePath = options.file;
      let hostname = options.host;
      
      // Prompt for missing parameters
      const prompts = [];
      
      if (!logFilePath) {
        prompts.push({
          type: 'input',
          name: 'logFilePath',
          message: 'Enter the path to your nginx access log file:',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Please enter a file path';
            }
            if (!existsSync(input.trim())) {
              return 'File does not exist';
            }
            return true;
          }
        });
      }
      
      if (!hostname) {
        prompts.push({
          type: 'input',
          name: 'hostname',
          message: 'Enter the hostname for this log file (e.g., example.com):',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Please enter a hostname';
            }
            return true;
          }
        });
      }
      
      if (prompts.length > 0) {
        const answers = await inquirer.prompt(prompts);
        logFilePath = logFilePath || answers.logFilePath?.trim();
        hostname = hostname || answers.hostname?.trim();
      }

      // Validate file exists
      if (!existsSync(logFilePath)) {
        console.error(chalk.red(`Error: File not found: ${logFilePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('🚀 Starting log analysis...'));
      console.log(chalk.gray(`Log file: ${logFilePath}`));
      console.log(chalk.gray(`Hostname: ${hostname}`));
      
      if (options.database) {
        console.log(chalk.gray(`Database: ${options.database}`));
      }

      const analyzer = new LogAnalyzer(options.database);
      
      if (options.clear) {
        console.log(chalk.yellow('🗑️  Clearing existing data...'));
        analyzer.clearData();
      }

      // Load and analyze the log file
      await analyzer.loadLogFile(logFilePath, hostname);
      
      console.log(chalk.blue('📊 Running analysis...'));
      const results = await analyzer.analyze();

      // Display results
      await displayResults(results);

      analyzer.close();
      console.log(chalk.green('✅ Analysis complete!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('clear')
  .description('Clear all data from the database')
  .option('-d, --database <path>', 'Path to the SQLite database (default: ./logs.db)')
  .action(async (options) => {
    try {
      const analyzer = new LogAnalyzer(options.database);
      analyzer.clearData();
      analyzer.close();
      console.log(chalk.green('✅ Database cleared successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// If no command is provided, default to analyze
if (process.argv.length === 2) {
  program.parse(['node', 'log-insights', 'analyze']);
} else {
  program.parse();
}
