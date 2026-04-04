"""
bridge.py - WebSocket and HTTP Server

Serves the dashboard HTML/CSS/JS files via HTTP.
Receives data from Poller and broadcasts it to 
all connected browsers via WebSocket.
"""

import asyncio
import json
import os
import websockets
from aiohttp import web

class Bridge:
    def __init__(self, poller, config):
        self.poller = poller
        self.config = config
        self.port_ws = 8765
        self.port_http = int(os.environ.get("DASHBOARD_PORT", 3000))

    async def ws_handler(self, websocket):
        self.poller.clients.add(websocket)
        print(f"Browser connected, total: {len(self.poller.clients)}", flush=True)
        try:
            await websocket.wait_closed()
        finally:
            self.poller.clients.discard(websocket)
            print(f"Browser disconnected, total: {len(self.poller.clients)}", flush=True)
    
    async def http_handler(self, request):
        path = request.path

        if path == "/":
            path = "/index.html"
        
        filePath = "/dashboard" + path

        try:
            return web.FileResponse(filePath)
        except:
            return web.Response(status=404, text="Not found")
    
    async def config_handler(self, request):
        return web.json_response(self.config)
    
    async def start(self):
        # HTTP Server
        app = web.Application()
        app.router.add_get("/config", self.config_handler)
        app.router.add_get("/{path_info:.*}", self.http_handler)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", self.port_http)
        await site.start()
        print(f"HTTP server started on port {self.port_http}", flush=True)

        # WebSocket Server
        async with websockets.serve(self.ws_handler, "0.0.0.0", self.port_ws):
            print(f"WebSocket server started on port {self.port_ws}", flush=True)
            await asyncio.Future()
