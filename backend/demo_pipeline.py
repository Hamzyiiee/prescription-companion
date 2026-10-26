from pathlib import Path

from ocr import extract_text
from parser import parse_ocr_text


image_path = Path(__file__).resolve().parent.parent / "docs" / "sample-prescription-ocr-test.png"
ocr_lines = extract_text(str(image_path))

print("===== SYNTHETIC OCR RESULT =====")
for number, line in enumerate(ocr_lines, start=1):
    print(f"{number}: {line}")

print("\n===== STRUCTURED SYNTHETIC MEDICINE DRAFT =====")
for medicine in parse_ocr_text(ocr_lines):
    print(medicine)
