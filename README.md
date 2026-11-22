IIH Presales Hub — update v3: Client engagement management (Phase 1)
What to upload to GitHub (repository root)
site/index.html            → index.html
site/js/app.js, boot.js, leads.js, leadership.js, engage.js → js/
(engage.js is new; the other files replace existing ones. js/firebase-config.js is NOT touched.)
Order (important)
Firebase console → Firestore Database → Rules → paste firebase-setup/firestore.rules → Publish.
(Publish the rules FIRST. The new screens read collections the old rules refuse.)
Upload the files above to GitHub → Commit. Wait ~1 minute, reload the hub with Ctrl+Shift+R.
As Leadership: Client engagements → "Create client accounts from existing leads":
Download backup → Dry run → Run migration.
Access levels → give project managers the role "Presales project manager".
Rollback
Code: re-upload the previous versions of the five files (GitHub keeps them in the commit history).
Data: the migration panel's Undo button removes only the accounts it created (refused once actions/risks exist).
Rules: the previous rules are compatible with the old site; re-publish them if you roll back the code.
