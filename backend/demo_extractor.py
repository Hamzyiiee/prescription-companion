from extractor import extract_medicine_candidates


sample_text = """
SYNTHETIC OCR TEST DOCUMENT
TestMed Alpha 500 mg
TestMed Beta 10 mg
"""

candidates = extract_medicine_candidates(sample_text)

print("===== SYNTHETIC TEXT CANDIDATES =====")
for candidate in candidates:
    print(candidate)
