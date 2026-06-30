import { ErrorHandler, Injectable } from '@angular/core';
import { describeError, reportRuntimeError } from './runtime-error.store';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const msg = describeError(error);
    // SVGLength read fails when tree container hasn't been laid out yet — harmless
    if (msg.includes('SVGLength')) {
      console.warn(`[RuntimeError suppressed] ${msg}`);
      return;
    }
    reportRuntimeError({ source: 'angular.error' });
    console.error(`[RuntimeError] ${msg}`);
  }
}
