---
title: Language-Agnostic Withdraw Refactoring
---

## 1. Context and Problem
`lib/linkedin/withdraw.ts` parses the sent invitations list to withdraw old invitations.
It currently relies on `document.querySelectorAll("[aria-label^='Withdraw']... ")` with hardcoded translations (English, Ukrainian, Russian). 
If the user's LinkedIn is in Polish or Spanish, the script finds 0 invitations and crashes or exits silently.

## 2. Evidence
Dumping the DOM of `https://www.linkedin.com/mynetwork/invitation-manager/sent/` reveals:
- The "Withdraw" button is an `<a>` tag or `<button>`.
- Its `aria-label` ALWAYS contains the target person's name (e.g., `Withdraw invitation sent to Ewa Poltavtsev`).
- The button is typically the last actionable element in the card that does not contain an image or an `/in/` profile link.
- Time text requires multi-language regex or robust digit parsing.

## 3. Implementation Plan
We will refactor the `page.evaluate` injection in `withdrawOldInvitations`:
1. **Card selection:** Select all `li` or `div` containers that have an `a[href*="/in/"]`.
2. **Name extraction:** Extract the person's name from `span[dir="ltr"]` or `aria-hidden="true"` spans.
3. **Withdraw Button detection:** Find all action buttons/links in the card, exclude profile links, and find the one whose `aria-label` contains the person's first name.
4. **Time Parsing:** Expand the regex to catch basic Latin/Cyrillic root words for day/week/month/year.
5. **Confirmation Modal:** Use purely structural selectors `.artdeco-modal button.artdeco-button--primary` to click confirm, regardless of its text.

## 4. Verification
Run a test script locally and verify it successfully finds the buttons and extracts the ages.
