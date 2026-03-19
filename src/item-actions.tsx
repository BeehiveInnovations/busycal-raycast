import {
  Action,
  ActionPanel,
  Clipboard,
  Icon,
  closeMainWindow,
} from "@raycast/api";
import { formatOccurrence, busyCalDateURL } from "./busycal-date";
import { openBusyCalItem, openBusyCalURL } from "./busycal-url";
import { BusyCalInstallation, BusyCalItem } from "./types";

/**
 * Standard action panel shared by BusyCal item list commands.
 */
export function BusyCalItemActions(props: {
  installation: BusyCalInstallation;
  item: BusyCalItem;
}) {
  const { installation, item } = props;
  const dateURL = busyCalDateURL(item);
  const detailLines = [
    item.title,
    `Type: ${item.type}`,
    formatOccurrence(item) ? `When: ${formatOccurrence(item)}` : undefined,
    item.location ? `Location: ${item.location}` : undefined,
    `Calendar ID: ${item.calendarID}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <ActionPanel>
      <Action
        title="Open in BusyCal"
        icon={Icon.Calendar}
        onAction={async () => {
          await openBusyCalItem(installation, item);
          await closeMainWindow();
        }}
      />
      {dateURL ? (
        <Action
          title="Open BusyCal on Date"
          icon={Icon.Clock}
          onAction={async () => {
            await openBusyCalURL(installation, dateURL);
            await closeMainWindow();
          }}
        />
      ) : null}
      <Action.CopyToClipboard title="Copy Item Details" content={detailLines} />
      <Action
        title="Copy Title"
        icon={Icon.Text}
        onAction={() => Clipboard.copy(item.title)}
      />
    </ActionPanel>
  );
}
