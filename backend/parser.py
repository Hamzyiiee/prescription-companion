import re


STRENGTH_PATTERN = re.compile(
    r"^(.+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?))$",
    re.IGNORECASE,
)

FREQUENCY_PATTERNS = (
    (re.compile(r"\b(?:once|one)\s+daily\b|\bOD\b", re.IGNORECASE), "once daily"),
    (re.compile(r"\b(?:twice|two times)\s+daily\b|\bBD\b", re.IGNORECASE), "twice daily"),
    (re.compile(r"\b(?:three times|thrice)\s+daily\b|\bTDS\b", re.IGNORECASE), "three times daily"),
    (re.compile(r"\b(?:four times)\s+daily\b|\bQID\b", re.IGNORECASE), "four times daily"),
    (re.compile(r"\bSOS\b|\bas needed\b", re.IGNORECASE), "as needed (SOS)"),
)

DOSE_PATTERN = re.compile(
    r"\btake\s+(\d+(?:\.\d+)?\s+(?:tablets?|capsules?|pills?|teaspoons?|tablespoons?|ml|drops?))\b",
    re.IGNORECASE,
)
DURATION_PATTERN = re.compile(r"(?:for\s+)?(\d+)\s+(day|days|week|weeks)\b", re.IGNORECASE)
KNOWN_INSTRUCTIONS = (
    "before food", "before meals", "after food", "after meals",
    "with food", "with meals", "at bedtime", "with water",
)


def _new_medicine(name, strength):
    return {
        "name": name,
        "strength": strength,
        "dose": None,
        "frequency": None,
        "duration": None,
        "instructions": None,
    }


def parse_ocr_text(lines):
    """Convert OCR lines into database-aligned medicine fields.

    OCR is imperfect, so missing values remain None and every result still
    requires human review before it is saved as a prescription.
    """
    medicines = []
    current_medicine = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        medicine_match = STRENGTH_PATTERN.match(line)
        if medicine_match:
            if current_medicine:
                medicines.append(current_medicine)
            current_medicine = _new_medicine(
                medicine_match.group(1).strip(),
                medicine_match.group(2).strip(),
            )
            continue

        if current_medicine is None:
            continue

        dose_match = DOSE_PATTERN.search(line)
        if dose_match:
            current_medicine["dose"] = dose_match.group(1).strip()

        for pattern, frequency in FREQUENCY_PATTERNS:
            if pattern.search(line):
                current_medicine["frequency"] = frequency
                break

        duration_match = DURATION_PATTERN.search(line)
        if duration_match:
            current_medicine["duration"] = (
                f"{duration_match.group(1)} {duration_match.group(2).lower()}"
            )

        lower_line = line.lower()
        matched_instruction = next(
            (instruction for instruction in KNOWN_INSTRUCTIONS if instruction in lower_line),
            None,
        )
        if matched_instruction:
            current_medicine["instructions"] = matched_instruction

    if current_medicine:
        medicines.append(current_medicine)

    return medicines
