# Prescription Companion

A local full-stack portfolio project that turns prescription images into editable medicine records and a simple schedule.

## Tech stack

- **Backend:** Python and FastAPI
- **OCR:** Tesseract through `pytesseract`, with Pillow image processing
- **Database:** SQLite with SQLAlchemy
- **Frontend:** HTML, CSS, and browser JavaScript

## What it does

- Upload a PNG, JPG, or WebP image up to 10 MB and 60 megapixels and optionally crop the medicine area before OCR.
- Extract a printed-text draft with Tesseract OCR and show the raw text for review. Handwritten prescriptions have a manual-entry fallback because Tesseract is unreliable on handwriting.
- Edit extracted fields before saving; OCR results are never treated as confirmed automatically.
- View, edit, and delete saved prescriptions.
- Create a date range and daily clock times for a medicine, opt in to browser notifications while the page is open, then mark a planned dose taken or undo that mark.
- Save reviewed medicine details, schedules, and dose marks in a local SQLite database.

Newly uploaded images are processed by the local backend using a temporary file that is removed after extraction. Only reviewed medicine details, schedules, and dose marks are stored in SQLite. Existing files already present in local `uploads` folders are left untouched and excluded from Git by `.gitignore`.

A clearly labeled fictional OCR sample is included at [`docs/sample-prescription-ocr-test.png`](docs/sample-prescription-ocr-test.png) for the manual walkthrough.

## Requirements

- Python 3.10 or newer
- Tesseract OCR installed on your computer. The Python package is only a wrapper; the Tesseract application must also be installed.

## Run on Windows

Open a terminal in the project folder and run:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

If PowerShell blocks environment activation, call the virtual environment's Python directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Install Tesseract OCR and make sure `tesseract.exe` is on your PATH. If it is installed elsewhere, set its path before starting the app:

```powershell
$env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
```

Start the backend from the project folder:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload
```

Open <http://127.0.0.1:8000> in your browser. The interactive API reference is at <http://127.0.0.1:8000/docs>. Keep the terminal open while using the app. Press `Ctrl+C` to stop it.

The database is stored at `backend/prescriptions.db` regardless of the folder used to start the app. It is local and ignored by Git.

## How to use

1. Select an image. Optionally drag over the medicine area to crop it.
2. Choose **Extract medicine details** for printed text, or **Enter medicine details manually** for handwriting or unreadable output.
3. Compare the draft against the image and correct every field; check the review box before saving.
4. Use **View details**, **Edit details**, or **Delete** on a saved prescription.
5. Set schedule dates and clock times from the reviewed instructions.
6. Choose a date in **Planned doses for a day** and mark a dose taken if appropriate. The mark can be undone.

Editing a saved prescription replaces its medicine records and clears associated schedules and dose marks; the app warns before applying that change.

## Manual walkthrough

Follow the [manual walkthrough](docs/manual-checklist.md) to check the main flows with fictional sample data.

## Learning map

- `backend/main.py`: API routes, validation, upload handling, and database operations.
- `backend/ocr.py`: image preparation and the Tesseract OCR call.
- `backend/parser.py`: turns recognized text into medicine fields.
- `backend/extractor.py`: an earlier text-extraction experiment; the app currently uses `parser.py` for structured fields.
- `backend/models.py`: SQLite tables and relationships.
- `backend/database.py`: database connection setup.
- `frontend/index.html`: page sections and form controls.
- `frontend/app.js`: browser events and calls to the backend.
- `frontend/styles.css`: layout and visual styling.

A beginner-friendly study order:

1. Learn Python functions, dictionaries, and optional values in `backend/parser.py`.
2. Follow one request from the browser into a route in `backend/main.py`.
3. Study SQLAlchemy tables and relationships in `backend/models.py`, then see how `backend/database.py` connects them.
4. Trace the OCR path from image preparation in `backend/ocr.py` to text parsing in `backend/parser.py`.
5. Learn browser events, `fetch`, and `async` functions in `frontend/app.js`.
6. Review semantic HTML and responsive CSS in `frontend/index.html` and `frontend/styles.css`.

## Important limitations

This is a learning project, not a medical device. Handwritten prescription OCR is not reliable with Tesseract and may produce gibberish. Always compare and correct every field against the original and ask a pharmacist or clinician if anything is unclear. The app does not recommend medicines or decide doses. Browser reminders require permission and the app page to remain open; they are not guaranteed when the browser is closed. “Taken” is a self-entered record only. This local version has no user accounts, encryption, cloud backup, or production deployment; do not expose it to the public internet or use it as the only record of medical instructions.

