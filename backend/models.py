from sqlalchemy import Column, Integer, String, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)

    medicines = relationship(
        "Medicine",
        back_populates="prescription",
        cascade="all, delete-orphan",
    )


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))

    name = Column(String)
    strength = Column(String)
    dose = Column(String)
    frequency = Column(String)
    duration = Column(String)
    instructions = Column(String)

    prescription = relationship("Prescription", back_populates="medicines")
    dose_logs = relationship(
        "DoseLog",
        back_populates="medicine",
        cascade="all, delete-orphan",
    )
    schedule = relationship(
        "MedicineSchedule",
        back_populates="medicine",
        cascade="all, delete-orphan",
        uselist=False,
    )


class MedicineSchedule(Base):
    __tablename__ = "medicine_schedules"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), unique=True, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    times = Column(Text, nullable=False)

    medicine = relationship("Medicine", back_populates="schedule")


class DoseLog(Base):
    __tablename__ = "dose_logs"
    __table_args__ = (UniqueConstraint("medicine_id", "dose_date", "dose_time"),)

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    dose_date = Column(String, nullable=False)
    dose_time = Column(String, nullable=False)

    medicine = relationship("Medicine", back_populates="dose_logs")