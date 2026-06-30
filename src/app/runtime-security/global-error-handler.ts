import { ErrorHandler, Injectable } from '@angular/core';
import { describeError, reportRuntimeError } from './runtime-error.store';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const msg = describeError(error);
    if (msg.includes('SVGLength')) {
      console.warn(`[SVGLength] ${msg}`);
      return;
    }
    reportRuntimeError({ source: 'angular.error' });
    console.error(`[RuntimeError] ${msg}`);
  }
}
