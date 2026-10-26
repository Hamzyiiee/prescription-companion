# Manual walkthrough

Use only the fictional `TestMed` sample data for this walkthrough. Do not use a real prescription to learn or test the app.

## Start the app

From the project folder in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload
```

Keep this window open. Open <http://127.0.0.1:8000> and hard-refresh with `Ctrl+F5` after code changes.

## Check the main flow

1. **Upload and crop:** Select [`sample-prescription-ocr-test.png`](sample-prescription-ocr-test.png). Drag over the medicine text, then choose **Extract medicine details**. Expected: the review section appears with an editable draft. If OCR is imperfect, correct the fields manually.
2. **Handwriting fallback:** Choose **OCR unreadable? Enter details manually** beside the OCR text. Expected: the OCR draft is replaced by one blank medicine card; cancel any current edit if prompted.
3. **Review gate:** Make sure **Save reviewed prescription** stays disabled until you check the review box.
4. **Save and reload:** Save the fictional medicine details, then refresh the browser. Expected: the prescription still appears under **Saved prescriptions**.
5. **View:** Open **View details**. Expected: the saved medicine fields are visible.
6. **Schedule:** Choose **Set or edit schedule**, use a short date range and clearly fictional clock times for the demo, and save. Expected: the schedule appears and its doses show for the selected date.
7. **Dose mark:** Click **Mark taken**, refresh the page, and check that it remains marked. Click **Undo** and confirm the mark clears.
8. **Edit:** Click **Edit details** on the fictional record. Read the confirmation (editing clears that record's schedules and dose marks), change a clearly fictional field, check the review box, and save. Expected: the changed value appears in the saved details and its old schedule is gone.
9. **Delete:** Click **Delete** for the fictional record and confirm. Expected: it disappears from the saved list and no longer appears in the schedule.

10. **Browser reminder:** Click **Enable browser reminders** and allow the browser prompt. Expected: a confirmation notification appears. For a timing check, set a fictional schedule time about two minutes ahead, keep the page open, and confirm one generic reminder appears near that time. Marking the dose taken before the due time should suppress its reminder.

## If something fails

- Read the newest error in the app and the traceback or message in the terminal.
- If the backend changed, wait for its reload message. If the browser files changed, use `Ctrl+F5`.
- Copy the exact error text here; do not include real patient or prescription information.

The app is a local learning project. “Taken” records a user's own click, and OCR output must always be checked against the fictional sample image in this walkthrough.
