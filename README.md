# IIH Presales Hub — update v3: Client engagement management (Phase 1) + product editor

## What to upload to GitHub (repository root)
- site/index.html            → index.html
- site/js/app.js, boot.js, leads.js, leadership.js, engage.js, prodedit.js → js/
(engage.js and prodedit.js are new; the other files replace existing ones. js/firebase-config.js is NOT touched.)

## Order (important)
1. Firebase console → Firestore Database → Rules → paste firebase-setup/firestore.rules → Publish.
   (Publish the rules FIRST. The new screens read collections the old rules refuse.)
2. Upload the files above to GitHub → Commit. Wait ~1 minute, reload the hub with Ctrl+Shift+R.
3. As Leadership: Client engagements → "Create client accounts from existing leads":
   Download backup → Dry run → Run migration.
4. Access levels → give project managers the role "Presales project manager".

## Rollback
- Code: re-upload the previous versions of the five files (GitHub keeps them in the commit history).
- Data: the migration panel's Undo button removes only the accounts it created (refused once actions/risks exist).
- Rules: the previous rules are compatible with the old site; re-publish them if you roll back the code.

## Product editor
Leadership: open any product → ✎ Edit product. Save makes changes live for all staff; ↶ Undo last save restores the previous version.
The public client Showcase is separate: after editing, Access levels → Download updated showcase data → replace showcase/js/products.js in GitHub.
