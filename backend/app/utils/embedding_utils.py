from fastembed import TextEmbedding

_model = None


def get_model():
    global _model

    if _model is None:
        _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

    return _model


def generate_embeddings(chunks: list[str]):
    model = get_model()
    embeddings = list(model.embed(chunks))
    return embeddings


def generate_query_embedding(query: str):
    model = get_model()
    embedding = list(model.embed([query]))
    return embedding