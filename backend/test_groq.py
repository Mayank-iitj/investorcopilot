import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Test Health
        r = await client.get("http://localhost:8000/api/health")
        print("Health:", r.status_code, r.text)
        
        # Test Chat Endpoint
        payload = {"messages": [{"role": "user", "content": "What are the rules of your decision engine?"}]}
        async with client.stream("POST", "http://localhost:8000/api/assistant/chat", json=payload) as response:
            print("Chat Response:", response.status_code)
            async for chunk in response.aiter_text():
                print(chunk, end="", flush=True)

asyncio.run(test())
