import { BusyCalInstallation } from "./types";
import { execProcessText } from "./shell";

const recordSeparator = String.fromCharCode(30);
const fieldSeparator = String.fromCharCode(31);

/**
 * Executes one BusyCal AppleScript block with a small retry loop for startup races.
 */
export async function runBusyCalScript(
  _installation: BusyCalInstallation,
  body: string,
): Promise<string> {
  const script = `${commonSerializationHandlers}\n${body}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await execProcessText({
        command: "osascript",
        args: ["-"],
        stdin: script,
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("BusyCal is still starting")) {
        throw error;
      }
      await delay(750 * (attempt + 1));
    }
  }

  throw lastError;
}

/**
 * Converts the serialized record-list string into a stable JS object array.
 */
export function parseSerializedRecords(
  rawText: string,
): Array<Record<string, string>> {
  if (!rawText.trim()) {
    return [];
  }

  return rawText
    .split(recordSeparator)
    .filter(Boolean)
    .map((rawRecord) => {
      const record: Record<string, string> = {};

      for (const rawField of rawRecord.split(fieldSeparator)) {
        const separatorIndex = rawField.indexOf("=");
        if (separatorIndex <= 0) {
          continue;
        }

        const fieldName = rawField.slice(0, separatorIndex);
        const fieldValue = rawField.slice(separatorIndex + 1);
        record[fieldName] = decodeSerializedValue(fieldValue);
      }

      return record;
    });
}

/**
 * Builds one AppleScript `given` clause string from optional key/value pairs.
 */
export function buildGivenClause(
  parameters: Array<string | undefined>,
): string {
  return parameters.filter(Boolean).join(", ");
}

/**
 * Returns one AppleScript string literal.
 */
export function appleScriptString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/**
 * Returns one AppleScript comma-separated string parameter.
 */
export function appleScriptCSV(values: string[]): string | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return appleScriptString(values.join(","));
}

function decodeSerializedValue(rawValue: string): string {
  return rawValue
    .replaceAll("\\u001F", fieldSeparator)
    .replaceAll("\\u001E", recordSeparator)
    .replaceAll("\\n", "\n")
    .replaceAll("\\\\", "\\");
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

const commonSerializationHandlers = String.raw`
use framework "Foundation"

property sharedISO8601Formatter : missing value

on replaceText(findText, replaceText, sourceText)
  set previousDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to findText
  set textItems to every text item of sourceText
  set AppleScript's text item delimiters to replaceText
  set replacedText to textItems as text
  set AppleScript's text item delimiters to previousDelimiters
  return replacedText
end replaceText

on encodeValue(rawValue)
  if rawValue is missing value then
    return ""
  end if

  set textValue to rawValue as text
  set textValue to my replaceText("\\", "\\\\", textValue)
  set textValue to my replaceText((character id 31), "\\u001F", textValue)
  set textValue to my replaceText((character id 30), "\\u001E", textValue)
  set textValue to my replaceText(linefeed, "\\n", textValue)
  return textValue
end encodeValue

on encodeDateValue(rawValue)
  if rawValue is missing value then
    return ""
  end if

  if sharedISO8601Formatter is missing value then
    set sharedISO8601Formatter to current application's NSDateFormatter's alloc()'s init()
    sharedISO8601Formatter's setLocale:(current application's NSLocale's localeWithLocaleIdentifier:"en_US_POSIX")
    sharedISO8601Formatter's setTimeZone:(current application's NSTimeZone's timeZoneForSecondsFromGMT:0)
    sharedISO8601Formatter's setDateFormat:"yyyy-MM-dd'T'HH:mm:ssXXXXX"
  end if

  return (sharedISO8601Formatter's stringFromDate:rawValue) as text
end encodeDateValue

on emitField(fieldName, fieldValue)
  return fieldName & "=" & my encodeValue(fieldValue)
end emitField

on emitDateField(fieldName, fieldValue)
  return fieldName & "=" & my encodeDateValue(fieldValue)
end emitDateField

on emitBooleanField(fieldName, fieldValue)
  if fieldValue is missing value then
    return fieldName & "="
  end if

  if fieldValue is true then
    return fieldName & "=true"
  end if

  return fieldName & "=false"
end emitBooleanField

on emitFields(fieldList)
  set previousDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to (character id 31)
  set serializedText to fieldList as text
  set AppleScript's text item delimiters to previousDelimiters
  return serializedText
end emitFields

on emitRecords(recordList)
  set previousDelimiters to AppleScript's text item delimiters
  set AppleScript's text item delimiters to (character id 30)
  set serializedText to recordList as text
  set AppleScript's text item delimiters to previousDelimiters
  return serializedText
end emitRecords
`;
