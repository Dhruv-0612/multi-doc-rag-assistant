import json
import os
import shutil
import uuid
from typing import List

import numpy as np
from dotenv import load_dotenv
from fastapi import APIRouter, File, UploadFile

from app.utils.embedding_utils import generate_embeddings
from app.utils.faiss_utils import create_faiss_index, save_faiss_index
from app.utils.pdf_utils import chunk_text, extract_text_from_pdf


load_dotenv()

router = APIRouter(prefix="/api", tags=["upload"])


UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
DATA_DIR = os.getenv("DATA_DIR", "data")

FAISS_INDEX_PATH = os.getenv(
    "FAISS_INDEX_PATH",
    os.path.join(DATA_DIR, "faiss_index.index"),
)
METADATA_PATH = os.getenv(
    "METADATA_PATH",
    os.path.join(DATA_DIR, "chunk_metadata.json"),
)


def ensure_storage_directories() -> None:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)


def clear_uploads() -> None:
    if not os.path.exists(UPLOAD_DIR):
        return

    for file_name in os.listdir(UPLOAD_DIR):
        file_path = os.path.join(UPLOAD_DIR, file_name)

        if os.path.isfile(file_path):
            os.remove(file_path)


def clear_vector_data() -> None:
    for path in [FAISS_INDEX_PATH, METADATA_PATH]:
        if os.path.exists(path):
            os.remove(path)


def reset_knowledge_base() -> None:
    ensure_storage_directories()
    clear_uploads()
    clear_vector_data()


def is_pdf(file: UploadFile) -> bool:
    return bool(file.filename and file.filename.lower().endswith(".pdf"))


def build_error_response(message: str, error_type: str, filename: str | None = None):
    response = {
        "success": False,
        "message": message,
        "error_type": error_type,
        "files": [],
    }

    if filename:
        response["filename"] = filename

    return response


@router.post("/upload-multiple")
async def upload_multiple_documents(files: List[UploadFile] = File(...)):
    reset_knowledge_base()

    if not files:
        return build_error_response(
            message="Please upload at least one PDF file.",
            error_type="NO_FILES",
        )

    all_chunks = []
    chunk_metadata = []
    uploaded_files = []

    for file in files:
        if not is_pdf(file):
            reset_knowledge_base()
            return build_error_response(
                message="Only PDF files are allowed.",
                error_type="INVALID_FILE_TYPE",
                filename=file.filename,
            )

        original_filename = os.path.basename(file.filename)
        file_id = str(uuid.uuid4())[:8]
        stored_filename = f"{file_id}_{original_filename}"
        file_path = os.path.join(UPLOAD_DIR, stored_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        extracted_text = extract_text_from_pdf(file_path)

        if not extracted_text or not extracted_text.strip():
            reset_knowledge_base()
            return build_error_response(
                message=(
                    f"{original_filename} appears to be scanned or image-based. "
                    "Please upload text-based PDFs for now."
                ),
                error_type="SCANNED_OR_IMAGE_PDF",
                filename=original_filename,
            )

        chunks = chunk_text(extracted_text)

        if not chunks:
            reset_knowledge_base()
            return build_error_response(
                message=f"Could not create readable chunks from {original_filename}.",
                error_type="CHUNKING_FAILED",
                filename=original_filename,
            )

        uploaded_files.append(
            {
                "id": file_id,
                "name": original_filename,
                "stored_file_name": stored_filename,
                "chunks": len(chunks),
            }
        )

        for chunk in chunks:
            chunk_id = f"chunk_{len(chunk_metadata)}"

            all_chunks.append(chunk)

            chunk_metadata.append(
                {
                    "chunk_id": chunk_id,
                    "file_id": file_id,
                    "file_name": original_filename,
                    "stored_file_name": stored_filename,
                    "text": chunk,
                }
            )

    embeddings = generate_embeddings(all_chunks)
    embeddings = np.array(embeddings).astype("float32")

    index = create_faiss_index(embeddings)
    save_faiss_index(index, FAISS_INDEX_PATH)

    with open(METADATA_PATH, "w", encoding="utf-8") as file:
        json.dump(chunk_metadata, file, ensure_ascii=False, indent=2)

    return {
        "success": True,
        "message": "Files processed successfully.",
        "files": uploaded_files,
        "total_files": len(uploaded_files),
        "total_chunks": len(chunk_metadata),
        "faiss_index_size": index.ntotal,
    }


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    return await upload_multiple_documents([file])