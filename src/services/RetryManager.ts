class RetryManagerService {
  private readonly retryScheduleMs = [10000, 20000, 40000, 80000, 160000];
  private readonly maxRetries = 5;

  /**
   * Determine if an error is transient and should be retried.
   */
  public isRetryable(error: any): boolean {
    if (!error) return false;

    const errMsg = String(error.message || error).toLowerCase();
    const status = error.status || error.code || 0;

    // Authentication errors (do not retry)
    if (status === 401 || status === 403 || errMsg.includes('unauthorized') || errMsg.includes('forbidden') || errMsg.includes('invalid api key')) {
      return false;
    }

    // Prompt compilation/input validation errors (do not retry)
    if (status === 400 || errMsg.includes('bad request') || errMsg.includes('prompt') || errMsg.includes('invalid argument') || errMsg.includes('only pdf')) {
      return false;
    }

    // JSON parsing/schema validation errors (do not retry)
    if (errMsg.includes('json') || errMsg.includes('parse') || errMsg.includes('invalid structured data') || errMsg.includes('expected json')) {
      return false;
    }

    // Rate limits (429), server overloads (503/504), network errors, database timeouts (retryable)
    if (
      status === 429 || 
      status === 503 || 
      status === 504 || 
      status === 500 || 
      errMsg.includes('quota') ||
      errMsg.includes('rate limit') ||
      errMsg.includes('resource_exhausted') ||
      errMsg.includes('unavailable') ||
      errMsg.includes('timeout') ||
      errMsg.includes('failed to fetch') ||
      errMsg.includes('network') ||
      errMsg.includes('load failed') ||
      errMsg.includes('offline')
    ) {
      return true;
    }

    // Default: retry unknown errors as safety measure
    return true;
  }

  public getDelay(retryCount: number): number {
    const index = Math.min(retryCount, this.retryScheduleMs.length - 1);
    return this.retryScheduleMs[index] || 10000;
  }

  public getMaxRetries(): number {
    return this.maxRetries;
  }
}

export const RetryManager = new RetryManagerService();
