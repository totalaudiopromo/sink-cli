export type { SoakProvider, SoakResult } from '../../types.js';

export class SoakConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SoakConfigError';
  }
}
