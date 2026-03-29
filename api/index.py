"""
Vercel serverless function entry point for FastAPI backend
"""
import sys
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from server import app

# Export the FastAPI app for Vercel
handler = app
