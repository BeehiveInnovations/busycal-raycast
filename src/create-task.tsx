import {
  Action,
  ActionPanel,
  Form,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { createBusyCalTask, listBusyCalCalendars } from "./busycal-automation";
import { buildBusyCalTaskInput } from "./busycal-form-submission";
import { resolveBusyCalInstallation } from "./busycal-installation";
import { BusyCalCalendar, TaskFormValues } from "./types";

/**
 * Raycast command entry point for structured BusyCal task creation.
 */
export default function CreateTaskCommand() {
  const [installationError, setInstallationError] = useState<string>();
  const [calendars, setCalendars] = useState<BusyCalCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasDueDate, setHasDueDate] = useState(true);
  const [dueDate, setDueDate] = useState(new Date());

  useEffect(() => {
    let didCancel = false;

    async function loadCalendars() {
      try {
        const installation = await resolveBusyCalInstallation();
        const availableCalendars = await listBusyCalCalendars(installation);
        if (!didCancel) {
          setCalendars(
            availableCalendars.filter((calendar) => calendar.supportsTasks),
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

  async function handleSubmit(values: TaskFormValues) {
    const installation = await resolveBusyCalInstallation();
    const input = buildBusyCalTaskInput(values);

    await createBusyCalTask(installation, input);

    await showToast({
      style: Toast.Style.Success,
      title: "BusyCal task created",
      message: input.title,
    });
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Task"
            icon={Icon.Checklist}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      {installationError ? <Form.Description text={installationError} /> : null}
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Finish expense report"
      />
      <Form.Dropdown id="calendarID" title="Task List" defaultValue="">
        <Form.Dropdown.Item value="" title="BusyCal Default Task Calendar" />
        {calendarItems}
      </Form.Dropdown>
      <Form.Checkbox
        id="hasDueDate"
        label="Set due date"
        value={hasDueDate}
        onChange={setHasDueDate}
      />
      <Form.DatePicker
        id="dueDate"
        title="Due"
        value={dueDate}
        onChange={setDueDate}
      />
      <Form.TextArea id="notes" title="Notes" placeholder="Optional notes" />
    </Form>
  );
}
