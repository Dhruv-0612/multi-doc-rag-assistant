from fastapi import APIRouter
import json
import os

from app.utils.embedding_utils import generate_query_embedding
from app.utils.faiss_utils import load_faiss_index, search_faiss_index

router = APIRouter(prefix="/api", tags=["search"])

DATA_DIR = "data"
FAISS_INDEX_PATH = os.path.join(DATA_DIR, "faiss_index.index")
METADATA_PATH = os.path.join(DATA_DIR, "chunk_metadata.json")


@router.get("/search")
def search_documents(query: str, top_k: int = 3):
    if not os.path.exists(FAISS_INDEX_PATH) or not os.path.exists(METADATA_PATH):
        return {
            "message": "No indexed documents found. Please upload a PDF first."
        }

    index = load_faiss_index(FAISS_INDEX_PATH)

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        chunk_metadata = json.load(f)

    query_embedding = generate_query_embedding(query)
    distances, indices = search_faiss_index(index, query_embedding, top_k)

    results = []
    for idx in indices[0]:
        if 0 <= idx < len(chunk_metadata):
            results.append(chunk_metadata[idx])

    return {
        "query": query,
        "top_k": top_k,
        "results": results
    }