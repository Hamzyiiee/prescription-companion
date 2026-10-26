import os
import shutil

from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import pytesseract

_tesseract_command = os.environ.get("TESSERACT_CMD") or shutil.which("tesseract")
_windows_tesseract = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if not _tesseract_command and os.path.isfile(_windows_tesseract):
    _tesseract_command = _windows_tesseract
if _tesseract_command:
    pytesseract.pytesseract.tesseract_cmd = _tesseract_command

def extract_text(image_path):
    # Respect the photo's orientation and process the entire image. A fixed
    # crop based on image dimensions can cut off fields in other prescriptions.
    with Image.open(image_path) as source_image:
        if source_image.width * source_image.height > 60_000_000:
            raise ValueError("The image resolution is too large to process safely.")
        image = ImageOps.exif_transpose(source_image)

    # Convert to grayscale, increase contrast, and sharpen before OCR.
    image = ImageOps.grayscale(image)
    image = ImageEnhance.Contrast(image).enhance(2)
    image = image.filter(ImageFilter.SHARPEN)

    # Enlarge small photos for Tesseract without creating extremely large images.
    width, height = image.size
    scale = min(2, 5000 / max(width, height))
    if scale != 1:
        image = image.resize((round(width * scale), round(height * scale)))

    text = pytesseract.image_to_string(image, config="--psm 6")
    return clean_ocr_text(text)


def clean_ocr_text(text):
    return [line.strip() for line in text.splitlines() if line.strip()]
