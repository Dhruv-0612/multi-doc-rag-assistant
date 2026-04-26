from sentence_transformers import SentenceTransformer
import torch

# 🔥 Force CPU (important for Render free plan)
device = "cpu"

# 🔥 Load lightweight model once globally
model = SentenceTransformer("all-MiniLM-L6-v2", device=device)


def generate_embeddings(chunks: list[str]):
    """
    Generate embeddings for a list of text chunks.
    Returns: List[List[float]]
    """
    embeddings = model.encode(
        chunks,
        batch_size=8,              # reduce memory spikes
        show_progress_bar=False,
        convert_to_numpy=True
    )
    return embeddings


def generate_query_embedding(query: str):
    """
    Generate embedding for a single query.
    Returns: List[List[float]]
    """
    embedding = model.encode(
        [query],
        convert_to_numpy=True
    )
    return embedding