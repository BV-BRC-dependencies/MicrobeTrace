import { ErrorHandler, Injectable } from '@angular/core';
import { describeError, reportRuntimeError } from './runtime-error.store';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const msg = describeError(error);
    reportRuntimeError({ source: 'angular.error' });
    if (msg.includes('SVGLength')) {
      console.warn(`[RuntimeError suppressed] ${msg}`);
      setTimeout(() => dismissRuntimeError(), 100);
      return;
    }
    console.error(`[RuntimeError] ${msg}`);
  }
}
