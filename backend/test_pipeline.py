from ocr import extract_text
from parser import parse_ocr_text


image_path = r"ocr_test_prescription_clear.jpg"


# Step 1: OCR
ocr_lines = extract_text(image_path)

print("===== OCR RESULT =====")

for number, line in enumerate(ocr_lines, start=1):
    print(f"{number}: {line}")


# Step 2: Parse OCR output
medicine = parse_ocr_text(ocr_lines)

print("\n===== STRUCTURED MEDICINE =====")
print(medicine)