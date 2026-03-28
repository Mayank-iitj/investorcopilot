import asyncio
import httpx

async def test():
    async with httpx.AsyncClient(timeout=30.0) as client:
        payload = {"messages": [{"role": "user", "content": "Analyze TCS quantitative strength."}]}
        async with client.stream("POST", "http://localhost:8000/api/assistant/chat", json=payload) as response:
            print("Chat Response:", response.status_code)
            async for chunk in response.aiter_text():
                print(chunk, end="", flush=True)

asyncio.run(test())
