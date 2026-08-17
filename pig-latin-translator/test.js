/* ===========================================================
   test.js — plain Node script, zero dependencies.

   Run with:  node test.js

   Exercises the pure translation/tokenizing functions exported
   from script.js (guarded so those exports are a no-op in the
   browser — see the bottom of script.js). Uses only Node's
   built-in `assert` module; no test framework.
   =========================================================== */

"use strict";

const assert = require("assert");
const {
  tokenizeInput,
  translateToken,
  getInProgressTokenIndex
} = require("./script.js");

let passed = 0;

function check(description, actual, expected) {
  assert.deepStrictEqual(actual, expected, description);
  passed++;
}

// -----------------------------------------------------------
// Core translation examples (translateToken returns
// { display, flagged }).
// -----------------------------------------------------------
const translationCases = [
  ["apple", { display: "appleway", flagged: false }],
  ["pig", { display: "igpay", flagged: false }],
  ["latin", { display: "atinlay", flagged: false }],
  ["string", { display: "ingstray", flagged: false }],
  ["yellow", { display: "ellowyay", flagged: false }],
  ["rhythm", { display: "ythmrhay", flagged: false }],
  ["xyz", { display: "yzxay", flagged: false }],
  ["brr", { display: "brray", flagged: false }],
  ["42", { display: "42", flagged: false }],
  ["Hello,", { display: "Ellohay,", flagged: false }],
  ["don't", { display: "on'tday", flagged: false }]
];

for (const [input, expected] of translationCases) {
  check(`translateToken(${JSON.stringify(input)})`, translateToken(input), expected);
}

// -----------------------------------------------------------
// Capitalization handling.
// -----------------------------------------------------------
check(
  'translateToken("HELLO") — ALL-UPPERCASE',
  translateToken("HELLO"),
  { display: "ELLOHAY", flagged: false }
);
check(
  'translateToken("Hello") — Capitalized',
  translateToken("Hello"),
  { display: "Ellohay", flagged: false }
);
check(
  'translateToken("hello") — lowercase',
  translateToken("hello"),
  { display: "ellohay", flagged: false }
);

// -----------------------------------------------------------
// Blocklist: whole-word match only, not a substring match.
// -----------------------------------------------------------
check(
  'translateToken("damn") — direct blocklist hit is flagged',
  translateToken("damn").flagged,
  true
);
check(
  'translateToken("class") — contains "ass" as a substring but must NOT be flagged',
  translateToken("class").flagged,
  false
);
check(
  'translateToken("shell") — contains "hell" as a substring but must NOT be flagged',
  translateToken("shell").flagged,
  false
);

// -----------------------------------------------------------
// In-progress / lock-in bug fix regression tests.
//
// Apostrophes/hyphens that happen to be the last character typed
// are NOT boundary characters and must not prematurely lock a
// word in. Only real terminal punctuation (comma, period, etc.)
// or trailing whitespace locks a word in.
// -----------------------------------------------------------
check(
  '"don\'" (apostrophe is the very last character typed) is still in progress',
  getInProgressTokenIndex(tokenizeInput("don'")),
  0
);
check(
  '"don\'t" with nothing typed after it yet is still in progress',
  getInProgressTokenIndex(tokenizeInput("don't")),
  0
);
check(
  '"don\'t " (trailing space) is locked in (no longer in progress)',
  getInProgressTokenIndex(tokenizeInput("don't ")),
  -1
);
check(
  '"well-" (hyphen is the very last character typed) is still in progress',
  getInProgressTokenIndex(tokenizeInput("well-")),
  0
);
check(
  '"Hello," (comma is a real terminal boundary) is locked in',
  getInProgressTokenIndex(tokenizeInput("Hello,")),
  -1
);
check(
  '"Hello" with nothing typed after it yet is still in progress',
  getInProgressTokenIndex(tokenizeInput("Hello")),
  0
);

console.log(`All ${passed} assertions passed.`);
