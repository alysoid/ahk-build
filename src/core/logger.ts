export interface Logger {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export function createLogger(verbose = false): Logger {
  return {
    info: (message) => console.log(message),
    success: (message) => console.log(`OK  ${message}`),
    warn: (message) => console.warn(`WARN  ${message}`),
    error: (message) => console.error(`ERROR  ${message}`),
    debug: (message) => {
      if (verbose) console.log(`DEBUG  ${message}`);
    },
  };
}
