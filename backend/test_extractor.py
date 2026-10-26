from extractor import extract_medicine_candidates


sample_text = """
Doctor Name
Paracetamol 500 mg
Amoxicillin 500 mg
Hospital Name
"""

candidates = extract_medicine_candidates(sample_text)

print("===== MEDICINE CANDIDATES =====")

for candidate in candidates:
    print(candidate)