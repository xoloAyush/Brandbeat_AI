from config import qdrant_client

print("Qdrant connected successfully!")

print(qdrant_client.get_collections())