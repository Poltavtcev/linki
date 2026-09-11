# FIX-C: Campaign Email SMTP credential decryption

## Objective
Ensure the Campaign Engine (`lib/linkedin/runner.ts`) decrypts the `email_accounts` AES-GCM password before passing it to `sendEmail()` during the `email` step execution. This resolves the `535 BadCredentials` error caused by sending the raw encrypted DB string to the SMTP server.

## Requirements & Constraints
- **MUST** use existing `decryptSecret()` logic.
- **MUST NOT** change the `sendEmail()` contract, as it is shared with Settings UI endpoints that already decrypt correctly.
- **MUST NOT** log or expose plaintext passwords.
- **MUST NOT** modify runner lifecycle, scheduler, pacing, state machine semantics, InMail, or DB schema.
- **MUST** include a regression test proving the Campaign Engine passes a decrypted password to `sendEmail`.
