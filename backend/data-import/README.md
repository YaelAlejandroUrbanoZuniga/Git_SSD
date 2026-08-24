# `data-import/` — handling the confidential GSM spreadsheets

This folder holds the import scripts. It must **never** hold the spreadsheets they read.

For what the importers actually *do* — the three stages, dedup rules, commodity mapping,
stage resolution, the history backfill — see **§7 of [`backend/README.md`](../README.md)**.
This file covers only one thing: how the `.xlsx` are handled around a run.

---

## The lifecycle: place → import → delete

The 5 source spreadsheets (`Master_Requirements_List_for_Supplier_Scouting`,
`Scouting_Event_-_B2B_Meetings`, `Supplier_Parking`,
`Preliminary_Evaluation_of_Suppliers_for_Development`, `BlackList_Suppliers`) contain real,
confidential supplier data. They are **not part of the repository** and never will be.

Every import follows the same three steps:

1. **Place.** Copy the `.xlsx` that Itzel delivered into `backend/data-import/source/` on the
   server, by hand. Create the folder if it isn't there — it is not tracked, so a fresh
   clone won't have it. Do this only when an import is actually due.
2. **Import.** Run the stages from `backend/` (see §7 for the flags and ordering):
   ```bash
   npm run import:parse
   IMPORT_REAL_DATA=true npm run import:suppliers
   IMPORT_REAL_DATA=true npm run import:rest
   ```
3. **Delete.** Remove the `.xlsx` from disk immediately after the run finishes. They must
   never sit on the server between one import and the next — not "until next time", not
   "just in case". `output/` is derived from them and is gitignored too; clear it as well
   once the logs and reports it holds have been read.

**Never `git add` them**, not even temporarily, and never with `-f`. `backend/.gitignore`
ignores `data-import/source/` and `data-import/output/` precisely so that step 1 cannot
turn into a commit by accident.

## Why this is strict

In August 2026 the 5 spreadsheets did reach a commit on `dev`. Getting them out was not a
matter of deleting them in a follow-up commit — git keeps every blob a commit ever
referenced, so the files stayed recoverable by anyone with a clone. The fix was rewriting
the entire branch history with `git filter-repo` and force-pushing the result to **both**
remotes (GitHub and Azure DevOps), which invalidates every clone and every commit SHA on
`dev`. That is the cost of one `git add`, and it is why the rule is "never", not "clean it
up afterwards".

## The automated guard

`.gitignore` alone is one careless edit away from being undone, and nobody would notice
until the next spreadsheet was already committed. So [`source-guard.ts`](source-guard.ts)
re-verifies it at runtime: before **any** `.xlsx` is read, `parse.ts` and `import-rest.ts`
ask `git check-ignore` whether that exact path is ignored, and abort with an explanatory
error if it isn't.

It catches both realistic mistakes:

- `data-import/source/` was removed from or narrowed in `backend/.gitignore`;
- the file is **already tracked** (someone ran `git add`), which `git check-ignore` reports
  as not-ignored.

It never interferes with a correct run: files that are properly ignored pass straight
through. If the import runs somewhere that isn't a git work tree at all — no repository,
so nothing to leak into — the guard logs a one-line warning and continues rather than
blocking the import.

If it does fire, **fix the ignore rule, don't bypass the guard.** For an already-tracked
file, untrack it before committing anything:

```bash
git rm --cached backend/data-import/source/<file>.xlsx
```

If it was already committed, deleting it now is not enough — the history has to be
rewritten on both remotes, as described above.
