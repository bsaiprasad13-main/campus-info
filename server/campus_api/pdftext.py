"""Pull searchable text out of an uploaded file, and keep personal contact details out of it."""

import io
import re

MOBILE = re.compile(r"(?<![\d/])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\d/])")
ROLL_EMAIL = re.compile(r"\b[a-z]{2}\d{2}[a-z]\d{3}@(?:smail\.)?iitm\.ac\.in\b", re.I)


def extract_text(name, raw):
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if ext in ("txt", "csv", "md"):
        text = raw.decode("utf-8", "replace")
    elif ext == "pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            text = "\n".join((page.extract_text() or "") for page in reader.pages[:300])
        except Exception:      # a scanned or broken PDF: keep the file, just without search text
            text = ""
    else:
        text = ""
    return keep_private_out(text)


def keep_private_out(text):
    """A line with a mobile number or a student's roll-number email is dropped whole, name and all.
    The file itself stays as uploaded; this only decides what search can see."""
    return "\n".join(ln for ln in text.splitlines() if not MOBILE.search(ln) and not ROLL_EMAIL.search(ln)).strip()
