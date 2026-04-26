import faiss
import numpy as np


def create_faiss_index(embeddings):
    """
    Create FAISS index from embeddings.
    """
    embeddings_array = np.array(embeddings).astype("float32")

    if len(embeddings_array.shape) != 2:
        raise ValueError("Embeddings must be a 2D array.")

    dimension = embeddings_array.shape[1]

    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings_array)

    return index


def save_faiss_index(index, file_path: str):
    """
    Save FAISS index to disk.
    """
    faiss.write_index(index, file_path)


def load_faiss_index(file_path: str):
    """
    Load FAISS index from disk.
    """
    return faiss.read_index(file_path)


def search_faiss_index(index, query_embedding, top_k: int = 3):
    """
    Search FAISS index using query embedding.
    """
    query_array = np.array(query_embedding).astype("float32")

    # 🔴 IMPORTANT FIX: Ensure query is 2D (FAISS expects shape [1, dim])
    if len(query_array.shape) == 1:
        query_array = np.expand_dims(query_array, axis=0)

    distances, indices = index.search(query_array, top_k)

    return distances, indices