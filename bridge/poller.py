"""
poller.py - TrueNAS Data Poller

Connects to TrueNAS via unix socket (/run/middleware/middlewared.sock)
and subscribes to real-time metrics (CPU, RAM, Network, Disks, Pools).
Broadcasts data to all connected WebSocket clients.
"""

import asyncio
import json
import subprocess
import sys
import docker
import websockets

uri = "ws://localhost/websocket"

class Poller:
    def __init__(self, api_key, config):
        self.api_key = api_key
        self.config = config
        self.latest_data = {}
        self.clients = set()

    # Connection to TrueNAS with Websocket
    async def connect(self):
        async with websockets.unix_connect(
            "/run/middleware/middlewared.sock", uri=uri, open_timeout=10
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

            # Get initial data
            await self.fetch_static_data(ws)

            # Subscribe to realtime
            await ws.send(json.dumps({
                "id": "3", "msg": "sub",
                "name": "reporting.realtime", "params": []
            }))
            print("Subscribed to reporting.realtime", flush=True)

            # Listen for realtime data
            last_static_update = 0
            async for msg in ws:
                data = json.loads(msg)
                if data.get("msg") == "added":
                    self.latest_data["realtime"] = data["fields"]
                    await self.broadcast()

                now = asyncio.get_event_loop().time()
                if now - last_static_update > 15:
                    await self.fetch_pools(ws)
                    last_static_update = now
                    await self.broadcast()

    # Fetching Static Data
    async def fetch_static_data(self, ws):
        # Getting the list of HDD
        await ws.send(json.dumps({
            "id": "4", "msg": "method",
            "method": "disk.query", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["disks"] = response.get("result", [])

        # Getting pools
        await self.fetch_pools(ws)

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

        # Getting disk temperatures
        await ws.send(json.dumps({
            "id": "8", "msg": "method",
            "method": "disk.temperatures", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["disk_temps"] = response.get("result", {})

        await ws.send(json.dumps({
            "id": "9", "msg": "method",
            "method": "boot.get_disks", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["boot_disks"] = response.get("result", [])

        # Getting disk usage via df
        result = subprocess.run(
            ['df', '-B1', '/'],
            capture_output=True, text=True
        )
        lines = result.stdout.strip().split('\n')
        if len(lines) >= 2:
            parts = lines[1].split()
            self.latest_data["boot_disk"] = {
                "total": int(parts[1]),
                "used": int(parts[2]),
                "free": int(parts[3])
            }

        # Getting TOP processes
        await self.fetch_processes()

        # Getting Docker images
        await self.fetch_docker_containers()

        # Getting RAM information
        await self.fetch_memory_info()
        
        print("Static data fetched", flush=True)

    # Fetching HDD Pools
    async def fetch_pools(self, ws):
        await ws.send(json.dumps({
            "id": "5", "msg": "method",
            "method": "pool.query", "params": []
        }))
        response = json.loads(await ws.recv())
        self.latest_data["pools"] = response.get("result", [])
    
    # Fetching Server Top 10 Processes
    async def fetch_processes(self):
        result = subprocess.run(
            ['ps', 'aux', '--sort=-%cpu'],
            capture_output=True, text=True
        )
        lines = result.stdout.strip().split('\n')
        processes = []
        for line in lines[1:11]: # top 10, skip header
            parts = line.split(None, 10)
            if len(parts) >= 11:
                processes.append({
                    'user': parts[0],
                    'pid': parts[1],
                    'cpu': parts[2],
                    'mem': parts[3],
                    'command': parts[10][:50]
                })
                self.latest_data['processes'] = processes

    # Fetching Docker Containers Info
    async def fetch_docker_containers(self):
        try:
            client = docker.from_env()
            containers = client.containers.list()
            self.latest_data["containers"] = [
                {
                    "id": c.short_id,
                    "name": c.name,
                    "image": c.image.tags[0] if c.image.tags else c.image.short_id,
                    "status": c.status,
                    "state": c.attrs["State"]["Status"],
                    "uptime": c.attrs["State"]["StartedAt"]
                }
                for c in containers
            ]
        except Exception as error:
            print(f"Docker error: {error}", flush=True)
    
    # Fetching History Data For Graphic
    async def fetch_history(self, graph, start, end, identifier=None):
        async with websockets.unix_connect(
            "/run/middleware/middlewared.sock", uri=uri
        ) as ws:
            # Handshake
            await ws.send(json.dumps({
                "id": "1", "msg": "connect",
                "version": "1", "support": ["1"]
            }))
            await ws.recv()

            # Auth
            await ws.send(json.dumps({
                "id": "2", "msg": "method",
                "method": "auth.login_with_api_key",
                "params": [self.api_key]
            }))
            await ws.recv()

            # Fetch History
            await ws.send(json.dumps({
                "id": "3", "msg": "method",
                "method": "reporting.netdata_get_data",
                "params": [[{"name": graph, **({"identifier": identifier} if identifier else {})}], {"start": start, "end": end}]
            }))

            response = json.loads(await ws.recv())
            return response.get("result", [])
    
    # Fetching RAM Inforamtion
    async def fetch_memory_info(self):
        result = subprocess.run(
            ["dmidecode", "--type", "memory"],
            capture_output=True, text=True
        )

        modules = []
        current = {}

        for line in result.stdout.split("\n"):
            line = line.strip()
            if "Size:" in line and "No Module" not in line and "None" not in line:
                size = line.split(":")[1].strip()
                if size != "No Module Installed":
                    current["size"] = size
            elif "Speed:" in line and "Unknown" not in line and "Configured" not in line:
                current["speed"] = line.split(":")[1].strip()
            elif "Type:" in line and "Detail" not in line and "Error" not in line:
                current["type"] = line.split(":")[1].strip()
            elif "Locator:" in line and "Bank" not in line:
                if current.get("size"):
                    modules.append(current.copy())
                current = {"slot" : line.split(":")[1].strip()}
        
        if current.get('size') and current.get('slot'):
            modules.append(current.copy())
        
        self.latest_data['memory_info'] = [
            m for m in modules 
            if m.get('size') and m.get('size') != 'No Module Installed' and m.get('slot')
        ]

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
                await asyncio.gather(
                    self.connect(),
                    self.update_processes_loop()
                )
            except Exception as error:
                print(f"Connection lost: {error}, reconnecting in 5s ...", flush=True)
                await asyncio.sleep(5)
    
    async def update_processes_loop(self):
        while True:
            await self.fetch_processes()
            await asyncio.sleep(10)
