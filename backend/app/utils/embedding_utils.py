from sentence_transformers import SentenceTransformer

# Load model once (global)
model = SentenceTransformer("all-MiniLM-L6-v2")


def generate_embeddings(chunks: list[str]):
    """
    Generate embeddings for a list of text chunks.
    Returns: List[List[float]] → shape (N, 384)
    """
    embeddings = model.encode(chunks)
    return embeddings


def generate_query_embedding(query: str):
    """
    Generate embedding for a single query.
    Returns: List[List[float]] → shape (1, 384)
    """
    embedding = model.encode([query])  # keep it 2D for FAISS
    return embedding