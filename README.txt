IIH Presales Hub v4.0.0: client accounts, engagements and governance
=====================================================================

Do these steps in this order.

1. PUBLISH THE NEW DATABASE RULES FIRST
   Firebase console > Firestore Database > Rules.
   Replace everything with NOT_FOR_GITHUB/firestore.rules and press Publish.
   The first line of the comment block must read "(v4: accounts, engagements, governance)".
   If you skip this step, the new screens show "Could not load client engagements".

2. UPLOAD THE SITE FILES
   GitHub > IIH-Projects-Management/presales-hub, at the repository ROOT (not in a folder):
     index.html            replaces the existing file
     js/app.js             replaces the existing file
     js/engage.js          replaces the existing file
     js/leads.js           replaces the existing file
     js/engage-reg.js      NEW file
     js/engage-mig.js      NEW file
   Commit. Wait about a minute, then press Ctrl+Shift+R on the site.
   Check: hover over "Your access"; the tooltip shows "Presales Hub v4.0.0".

3. DO NOT RUN THE MIGRATION UNTIL YOU DECIDE TO
   Nothing is moved automatically. Under Client engagements > Dashboard, Leadership sees
   "Move existing records to client accounts and engagements":
     1  Download backup      keep the .json file
     2  Dry run              impact assessment, saves nothing
     3  Approval tick box
     4  Run                  then the hub re-reads every record and validates it
   Leads are never written. Activity dates, texts and stage-change notes are copied
   exactly as recorded, and missing dates stay empty.
   Undo (↶) removes a batch only while nothing has been added to it.

4. ROLES (Access levels page)
   leadership = Leadership & admin    lead = Account manager
   pm = Presales project manager      presales = Technical / product team
   viewer = Read-only viewer (new)
   Existing people keep their access. Their role names change; the stored values do not.

Optional cleanup in GitHub: delete the stray "site/" folder and the root copies of
app.js, leads.js, leadership.js, pptxgen.bundle.js, pptxgenjs-LICENSE.txt and "index (1).html".
The live site loads files only from index.html and the js/ folder.
