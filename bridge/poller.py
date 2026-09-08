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
        self.dirty_keys = set()
        self.clients = set()
        self.net_total_rx = 0
        self.net_total_tx = 0
        self.net_last_reset = self._today()
        self.prev_disk_stats = None
        self.prev_disk_stats_time = None

    def _today(self):
        from datetime import date
        return date.today().isoformat()

    # Updates latest_data and marks the key for the next delta broadcast
    def _set(self, key, value):
        self.latest_data[key] = value
        self.dirty_keys.add(key)

    def update_network_totals(self, rx_rate, tx_rate, interval=2):
        from datetime import date
        today = date.today().isoformat()
        
        if today != self.net_last_reset:
            self.net_total_rx = 0
            self.net_total_tx = 0
            self.net_last_reset = today
        
        self.net_total_rx += rx_rate * interval
        self.net_total_tx += tx_rate * interval

    # Reads raw per-device sector counters from /proc/diskstats, keyed by
    # device name ("sda", "nvme0n1", ...) — the same short names disk.query
    # uses, so callers can match on latest_data["disks"][i]["name"] directly.
    def read_disk_stats(self):
        stats = {}
        try:
            with open("/proc/diskstats") as file:
                for line in file:
                    parts = line.split()
                    if len(parts) < 10:
                        continue
                    stats[parts[2]] = {
                        "sectors_read": int(parts[5]),
                        "sectors_written": int(parts[9])
                    }
        except FileNotFoundError:
            pass
        return stats

    # reporting.realtime only exposes a system-wide disk "busy" %, not a
    # per-disk rate, so per-disk read/write bytes/sec is computed here from
    # two consecutive /proc/diskstats samples (512-byte sectors) — the same
    # delta-between-samples approach update_network_totals uses above.
    def update_disk_io(self):
        now = asyncio.get_event_loop().time()
        current = self.read_disk_stats()

        if self.prev_disk_stats and self.prev_disk_stats_time:
            interval = now - self.prev_disk_stats_time
            if interval > 0:
                disk_io = {}
                for device, stat in current.items():
                    previous = self.prev_disk_stats.get(device)
                    if not previous:
                        continue
                    read_delta = stat["sectors_read"] - previous["sectors_read"]
                    write_delta = stat["sectors_written"] - previous["sectors_written"]
                    disk_io[device] = {
                        "read_bytes_rate": max(0, read_delta) * 512 / interval,
                        "write_bytes_rate": max(0, write_delta) * 512 / interval
                    }
                self._set("disk_io", disk_io)

        self.prev_disk_stats = current
        self.prev_disk_stats_time = now

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
                    self._set("realtime", data["fields"])

                    interfaces = data["fields"].get("interfaces", {})
                    if interfaces:
                        iface = next(iter(interfaces.values()))
                        rx_rate = iface.get("received_bytes_rate", 0)
                        tx_rate = iface.get("sent_bytes_rate", 0)
                        self.update_network_totals(rx_rate, tx_rate)
                    self._set("net_totals", {
                        "rx": self.net_total_rx,
                        "tx": self.net_total_tx
                    })

                    self.update_disk_io()

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
        self._set("disks", response.get("result", []))

        # Getting pools
        await self.fetch_pools(ws)

        # Getting interfaces
        await ws.send(json.dumps({
            "id": "6", "msg": "method",
            "method": "interface.query", "params": []
        }))
        response = json.loads(await ws.recv())
        self._set("interfaces", response.get("result", []))

        # Getting system info
        await ws.send(json.dumps({
            "id": "7", "msg": "method",
            "method": "system.info", "params": []
        }))
        response = json.loads(await ws.recv())
        self._set("system", response.get("result", []))

        # Getting disk temperatures
        await ws.send(json.dumps({
            "id": "8", "msg": "method",
            "method": "disk.temperatures", "params": []
        }))
        response = json.loads(await ws.recv())
        self._set("disk_temps", response.get("result", {}))

        await ws.send(json.dumps({
            "id": "9", "msg": "method",
            "method": "boot.get_disks", "params": []
        }))
        response = json.loads(await ws.recv())
        self._set("boot_disks", response.get("result", []))

        # Getting disk usage via df
        result = subprocess.run(
            ["df", "-B1", "/"],
            capture_output=True, text=True
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) >= 2:
            parts = lines[1].split()
            self._set("boot_disk", {
                "total": int(parts[1]),
                "used": int(parts[2]),
                "free": int(parts[3])
            })
        
        # Getting disk graph identifiers (for /history endpoint)
        await ws.send(json.dumps({
            "id": "10", "msg": "method",
            "method": "reporting.graphs", "params": []
        }))
        response = json.loads(await ws.recv())
        graphs = response.get("result", [])

        disk_graph = next((g for g in graphs if g["name"] == "disk"), None)
        disk_identifiers = {}

        if disk_graph and disk_graph.get("identifiers"):
            for identifier in disk_graph["identifiers"]:
                disk_name = identifier.split(" | ")[0].strip()
                disk_identifiers[disk_name] = identifier
        
        self._set("disk_identifiers", disk_identifiers)

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
        self._set("pools", response.get("result", []))
    
    # Fetching Server Top 10 Processes
    async def fetch_processes(self):
        result = await asyncio.to_thread(
            subprocess.run,
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
        self._set("processes", processes)

    # Fetching Docker Containers Info
    async def fetch_docker_containers(self):
        try:
            client = docker.from_env()
            containers = client.containers.list()
            self._set("containers", [
                {
                    "id": c.short_id,
                    "name": c.name,
                    "image": c.image.tags[0] if c.image.tags else c.image.short_id,
                    "status": c.status,
                    "state": c.attrs["State"]["Status"],
                    "uptime": c.attrs["State"]["StartedAt"]
                }
                for c in containers
            ])
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
    
    # Fetching RAM Information
    async def fetch_memory_info(self):
        result = subprocess.run(
            ["dmidecode", "--type", "memory"],
            capture_output=True, text=True
        )

        # Parsed per dmidecode block (blocks are blank-line separated), not by
        # scanning "Locator:" as a boundary marker — Locator appears before
        # Type/Speed within each block, so treating it as the boundary paired
        # every module's slot with the NEXT module's size/type/speed instead
        # of its own.
        modules = []
        for block in result.stdout.split("\n\n"):
            if "Memory Device" not in block:
                continue

            module = {}
            for line in block.split("\n"):
                line = line.strip()
                if line.startswith("Size:"):
                    size = line.split(":", 1)[1].strip()
                    if size not in ("No Module Installed", "Not Installed"):
                        module["size"] = size
                elif line.startswith("Locator:"):
                    module["locator"] = line.split(":", 1)[1].strip()
                elif line.startswith("Bank Locator:"):
                    module["bank"] = line.split(":", 1)[1].strip()
                elif line.startswith("Speed:") and "Unknown" not in line:
                    module["speed"] = line.split(":", 1)[1].strip()
                elif line.startswith("Type:") and "Detail" not in line:
                    module["type"] = line.split(":", 1)[1].strip()

            if module.get("size") and module.get("locator"):
                modules.append(module)

        # dmidecode's Locator ("DIMM 0") isn't always unique across memory
        # channels on its own (some boards reuse it per-channel) — fall back
        # to "<Bank Locator> <Locator>" only for the modules that actually
        # collide, so the common case stays as the plain, familiar label.
        locator_counts = {}
        for module in modules:
            locator_counts[module["locator"]] = locator_counts.get(module["locator"], 0) + 1

        for module in modules:
            if locator_counts[module["locator"]] > 1 and module.get("bank"):
                module["slot"] = module["bank"] + " " + module["locator"]
            else:
                module["slot"] = module["locator"]
            del module["locator"]
            module.pop("bank", None)

        self._set("memory_info", modules)

    # Sending only the keys that changed since the last broadcast
    # to all connected browsers. New clients get the full snapshot
    # separately, on connect (see bridge.ws_handler).
    # If no connected browser - do nothing, keep the keys dirty.
    # If browser disconnected - remove from the list.
    async def broadcast(self):
        if not self.clients or not self.dirty_keys:
            return

        delta = {key: self.latest_data[key] for key in self.dirty_keys}
        self.dirty_keys.clear()
        message = json.dumps(delta)

        disconnected = set()
        for client in list(self.clients):
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
