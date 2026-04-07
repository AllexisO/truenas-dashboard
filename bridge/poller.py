"""
poller.py - TrueNAS Data Poller

Connects to TrueNAS via unix socket (/run/middleware/middlewared.sock)
and subscribes to real-time metrics (CPU, RAM, Network, Disks, Pools).
Broadcasts data to all connected WebSocket clients.
"""

import asyncio
import json
import sys
import websockets

class Poller:
    def __init__(self, api_key, config):
        self.api_key = api_key
        self.config = config
        self.latest_data = {}
        self.clients = set()

    async def connect(self):
        uri = "ws://localhost/websocket"
        async with websockets.unix_connect(
            "/run/middleware/middlewared.sock", uri=uri
        ) as ws:
            # Handshake
            await ws.send(json.dumps({
               "id": "1", "msg": "connect",
               "version": "1", "support": ["1"] 
            }))
            await ws.recv()
            print("Connected to TrueNAS", flush=True)

            # Auth
            await ws.send(json.dumps({
                "id": "2", "msg": "method",
                "method": "auth.login_with_api_key",
                "params": [self.api_key]
            }))
            response = json.loads(await ws.recv())
            if not response.get("result"):
                print("ERROR: Auth failed - check TRUENAS_API_KEY", flush=True)
                sys.exit(1)
            print("Auth OK", flush=True)

            # Subscribe to realtime
            await ws.send(json.dumps({
                "id": "3", "msg": "sub",
                "name": "reporting.realtime", "params": []
            }))
            print("Subscribed to reporting.realtime", flush=True)

            # Get initial data
            await self.fetch_static_data(ws)

            # Listen for realtime data
            async for msg in ws:
                data = json.loads(msg)
                if data.get("msg") == "added":
                    self.latest_data["realtime"] = data["fields"]
                    await self.broadcast()
                await asyncio.sleep(self.config["dashboard"]["refresh_interval"])

    async def fetch_static_data(self, ws):
        # Getting the list of HDD
        await ws.send(json.dumps({
            "id": "4", "msg": "method",
            "method": "disk.query", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["disks"] = response.get("result", [])

        # Getting pools
        await ws.send(json.dumps({
            "id": "5", "msg": "method",
            "method": "pool.query", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["pools"] = response.get("result", [])

        # Getting interfaces
        await ws.send(json.dumps({
            "id": "6", "msg": "method",
            "method": "interface.query", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["interfaces"] = response.get("result", [])

        # Getting system info
        await ws.send(json.dumps({
            "id": "7", "msg": "method",
            "method": "system.info", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["system"] = response.get("result", [])
        
        print("Static data fetched", flush=True)

    # Sending data to all connected browsers
    # If no connected browser - do nothing
    # If browser disconnected - remove from the list
    async def broadcast(self):
        if not self.clients:
            return
        
        message = json.dumps(self.latest_data)

        disconnected = set()
        for client in self.clients:
            try:
                await client.send(message)
            except:
                disconnected.add(client)

        self.clients -= disconnected
    
    # Starting Poller and reconnecting if connection dropped
    async def start(self):
        while True:
            try:
                await self.connect()
            except Exception as error:
                print(f"Connection lost: {error}, reconnecting in 5s ...", flush=True)
                await asyncio.sleep(5)