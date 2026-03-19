import {
  Action,
  ActionPanel,
  Form,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { createBusyCalEvent, listBusyCalCalendars } from "./busycal-automation";
import { buildBusyCalEventInput } from "./busycal-form-submission";
import { resolveBusyCalInstallation } from "./busycal-installation";
import { BusyCalCalendar, EventFormValues } from "./types";

interface CreateEventFormProps {
  initialValues?: Partial<EventFormValues>;
  submitTitle?: string;
}

/**
 * Structured event form shared by the main command and the availability flow.
 */
export function CreateEventForm(props: CreateEventFormProps) {
  const [installationError, setInstallationError] = useState<string>();
  const [calendars, setCalendars] = useState<BusyCalCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    () => props.initialValues?.startDate ?? new Date(),
  );
  const [endDate, setEndDate] = useState(
    () =>
      props.initialValues?.endDate ??
      new Date(startDate.getTime() + 60 * 60 * 1000),
  );
  const [allDay, setAllDay] = useState(props.initialValues?.allDay ?? false);

  useEffect(() => {
    let didCancel = false;

    async function loadCalendars() {
      try {
        const installation = await resolveBusyCalInstallation();
        const availableCalendars = await listBusyCalCalendars(installation);
        if (!didCancel) {
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

  async function handleSubmit(values: EventFormValues) {
    const installation = await resolveBusyCalInstallation();
    const input = buildBusyCalEventInput(values);

    await createBusyCalEvent(installation, input);

    await showToast({
      style: Toast.Style.Success,
      title: "BusyCal event created",
      message: input.title,
    });
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={props.submitTitle ?? "Create Event"}
            icon={Icon.Calendar}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      {installationError ? <Form.Description text={installationError} /> : null}
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Team sync"
        defaultValue={props.initialValues?.title}
      />
      <Form.Dropdown
        id="calendarID"
        title="Calendar"
        defaultValue={props.initialValues?.calendarID ?? ""}
      >
        <Form.Dropdown.Item value="" title="BusyCal Default Calendar" />
        {calendarItems}
      </Form.Dropdown>
      <Form.DatePicker
        id="startDate"
        title="Starts"
        value={startDate}
        onChange={setStartDate}
      />
      <Form.DatePicker
        id="endDate"
        title="Ends"
        value={endDate}
        onChange={setEndDate}
      />
      <Form.Checkbox
        id="allDay"
        label="All-day event"
        value={allDay}
        onChange={setAllDay}
      />
      <Form.TextField
        id="location"
        title="Location"
        placeholder="Apple Park"
        defaultValue={props.initialValues?.location}
      />
      <Form.TextArea
        id="notes"
        title="Notes"
        placeholder="Optional notes"
        defaultValue={props.initialValues?.notes}
      />
    </Form>
  );
}

/**
 * Raycast command entry point for structured BusyCal event creation.
 */
export default function CreateEventCommand() {
  return <CreateEventForm />;
}
