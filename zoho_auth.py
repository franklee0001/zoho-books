import os
import requests
from dotenv import load_dotenv

load_dotenv()

def get_access_token() -> str:
    accounts_url = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com")
    client_id = os.getenv("ZOHO_CLIENT_ID")
    client_secret = os.getenv("ZOHO_CLIENT_SECRET")
    refresh_token = os.getenv("ZOHO_REFRESH_TOKEN")

    if not all([client_id, client_secret, refresh_token]):
        raise RuntimeError("Missing env vars: ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN")

    token_url = f"{accounts_url}/oauth/v2/token"
    params = {
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
    }

    r = requests.post(token_url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()

    if "access_token" not in data:
        raise RuntimeError(f"Failed to refresh access token: {data}")

    return data["access_token"]
