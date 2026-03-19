import {
  closeMainWindow,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";
import { createBusyCalNaturalLanguageItem } from "./busycal-automation";
import { resolveBusyCalInstallation } from "./busycal-installation";
import { Preferences } from "./types";

/**
 * Sends one quick natural-language entry into BusyCal's AppleScript-backed NLP command.
 */
export async function quickAdd(
  kind: "event" | "task",
  inputText: string,
): Promise<void> {
  const installation = await resolveBusyCalInstallation();
  const preferences = getPreferenceValues<Preferences>();
  const trimmedText = inputText.trim();
  if (!trimmedText) {
    throw new Error("Enter some text for BusyCal to parse.");
  }

  const createdItem = await createBusyCalNaturalLanguageItem(installation, {
    text: trimmedText,
    itemType: kind,
  });

  if (preferences.hideOnQuickAdd) {
    await closeMainWindow();
  }

  await showToast({
    style: Toast.Style.Success,
    title: kind === "event" ? "BusyCal event created" : "BusyCal task created",
    message: createdItem.title,
  });
}
