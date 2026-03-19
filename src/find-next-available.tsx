import {
  Action,
  ActionPanel,
  Detail,
  Form,
  getPreferenceValues,
  Icon,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import {
  findNextBusyCalAvailable,
  listBusyCalCalendars,
} from "./busycal-automation";
import { busyCalDateURLForDateString } from "./busycal-date";
import { resolveBusyCalInstallation } from "./busycal-installation";
import { CreateEventForm } from "./create-event";
import { openBusyCalURL } from "./busycal-url";
import {
  BusyCalCalendar,
  BusyCalInstallation,
  BusyCalNextAvailableResult,
  Preferences,
} from "./types";

interface AvailabilityFormValues {
  minimumDurationMinutes: string;
  calendarID?: string;
  respectWorkingHours: boolean;
}

/**
 * Result screen shown after BusyCal returns the next available slot.
 */
function AvailabilityResultDetail(props: {
  installation: BusyCalInstallation;
  result: BusyCalNextAvailableResult | null;
}) {
  if (!props.result) {
    return (
      <Detail
        markdown={
          "# No Matching Slot\n\nBusyCal did not return a free slot for the selected criteria."
        }
      />
    );
  }

  const slotSummary = [
    `Start: ${props.result.startDate}`,
    `End: ${props.result.endDate}`,
    props.result.timeZoneIdentifier
      ? `Time Zone: ${props.result.timeZoneIdentifier}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
  const dateURL = busyCalDateURLForDateString(props.result.startDate);
  const timeZoneLine = props.result.timeZoneIdentifier
    ? `\n\nTime Zone: ${props.result.timeZoneIdentifier}`
    : "";
  return (
    <Detail
      markdown={`# Next Available Slot\n\nStart: ${props.result.startDate}\n\nEnd: ${props.result.endDate}${timeZoneLine}`}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Slot Details"
            content={slotSummary}
            icon={Icon.Clipboard}
          />
          {dateURL ? (
            <Action
              title="Open BusyCal on Date"
              icon={Icon.Calendar}
              onAction={() => openBusyCalURL(props.installation, dateURL)}
            />
          ) : null}
          <Action.Push
            title="Create Event in This Slot"
            icon={Icon.Plus}
            target={
              <CreateEventForm
                submitTitle="Create Event in Slot"
                initialValues={{
                  startDate: new Date(props.result.startDate),
                  endDate: new Date(props.result.endDate),
                }}
              />
            }
          />
        </ActionPanel>
      }
    />
  );
}

/**
 * Raycast command entry point for BusyCal availability lookup.
 */
export default function FindNextAvailableCommand() {
  const { push } = useNavigation();
  const preferences = getPreferenceValues<Preferences>();
  const [installationError, setInstallationError] = useState<string>();
  const [installation, setInstallation] = useState<BusyCalInstallation>();
  const [calendars, setCalendars] = useState<BusyCalCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let didCancel = false;

    async function loadCalendars() {
      try {
        const resolvedInstallation = await resolveBusyCalInstallation();
        const availableCalendars =
          await listBusyCalCalendars(resolvedInstallation);
        if (!didCancel) {
          setInstallation(resolvedInstallation);
          setCalendars(
            availableCalendars.filter((calendar) => calendar.supportsEvents),
          );
        }
      } catch (error) {
        if (!didCancel) {
          setInstallationError(
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        if (!didCancel) {
          setIsLoading(false);
        }
      }
    }

    void loadCalendars();
    return () => {
      didCancel = true;
    };
  }, []);

  const calendarItems = useMemo(
    () =>
      calendars.map((calendar) => (
        <Form.Dropdown.Item
          key={calendar.calendarID}
          value={calendar.calendarID}
          title={calendar.title}
        />
      )),
    [calendars],
  );

  async function handleSubmit(values: AvailabilityFormValues) {
    const activeInstallation =
      installation ?? (await resolveBusyCalInstallation());
    if (!installation) {
      setInstallation(activeInstallation);
    }

    const result = await findNextBusyCalAvailable(activeInstallation, {
      minimumDurationMinutes: Number(values.minimumDurationMinutes),
      calendarIDs: values.calendarID ? [values.calendarID] : undefined,
      respectWorkingHours: values.respectWorkingHours,
    });

    await push(
      <AvailabilityResultDetail
        installation={activeInstallation}
        result={result}
      />,
    );
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Find Next Slot"
            icon={Icon.Clock}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      {installationError ? <Form.Description text={installationError} /> : null}
      <Form.Dropdown
        id="minimumDurationMinutes"
        title="Minimum Duration"
        defaultValue={preferences.defaultMinimumAvailabilityMinutes || "30"}
      >
        <Form.Dropdown.Item value="15" title="15 minutes" />
        <Form.Dropdown.Item value="30" title="30 minutes" />
        <Form.Dropdown.Item value="45" title="45 minutes" />
        <Form.Dropdown.Item value="60" title="60 minutes" />
        <Form.Dropdown.Item value="90" title="90 minutes" />
      </Form.Dropdown>
      <Form.Dropdown id="calendarID" title="Calendar" defaultValue="">
        <Form.Dropdown.Item
          value=""
          title="BusyCal Default Availability Scope"
        />
        {calendarItems}
      </Form.Dropdown>
      <Form.Checkbox
        id="respectWorkingHours"
        label="Respect working hours"
        defaultValue={preferences.defaultRespectWorkingHours}
      />
    </Form>
  );
}
