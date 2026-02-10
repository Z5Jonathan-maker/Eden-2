import os
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def test_mongo():
    try:
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        print(f"Connecting to {mongo_url}...")
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        print("SUCCESS: MongoDB is connected!")
    except Exception as e:
        print(f"FAILURE: Could not connect to MongoDB. Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_mongo())
