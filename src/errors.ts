import { AxiError, exitCodeForError } from "axi-sdk-js";

export { AxiError, exitCodeForError };

/** Build a usage error (exit code 2) with actionable next-step suggestions. */
export function usage(message: string, ...suggestions: string[]): AxiError {
  return new AxiError(message, "VALIDATION_ERROR", suggestions);
}
