import json
import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel

from app.utils.embedding_utils import generate_query_embedding
from app.utils.faiss_utils import load_faiss_index, search_faiss_index
from app.utils.llm_utils import generate_rag_answer


load_dotenv()

router = APIRouter(prefix="/api", tags=["chat"])


DATA_DIR = os.getenv("DATA_DIR", "data")
FAISS_INDEX_PATH = os.getenv(
    "FAISS_INDEX_PATH",
    os.path.join(DATA_DIR, "faiss_index.index"),
)
METADATA_PATH = os.getenv(
    "METADATA_PATH",
    os.path.join(DATA_DIR, "chunk_metadata.json"),
)


# -----------------------------
# REQUEST MODELS
# -----------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    chat_history: Optional[List[ChatMessage]] = []


# -----------------------------
# INTENT DETECTION
# -----------------------------

def is_summary_question(query: str) -> bool:
    query = query.lower()
    keywords = [
        "summarize", "summary", "overview",
        "key takeaways", "main points", "important points",
        "what is this document about", "explain this document",
    ]
    return any(k in query for k in keywords)


def is_compare_question(query: str) -> bool:
    query = query.lower()
    keywords = ["compare", "comparison", "difference", "differences", "similarities"]
    return any(k in query for k in keywords)


def is_follow_up_question(query: str) -> bool:
    query = query.lower()
    keywords = [
        "second point", "first point", "third point",
        "that point", "this point",
        "explain that", "explain it",
        "make it shorter", "make it simple",
        "simplify that", "tell me more",
        "continue", "above", "previous",
    ]
    return any(k in query for k in keywords)


# -----------------------------
# HELPERS
# -----------------------------

def load_metadata():
    if not os.path.exists(METADATA_PATH):
        return None

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def filter_relevant_chunks(chunks, distances, threshold=1.5):
    return [
        (chunk, dist)
        for chunk, dist in zip(chunks, distances)
        if dist < threshold
    ]


def get_chunks_from_each_file(metadata, chunks_per_file=4):
    grouped = {}

    for chunk in metadata:
        file_name = chunk.get("file_name", "unknown")

        grouped.setdefault(file_name, [])

        if len(grouped[file_name]) < chunks_per_file:
            grouped[file_name].append(chunk)

    selected = []

    for file_chunks in grouped.values():
        selected.extend(file_chunks)

    return selected


def build_sources(chunks, distances=None):
    sources = []

    for i, chunk in enumerate(chunks):
        distance = None
        score = None

        if distances and i < len(distances):
            distance = float(distances[i])
            score = round(1 / (1 + distance), 4)

        sources.append(
            {
                "rank": i + 1,
                "file_name": chunk.get("file_name", "unknown_file"),
                "chunk_id": chunk.get("chunk_id", f"chunk_{i}"),
                "page_number": chunk.get("page_number"),
                "text_preview": chunk.get("text", "")[:300],
                "distance": distance,
                "score": score,
            }
        )

    return sources


# -----------------------------
# MAIN ROUTE
# -----------------------------

@router.post("/chat")
def chat_with_documents(request: ChatRequest):
    query = request.query.strip()
    top_k = request.top_k or 5

    chat_history = [
        {"role": msg.role, "content": msg.content}
        for msg in (request.chat_history or [])
    ]

    metadata = load_metadata()

    if not metadata or not os.path.exists(FAISS_INDEX_PATH):
        return {
            "query": query,
            "answer": "Please upload a document first.",
            "sources": [],
        }

    # -----------------------------
    # COMPARE MODE
    # -----------------------------
    if is_compare_question(query):
        chunks = get_chunks_from_each_file(metadata, 5)

        result = generate_rag_answer(
            user_query=query,
            retrieved_chunks=chunks,
            chat_history=chat_history,
        )

        return {
            "query": query,
            "answer": result["answer"],
            "sources": build_sources(chunks),
        }

    # -----------------------------
    # SUMMARY / FOLLOW-UP
    # -----------------------------
    if is_summary_question(query) or is_follow_up_question(query):
        chunks = metadata[: min(12, len(metadata))]

        result = generate_rag_answer(
            user_query=query,
            retrieved_chunks=chunks,
            chat_history=chat_history,
        )

        return {
            "query": query,
            "answer": result["answer"],
            "sources": build_sources(chunks),
        }

    # -----------------------------
    # NORMAL RAG SEARCH
    # -----------------------------
    index = load_faiss_index(FAISS_INDEX_PATH)
    query_embedding = generate_query_embedding(query)

    distances, indices = search_faiss_index(index, query_embedding, top_k)

    retrieved_chunks = []
    retrieved_distances = []

    for i, idx in enumerate(indices[0]):
        if 0 <= idx < len(metadata):
            retrieved_chunks.append(metadata[idx])
            retrieved_distances.append(distances[0][i])

    filtered = filter_relevant_chunks(
        retrieved_chunks,
        retrieved_distances,
    )

    if filtered:
        chunks = [c for c, _ in filtered]
        dists = [d for _, d in filtered]
    else:
        chunks = retrieved_chunks[:2]
        dists = retrieved_distances[:2]

    result = generate_rag_answer(
        user_query=query,
        retrieved_chunks=chunks,
        chat_history=chat_history,
    )

    return {
        "query": query,
        "answer": result["answer"],
        "sources": build_sources(chunks, dists),
    }