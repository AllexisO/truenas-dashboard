import asyncio
import os
import yaml

from poller import Poller
from bridge import Bridge

# Reading config and environment variables
with open ("/config/config.yml", "r") as f:
    config = yaml.safe_load(f)

API_KEY = os.environ.get("TRUENAS_API_KEY", "")
TRUENAS_IP = os.environ.get("TRUENAS_IP", "")

if not API_KEY:
    print("ERROR: TRUENAS_API_KEY not set in .env")
    exit(1)

if not TRUENAS_IP:
    print("ERROR: TRUENAS_IP not set in .env")
    exit(1)

# Main func
async def main():
    poller = Poller(API_KEY, config)
    bridge = Bridge(poller, config)

    await asyncio.gather(
        poller.start(),
        bridge.start()
    )

if __name__ == "__main__":
    print("Starting TrueNAS Dashboard ...")
    asyncio.run(main())
