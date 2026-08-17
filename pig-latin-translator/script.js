/* ===========================================================
   Pig Latin Translator
   Plain, dependency-free JavaScript. No build step, no libraries.

   SECURITY NOTE: All DOM content derived from user input in this
   file is built exclusively with textContent / createTextNode /
   createElement / classList / setAttribute. innerHTML and
   insertAdjacentHTML are never used anywhere in this file, so
   user-typed markup (e.g. "<img src=x onerror=...>") can never be
   parsed as HTML — it is always rendered as inert text.
   =========================================================== */

(function () {
  "use strict";

  // ---------------------------------------------------------
  // Foul-language blocklist
  //
  // This is a small, hardcoded, curated list for a LIGHTHEARTED
  // DEMO ONLY. It is NOT a real moderation system. Known
  // limitations:
  //   - No leetspeak / obfuscation handling (e.g. "sh1t", "f*ck")
  //   - No stemming or plural/inflection handling
  //   - Single tier (flagged or not) — no severity levels
  //   - Small, incomplete word list
  //   - English-only
  //   - Whole-word match only (matched against the word after
  //     stripping leading/trailing punctuation), so it will not
  //     catch words hidden as arbitrary substrings, and it will
  //     not false-positive on innocent words that merely contain
  //     a blocked word as a substring.
  // ---------------------------------------------------------
  const BLOCKLIST = new Set([
    "damn", "hell", "crap", "ass", "bitch", "bastard", "bloody",
    "shit", "fuck", "piss", "dick", "douche", "twat", "wanker",
    "bugger", "arse", "slut", "whore"
  ]);

  const VOWELS = new Set(["a", "e", "i", "o", "u"]);
  const LETTER_RE = /[a-z]/i;

  // ---------------------------------------------------------
  // Tokenizer: splits input into alternating whitespace / non-
  // whitespace runs, preserving every character exactly.
  // ---------------------------------------------------------
  function tokenizeInput(input) {
    if (input === "") return [];
    const matches = input.match(/\S+|\s+/g) || [];
    return matches.map((t) => ({ text: t, isSpace: /^\s/.test(t) }));
  }

  // ---------------------------------------------------------
  // Splits a non-whitespace token into leading punctuation /
  // core word / trailing punctuation, based on the position of
  // the first and last ASCII letters in the token. Interior
  // characters (including apostrophes) stay inside the core
  // untouched.
  // ---------------------------------------------------------
  function analyzeWordToken(tokenText) {
    let firstLetterIdx = -1;
    let lastLetterIdx = -1;
    for (let i = 0; i < tokenText.length; i++) {
      if (LETTER_RE.test(tokenText[i])) {
        if (firstLetterIdx === -1) firstLetterIdx = i;
        lastLetterIdx = i;
      }
    }
    if (firstLetterIdx === -1) {
      return { hasLetters: false, leading: "", core: "", trailing: "" };
    }
    return {
      hasLetters: true,
      leading: tokenText.slice(0, firstLetterIdx),
      core: tokenText.slice(firstLetterIdx, lastLetterIdx + 1),
      trailing: tokenText.slice(lastLetterIdx + 1)
    };
  }

  // ---------------------------------------------------------
  // Core Pig Latin algorithm, operating on a lowercased core
  // word (interior non-letter characters, e.g. apostrophes,
  // pass through untouched and act as non-vowel/non-splitting
  // characters).
  // ---------------------------------------------------------
  function translateCoreLower(lowerCore) {
    const first = lowerCore[0];

    if (VOWELS.has(first)) {
      return lowerCore + "way";
    }

    const n = lowerCore.length;
    let splitIdx = n; // default: no vowel-equivalent found anywhere -> whole word is the cluster

    for (let i = 1; i < n; i++) {
      const ch = lowerCore[i];
      if (LETTER_RE.test(ch)) {
        if (VOWELS.has(ch) || ch === "y") {
          // true vowel, or non-initial 'y' acting as a vowel
          splitIdx = i;
          break;
        }
        // else: consonant letter, keep extending the cluster
      }
      // else: non-letter interior character (e.g. apostrophe) —
      // treated as a non-vowel, non-splitting character; the
      // cluster keeps extending through it.
    }

    const cluster = lowerCore.slice(0, splitIdx);
    const remainder = lowerCore.slice(splitIdx);
    return remainder + cluster + "ay";
  }

  // ---------------------------------------------------------
  // Determines the casing category of the ORIGINAL core word,
  // based only on its cased letters (interior punctuation /
  // digits are ignored for this check).
  //
  // Note: for a single-letter word (e.g. "I"), the ALL-UPPERCASE
  // and first-letter-capitalized conditions are both technically
  // satisfied. ALL-UPPERCASE is checked first and wins in that
  // case (see report for rationale).
  // ---------------------------------------------------------
  function getCaseCategory(coreOriginal) {
    const lettersOnly = coreOriginal.replace(/[^a-zA-Z]/g, "");
    if (lettersOnly.length === 0) return "lower";

    if (lettersOnly === lettersOnly.toUpperCase()) {
      return "upper";
    }
    if (
      lettersOnly[0] === lettersOnly[0].toUpperCase() &&
      lettersOnly.slice(1) === lettersOnly.slice(1).toLowerCase()
    ) {
      return "capitalized";
    }
    return "lower";
  }

  function applyCase(translatedLower, category) {
    if (category === "upper") return translatedLower.toUpperCase();
    if (category === "capitalized") {
      return translatedLower.charAt(0).toUpperCase() + translatedLower.slice(1);
    }
    return translatedLower;
  }

  // ---------------------------------------------------------
  // Translates a single non-whitespace token end-to-end:
  // strip leading/trailing punctuation, translate the core,
  // recase, reattach punctuation. Tokens with no alphabetic
  // characters pass through completely untranslated.
  // ---------------------------------------------------------
  function translateToken(tokenText) {
    const analysis = analyzeWordToken(tokenText);

    if (!analysis.hasLetters) {
      return { display: tokenText, flagged: false };
    }

    const lowerCore = analysis.core.toLowerCase();
    const translatedLower = translateCoreLower(lowerCore);
    const category = getCaseCategory(analysis.core);
    const recased = applyCase(translatedLower, category);
    const display = analysis.leading + recased + analysis.trailing;

    const flagged = BLOCKLIST.has(lowerCore);

    return { display, flagged };
  }

  // A trailing run consisting *only* of apostrophes and/or hyphens is
  // not treated as a lock-in boundary: those characters are commonly
  // interior to a word still being typed (e.g. "don'" -> "don't",
  // "well-" -> "well-off"), so on their own they must not cause the
  // word to be considered "finished". Only an actual terminal
  // punctuation character (., ! , ? ; : etc. — anything other than
  // ' or -) counts as a real boundary for lock-in purposes.
  const NON_BOUNDARY_TRAILING_RE = /[^'-]/;

  // ---------------------------------------------------------
  // Determines which token index (if any) in the token array
  // is the "in progress" (currently being typed) token.
  // ---------------------------------------------------------
  function getInProgressTokenIndex(tokens) {
    if (tokens.length === 0) return -1;

    const last = tokens[tokens.length - 1];
    if (last.isSpace) return -1; // input ends in whitespace -> everything is locked

    const analysis = analyzeWordToken(last.text);
    if (
      analysis.hasLetters &&
      analysis.trailing !== "" &&
      NON_BOUNDARY_TRAILING_RE.test(analysis.trailing)
    ) {
      // last token's trailing run contains at least one real terminal
      // punctuation character (not just apostrophes/hyphens) -> the
      // word has been closed off by an actual boundary -> already locked
      return -1;
    }

    // Either the last token ends right at a letter (nothing typed
    // after it yet), has no letters at all (e.g. a number still being
    // typed), or its trailing run so far is made up entirely of
    // apostrophes/hyphens (not a real boundary, e.g. "don'" while the
    // user is still typing "don't") — in all these cases it's still
    // in progress.
    return tokens.length - 1;
  }

  // ---------------------------------------------------------
  // Builds the full list of render descriptors for the current
  // input value.
  // ---------------------------------------------------------
  function buildDescriptors(input) {
    const tokens = tokenizeInput(input);
    const inProgressTokenIdx = getInProgressTokenIndex(tokens);

    const descriptors = [];
    let wordIndex = 0;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.isSpace) {
        descriptors.push({ isSpace: true, text: tok.text });
        continue;
      }

      const isInProgress = i === inProgressTokenIdx;
      const { display, flagged } = translateToken(tok.text);

      descriptors.push({
        isSpace: false,
        wordIndex,
        display,
        flagged,
        isInProgress
      });
      wordIndex++;
    }

    return descriptors;
  }

  // ---------------------------------------------------------
  // Rendering + per-word diff/animation state
  //
  // This whole block is guarded on `document` existing so that this
  // file can also be safely `require()`-d from a plain Node script
  // (see test.js) to exercise the pure functions above without a
  // DOM. `document` is always defined in a real browser, so this has
  // no effect on the shipped app.
  // ---------------------------------------------------------
  if (typeof document !== "undefined") {
  const textarea = document.getElementById("input");
  const output = document.getElementById("output");
  const banner = document.getElementById("banner");

  // Maps wordIndex -> { text, wasInProgress } from the previous render.
  // NOTE (known limitation): this map is keyed by positional word
  // index, not a stable/content-derived id. This is fine for the
  // primary use case (typing forward / appending), but if a user
  // edits a word earlier in the text (inserting/deleting a whole
  // word), every downstream word's index shifts and already-settled
  // words can spuriously re-play the materialize animation even
  // though their own content didn't change. Left as-is; a
  // content-based key would need a real diff/reconciliation strategy
  // to handle duplicate words correctly, which is out of scope here.
  let prevWordState = new Map();

  function render() {
    const input = textarea.value;
    const descriptors = buildDescriptors(input);

    // Clear previous output safely (no innerHTML).
    while (output.firstChild) {
      output.removeChild(output.firstChild);
    }

    let anyFlagged = false;
    const newWordState = new Map();

    for (const d of descriptors) {
      if (d.isSpace) {
        // Preserve original whitespace/line breaks exactly.
        output.appendChild(document.createTextNode(d.text));
        continue;
      }

      const wordSpan = document.createElement("span");
      wordSpan.className = "word";

      const textSpan = document.createElement("span");
      textSpan.className = "word-text";
      textSpan.textContent = d.display; // safe: textContent, never innerHTML

      if (d.flagged) {
        anyFlagged = true;
        textSpan.classList.add("flagged");
        wordSpan.setAttribute(
          "title",
          "Flagged for demo purposes — translation not blocked."
        );

        const icon = document.createElement("span");
        icon.className = "flag-icon";
        icon.textContent = "⚠"; // static glyph, not user-derived
        icon.setAttribute("aria-hidden", "true");
        wordSpan.appendChild(textSpan);
        wordSpan.appendChild(icon);
      } else {
        wordSpan.appendChild(textSpan);
      }

      const prev = prevWordState.get(d.wordIndex);
      const shouldAnimate =
        !d.isInProgress &&
        (!prev || prev.text !== d.display || prev.wasInProgress);

      if (shouldAnimate) {
        // Fresh element each render, so simply adding the class is
        // enough to play the animation on insertion — no reflow
        // trick is needed here.
        wordSpan.classList.add("materialize");
      }

      newWordState.set(d.wordIndex, {
        text: d.display,
        wasInProgress: d.isInProgress
      });

      output.appendChild(wordSpan);
    }

    prevWordState = newWordState;
    banner.hidden = !anyFlagged;
  }

  textarea.addEventListener("input", render);

  // Initial render (handles empty state cleanly).
  render();
  } // end of `if (typeof document !== "undefined")` DOM-wiring block

  // ---------------------------------------------------------
  // Expose the pure functions for automated testing from Node
  // (see test.js). This branch only runs when `module` exists
  // (i.e. under CommonJS/Node), which is never the case for a
  // plain <script> tag in a browser, so it has no effect on the
  // shipped app's behavior.
  // ---------------------------------------------------------
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      tokenizeInput,
      analyzeWordToken,
      translateCoreLower,
      getCaseCategory,
      applyCase,
      translateToken,
      getInProgressTokenIndex,
      buildDescriptors
    };
  }
})();
