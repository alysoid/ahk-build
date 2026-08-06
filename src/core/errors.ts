export class AhkBuildError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AhkBuildError";
    this.code = code;
  }
}

export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
