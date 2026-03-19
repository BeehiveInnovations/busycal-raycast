/**
 * Detects BusyCal builds that predate the canonical `open item` scripting command.
 */
export function isUnsupportedOpenItemCommandError(message: string): boolean {
  return (
    message.includes("Expected end of line") ||
    message.includes("Expected expression") ||
    message.includes("open item") ||
    message.includes("doesn’t understand") ||
    message.includes("doesn't understand")
  );
}
