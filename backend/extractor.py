def extract_medicine_candidates(text):
    lines = text.splitlines()

    candidates = []

    for line in lines:
        line = line.strip()

        if not line:
            continue

        candidates.append({
            "raw_text": line,
            "confidence": "low"
        })

    return candidates