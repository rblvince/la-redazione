# Architecture

## Data model

PostgreSQL stores profiles, application settings, topics, votes, comments, activity events, verification and legal checks, sources, corrections, and invitations. A topic moves through proposal, verification, legal review, publication, or parking. It records its proposer, writer, reviewer, decision round, activity timestamps, and publication details. Writers and reviewers must be different people. Sources can include an optional private storage path; corrections are append-only records.

## Roles

- **Maintainer** manages members, roles, invitations, and decision settings. The maintainer is omitted from editorial people lists and does not vote.
- **Decider** has member capabilities and can vote on topics.
- **Member** can propose and work on topics but cannot vote.

Only a maintainer can change roles, membership activity, or the decision rule. Decisions use unanimity by default, with a configurable majority option.

## Invitation and sign-in

There is no public sign-up. An authorized inviter creates a single-use invitation for an email and role. The invitation expires after seven days and can be revoked. The database stores a SHA-256 hash of the random invitation token. The recipient confirms the invited email with a one-time passcode (OTP) of eight digits; after authentication, the invitation is redeemed once and creates the profile. Existing invited members sign in with an email OTP.

## Row-level security and writes

RLS is enabled on every application table. Active members can read editorial data; profile visibility is restricted, invitation reads are limited to management roles, and the invitation token hash is not selectable by clients. The `people` view omits maintainers. Clients have read grants only. Mutations go through narrowly scoped PostgreSQL functions that enforce role, assignment, decision, and publication rules. Default privileges are revoked for public, anonymous, and authenticated roles; required grants are explicit.

## Security choices

The browser uses only the public Supabase key and the signed-in user's session. The service-role key stays in server-only code. Invitations store token hashes rather than bearer tokens. OTP verification is bound to the invitation email. User-supplied links are restricted to HTTPS and link previews are fetched server-side with validation. SQL calls use parameterized Supabase APIs; database functions use a fixed search path. Security headers include a restrictive Content Security Policy, frame denial, MIME sniffing protection, and a strict referrer policy for invitation and auth callback routes.
