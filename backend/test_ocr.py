from ocr import extract_text

image_path = r"ocr_test_prescription_clear.jpg"

text = extract_text(image_path)

print("===== OCR RESULT =====")

for number, line in enumerate(text, start=1):
    print(f"{number}: {line}")