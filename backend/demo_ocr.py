from pathlib import Path

from ocr import extract_text


image_path = Path(__file__).resolve().parent.parent / "docs" / "sample-prescription-ocr-test.png"
lines = extract_text(str(image_path))

print("===== SYNTHETIC OCR RESULT =====")
for number, line in enumerate(lines, start=1):
    print(f"{number}: {line}")
