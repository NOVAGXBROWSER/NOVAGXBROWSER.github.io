from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime
import json
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.lock = asyncio.Lock()

    async def connect(self, username: str, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.active_connections[username] = websocket

    async def disconnect(self, username: str):
        async with self.lock:
            self.active_connections.pop(username, None)

    async def broadcast(self, message: dict):
        text = json.dumps(message)
        async with self.lock:
            websockets = list(self.active_connections.values())
        coros = [ws.send_text(text) for ws in websockets]
        if coros:
            await asyncio.gather(*coros, return_exceptions=True)

manager = ConnectionManager()

@app.get("/")
def root():
    return {"ok": True, "service": "RELINK backend"}

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(username, websocket)
    join_msg = {
        "type": "system",
        "actor": username,
        "text": f"{username} joined the chat",
        "ts": datetime.utcnow().isoformat() + "Z"
    }
    await manager.broadcast(join_msg)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except Exception:
                payload = {"type": "message", "text": data}
            if payload.get("type") == "message":
                out = {
                    "type": "message",
                    "actor": username,
                    "text": payload.get("text", ""),
                    "ts": datetime.utcnow().isoformat() + "Z"
                }
                await manager.broadcast(out)
    except WebSocketDisconnect:
        await manager.disconnect(username)
        leave_msg = {
            "type": "system",
            "actor": username,
            "text": f"{username} left the chat",
            "ts": datetime.utcnow().isoformat() + "Z"
        }
        await manager.broadcast(leave_msg)
    except Exception:
        await manager.disconnect(username)
        err_msg = {
            "type": "system",
            "actor": "server",
            "text": f"{username} disconnected (error).",
            "ts": datetime.utcnow().isoformat() + "Z"
        }
        await manager.broadcast(err_msg)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
