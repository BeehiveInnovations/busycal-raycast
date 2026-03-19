/**
 * Normalizes one quick-entry string for BusyCal's AppleScript NLP command.
 */
export function busyCalQuickEntryText(
  _kind: "event" | "task",
  inputText: string,
): string {
  const trimmedText = inputText.trim();
  if (!trimmedText) {
    throw new Error("Enter some text for BusyCal to parse.");
  }

  return trimmedText;
}
