import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def generate_embeddings(chunks: list[str]):
    embeddings = []

    for chunk in chunks:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=chunk
        )
        embeddings.append(response.data[0].embedding)

    return embeddings


def generate_query_embedding(query: str):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    return [response.data[0].embedding]