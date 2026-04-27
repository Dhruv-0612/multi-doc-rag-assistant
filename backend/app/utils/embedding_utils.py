from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")


def generate_embeddings(chunks: list[str]):
    embeddings = model.encode(
        chunks,
        batch_size=4,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return embeddings


def generate_query_embedding(query: str):
    embedding = model.encode(
        [query],
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return embedding