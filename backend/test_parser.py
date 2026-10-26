from parser import parse_ocr_text


test_lines = [
    "PRESCRIPTION",
    "Paracetamol 500 mg",
    "Take 1 tablet BD",
    "For 5 days",
    "Cetirizine 10 mg",
    "Take 1 tablet OD",
    "For 1 week",
    "Amoxicillin 250 mg",
    "Take 1 capsule TDS",
    "For 7 days",
    "Ondansetron 4 mg",
    "Take SOS",
    "For 2 weeks"
]


result = parse_ocr_text(test_lines)


print("===== PARSER RESULT =====")

for number, medicine in enumerate(result, start=1):
    print(f"\nMedicine {number}:")
    print(medicine)