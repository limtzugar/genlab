#!/usr/bin/env python3
"""Test which model names work with ZAI images.generations API."""
import asyncio
import sys
sys.path.insert(0, '/home/z/my-project')

async def test_models():
    from zai_sdk_async import ZAI  # placeholder - we'll use sync SDK below
    
# Use direct curl approach instead — simpler
