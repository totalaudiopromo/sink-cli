import chalk from 'chalk';
import ora from 'ora';
import type { SinkStats } from '../types.js';

// ── Rail glyphs ──────────────────────────────────────────────────────
const RAIL = chalk.cyan('\u2502');
const RAIL_TOP = chalk.cyan('\u256D');
const RAIL_BOT = chalk.cyan('\u2570');
const RAIL_DIV = chalk.cyan('\u251C');
const DIAMOND = chalk.cyan('\u25C7');
const CHECK = chalk.green('\u2713');
const CROSS = chalk.red('\u2717');
const TILDE = chalk.yellow('~');

function num(n: number): string {
  return n.toLocaleString('en-GB');
}

// ── Exports ──────────────────────────────────────────────────────────

export function intro(version: string): void {
  console.log(`${RAIL_TOP}  ${chalk.bold(`sink v${version}`)}`);
  console.log(RAIL);
}

export function step(message: string): void {
  console.log(`${RAIL}  ${message}`);
}

export function stepComplete(message: string): void {
  console.log(`${DIAMOND}  ${message}`);
}

export function blank(): void {
  console.log(RAIL);
}

export function validationRow(
  status: 'ok' | 'fail' | 'warn',
  label: string,
  count: number,
  unit: string,
): void {
  const icon = status === 'ok' ? CHECK : status === 'fail' ? CROSS : TILDE;
  const countStr = num(count).padStart(6);
  console.log(`${RAIL}  ${icon} ${label.padEnd(18)}${chalk.dim(countStr)} ${chalk.dim(unit)}`);
}

export function divider(): void {
  console.log(`${RAIL_DIV}${'\u2500'.repeat(44)}`);
}

export function summary(stats: SinkStats): void {
  const parts = [
    chalk.green(`${num(stats.scrub.valid)} valid`),
    chalk.red(`${num(stats.scrub.invalid)} invalid`),
    chalk.yellow(`${num(stats.scrub.risky)} risky`),
  ];
  console.log(`${RAIL}  ${parts.join(chalk.dim('  \u00B7  '))}`);

  const secondary = [
    `${num(stats.scrub.typos)} typos fixed`,
    `${num(stats.rinse.duplicates)} dupes merged`,
    `${num(stats.soak.enriched)} enriched`,
  ];
  console.log(`${RAIL}  ${chalk.dim(secondary.join('  \u00B7  '))}`);
}

export function outputPath(path: string): void {
  console.log(`${RAIL}  ${chalk.dim('\u2192')} ${chalk.cyan(path)}`);
}

export function outro(elapsedMs: number): void {
  const secs = (elapsedMs / 1000).toFixed(1);
  console.log(`${RAIL_BOT}  ${chalk.dim(`Done in ${secs}s`)}`);
}

/**
 * Spinner that sits inside the rail.
 * Call .succeed(text) to replace with a diamond checkpoint.
 */
export function createRailSpinner(text: string) {
  const spinner = ora({
    text,
    prefixText: RAIL,
    spinner: 'dots',
  });
  return {
    start() {
      spinner.start();
      return this;
    },
    succeed(msg: string) {
      spinner.stop();
      stepComplete(msg);
    },
    stop() {
      spinner.stop();
    },
  };
}
