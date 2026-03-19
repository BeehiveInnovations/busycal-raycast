import assert from "node:assert/strict";
import test from "node:test";
import { isUnsupportedOpenItemCommandError } from "../src/busycal-open-item-support";

test("isUnsupportedOpenItemCommandError recognizes unsupported open-item failures", () => {
  assert.equal(
    isUnsupportedOpenItemCommandError(
      "BusyCal got an error: doesn’t understand the open item message.",
    ),
    true,
  );
  assert.equal(
    isUnsupportedOpenItemCommandError(
      "Expected end of line but found identifier.",
    ),
    true,
  );
});

test("isUnsupportedOpenItemCommandError ignores unrelated AppleScript failures", () => {
  assert.equal(
    isUnsupportedOpenItemCommandError("Item was not found: abc123"),
    false,
  );
  assert.equal(
    isUnsupportedOpenItemCommandError("BusyCal is still starting. Please try again in a moment."),
    false,
  );
});
