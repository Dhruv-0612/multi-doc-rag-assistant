import fitz


def extract_text_from_pdf(file_path: str) -> str:
    try:
        text = ""
        doc = fitz.open(file_path)

        for page in doc:
            text += page.get_text()

        if not text.strip():
            return ""

        return text

    except Exception:
        return ""


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - overlap

    return chunks