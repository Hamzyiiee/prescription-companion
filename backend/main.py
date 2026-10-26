from typing import Optional
from datetime import date
import json
import re
import os
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Base, engine, SessionLocal
import models
import ocr
from parser import parse_ocr_text

MAX_UPLOAD_SIZE = 10 * 1024 * 1024
SUPPORTED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

app = FastAPI()
Base.metadata.create_all(bind=engine)
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
app.mount('/static', StaticFiles(directory=FRONTEND_DIR), name='static')


class Medicine(BaseModel):
    name: str
    strength: Optional[str] = None
    dose: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None


class Prescription(BaseModel):
    medicines: list[Medicine]


class ScheduleRequest(BaseModel):
    medicine_id: int
    start_date: date
    end_date: date
    times: list[str]


class DoseLogRequest(BaseModel):
    medicine_id: int
    dose_date: date
    dose_time: str


def _serialize_prescription(db_prescription):
    return {
        "id": db_prescription.id,
        "medicines": [
            {
                "id": medicine.id,
                "name": medicine.name,
                "strength": medicine.strength,
                "dose": medicine.dose,
                "frequency": medicine.frequency,
                "duration": medicine.duration,
                "instructions": medicine.instructions,
            }
            for medicine in db_prescription.medicines
        ],
    }


def _save_prescription(db: Session, prescription: Prescription):
    db_prescription = models.Prescription()
    for medicine in prescription.medicines:
        db_prescription.medicines.append(
            models.Medicine(**medicine.dict())
        )
    db.add(db_prescription)
    db.commit()
    db.refresh(db_prescription)
    return _serialize_prescription(db_prescription)


@app.get("/")
def home():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.post("/prescriptions")
def create_prescription(prescription: Prescription):
    """Save medicine details supplied by the client."""
    db = SessionLocal()
    try:
        saved = _save_prescription(db, prescription)
        return {
            "message": "Prescription saved to database",
            "prescription": saved,
        }
    finally:
        db.close()


@app.post("/prescriptions/verify")
def verify_and_save_prescription(prescription: Prescription):
    """Save the user's reviewed and corrected OCR draft."""
    db = SessionLocal()
    try:
        saved = _save_prescription(db, prescription)
        return {
            "message": "Reviewed prescription saved",
            "verification_status": "verified_by_user",
            "prescription": saved,
        }
    finally:
        db.close()


@app.get("/prescriptions")
def list_prescriptions():
    """Return saved prescriptions, newest first."""
    db = SessionLocal()
    try:
        prescriptions = (
            db.query(models.Prescription)
            .order_by(models.Prescription.id.desc())
            .all()
        )
        return [_serialize_prescription(prescription) for prescription in prescriptions]
    finally:
        db.close()

@app.get("/prescriptions/{prescription_id}")
def get_prescription(prescription_id: int):
    db = SessionLocal()
    try:
        prescription = (
            db.query(models.Prescription)
            .filter(models.Prescription.id == prescription_id)
            .first()
        )
        if prescription is None:
            raise HTTPException(status_code=404, detail="Prescription not found.")
        return _serialize_prescription(prescription)
    finally:
        db.close()


@app.put("/prescriptions/{prescription_id}")
def update_prescription(prescription_id: int, prescription: Prescription):
    db = SessionLocal()
    try:
        db_prescription = (
            db.query(models.Prescription)
            .filter(models.Prescription.id == prescription_id)
            .first()
        )
        if db_prescription is None:
            raise HTTPException(status_code=404, detail="Prescription not found.")

        db_prescription.medicines.clear()
        for medicine in prescription.medicines:
            db_prescription.medicines.append(
                models.Medicine(**medicine.dict())
            )
        db.commit()
        db.refresh(db_prescription)
        return {
            "message": "Prescription updated successfully",
            "prescription": _serialize_prescription(db_prescription),
        }
    finally:
        db.close()


@app.delete("/prescriptions/{prescription_id}")
def delete_prescription(prescription_id: int):
    db = SessionLocal()
    try:
        prescription = (
            db.query(models.Prescription)
            .filter(models.Prescription.id == prescription_id)
            .first()
        )
        if prescription is None:
            raise HTTPException(status_code=404, detail="Prescription not found.")

        db.delete(prescription)
        db.commit()
        return {
            "message": "Prescription deleted successfully",
            "id": prescription_id,
        }
    finally:
        db.close()


@app.post("/upload-prescription")
async def upload_prescription(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    if content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPG, or WebP image.")

    image_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The selected image is empty.")
    if len(image_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="The image must be 10 MB or smaller.")

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=SUPPORTED_IMAGE_TYPES[content_type], delete=False) as temporary_file:
            temporary_file.write(image_bytes)
            temporary_path = temporary_file.name
        ocr_text = ocr.extract_text(temporary_path)
        medicines = parse_ocr_text(ocr_text)
    except ocr.pytesseract.pytesseract.TesseractNotFoundError as error:
        raise HTTPException(status_code=503, detail="Tesseract OCR was not found. Install it or set the TESSERACT_CMD environment variable.") from error
    except ValueError as error:
        raise HTTPException(status_code=413, detail=str(error)) from error
    except (OSError, ocr.pytesseract.pytesseract.TesseractError) as error:
        raise HTTPException(status_code=422, detail="The image could not be read. Choose a clear PNG, JPG, or WebP image.") from error
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)

    return {
        "filename": os.path.basename(file.filename or "prescription-image"),
        "content_type": content_type,
        "ocr_text": ocr_text,
        "medicines": medicines,
        "verification_required": True,
        "next_step": "Review and correct every field, then submit the edited medicines to POST /prescriptions/verify.",
        "message": "OCR draft created; the uploaded image was removed after extraction and the draft has not been saved as a prescription.",
    }

def _serialize_schedule(schedule):
    medicine = schedule.medicine
    return {
        "id": schedule.id,
        "medicine_id": medicine.id,
        "medicine": {
            "name": medicine.name,
            "strength": medicine.strength,
            "dose": medicine.dose,
            "frequency": medicine.frequency,
            "duration": medicine.duration,
            "instructions": medicine.instructions,
        },
        "start_date": schedule.start_date,
        "end_date": schedule.end_date,
        "times": json.loads(schedule.times),
    }


@app.get("/schedules")
def list_schedules():
    db = SessionLocal()
    try:
        schedules = (
            db.query(models.MedicineSchedule)
            .order_by(models.MedicineSchedule.start_date, models.MedicineSchedule.id)
            .all()
        )
        return [_serialize_schedule(schedule) for schedule in schedules]
    finally:
        db.close()


@app.post("/schedules")
def save_schedule(schedule_request: ScheduleRequest):
    if schedule_request.start_date > schedule_request.end_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date.")
    if not 1 <= len(schedule_request.times) <= 4:
        raise HTTPException(status_code=400, detail="Choose between one and four times per day.")
    if any(not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value) for value in schedule_request.times):
        raise HTTPException(status_code=400, detail="Times must use 24-hour HH:MM format.")
    if len(set(schedule_request.times)) != len(schedule_request.times):
        raise HTTPException(status_code=400, detail="Each daily time must be different.")

    db = SessionLocal()
    try:
        medicine = (
            db.query(models.Medicine)
            .filter(models.Medicine.id == schedule_request.medicine_id)
            .first()
        )
        if medicine is None:
            raise HTTPException(status_code=404, detail="Medicine not found.")
        if medicine.frequency and ("sos" in medicine.frequency.lower() or "as needed" in medicine.frequency.lower()):
            raise HTTPException(status_code=400, detail="As-needed medicines do not use fixed daily times.")

        saved_schedule = (
            db.query(models.MedicineSchedule)
            .filter(models.MedicineSchedule.medicine_id == medicine.id)
            .first()
        )
        if saved_schedule is None:
            saved_schedule = models.MedicineSchedule(medicine_id=medicine.id)
            db.add(saved_schedule)

        saved_schedule.start_date = schedule_request.start_date.isoformat()
        saved_schedule.end_date = schedule_request.end_date.isoformat()
        saved_schedule.times = json.dumps(sorted(schedule_request.times))
        db.commit()
        db.refresh(saved_schedule)
        return {
            "message": "Medication schedule saved",
            "schedule": _serialize_schedule(saved_schedule),
        }
    finally:
        db.close()



@app.get("/dose-logs")
def list_dose_logs(dose_date: date):
    db = SessionLocal()
    try:
        logs = db.query(models.DoseLog).filter(models.DoseLog.dose_date == dose_date.isoformat()).all()
        return [{"medicine_id": log.medicine_id, "dose_date": log.dose_date, "dose_time": log.dose_time} for log in logs]
    finally:
        db.close()


@app.post("/dose-logs")
def mark_dose_taken(request: DoseLogRequest):
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", request.dose_time):
        raise HTTPException(status_code=400, detail="Dose time must use 24-hour HH:MM format.")
    db = SessionLocal()
    try:
        schedule = db.query(models.MedicineSchedule).filter(models.MedicineSchedule.medicine_id == request.medicine_id).first()
        if schedule is None or not (schedule.start_date <= request.dose_date.isoformat() <= schedule.end_date) or request.dose_time not in json.loads(schedule.times):
            raise HTTPException(status_code=400, detail="That dose is not part of the medicine schedule for this date.")
        log = db.query(models.DoseLog).filter_by(medicine_id=request.medicine_id, dose_date=request.dose_date.isoformat(), dose_time=request.dose_time).first()
        if log is None:
            log = models.DoseLog(medicine_id=request.medicine_id, dose_date=request.dose_date.isoformat(), dose_time=request.dose_time)
            db.add(log)
            db.commit()
        return {"message": "Dose marked taken", "medicine_id": request.medicine_id, "dose_date": request.dose_date.isoformat(), "dose_time": request.dose_time, "taken": True}
    finally:
        db.close()


@app.delete("/dose-logs")
def undo_dose_taken(medicine_id: int, dose_date: date, dose_time: str):
    db = SessionLocal()
    try:
        log = db.query(models.DoseLog).filter_by(medicine_id=medicine_id, dose_date=dose_date.isoformat(), dose_time=dose_time).first()
        if log is not None:
            db.delete(log)
            db.commit()
        return {"message": "Dose marked not taken", "taken": False}
    finally:
        db.close()