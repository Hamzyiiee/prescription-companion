from parser import parse_ocr_text


sample_lines = [
    "SYNTHETIC OCR TEST DOCUMENT",
    "TestMed Alpha 500 mg",
    "Take 1 tablet BD",
    "For 3 days",
    "After food",
    "TestMed Beta 10 mg",
    "Take 1 tablet OD",
    "For 5 days",
    "Before food",
]

result = parse_ocr_text(sample_lines)
print("===== SYNTHETIC PARSER RESULT =====")
for number, medicine in enumerate(result, start=1):
    print(f"\nMedicine {number}:")
    print(medicine)
