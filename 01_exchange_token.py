import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNTS_URL = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com").rstrip("/")
CLIENT_ID = os.getenv("ZOHO_CLIENT_ID")
CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET")
REDIRECT_URI = os.getenv("ZOHO_REDIRECT_URI", "http://www.zoho.com/books")
GRANT_TOKEN = os.getenv("ZOHO_GRANT_TOKEN")

missing = [k for k, v in {
    "ZOHO_CLIENT_ID": CLIENT_ID,
    "ZOHO_CLIENT_SECRET": CLIENT_SECRET,
    "ZOHO_REDIRECT_URI": REDIRECT_URI,
    "ZOHO_GRANT_TOKEN": GRANT_TOKEN
}.items() if not v]

if missing:
    raise SystemExit(f"Missing in .env: {', '.join(missing)}")

token_url = f"{ACCOUNTS_URL}/oauth/v2/token"

data = {
    "code": GRANT_TOKEN,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": REDIRECT_URI,
    "grant_type": "authorization_code",
}

resp = requests.post(token_url, data=data, timeout=30)

print("Status:", resp.status_code)
try:
    payload = resp.json()
except Exception:
    print(resp.text)
    raise

if "access_token" in payload:
    print("\n✅ SUCCESS")
    print("expires_in:", payload.get("expires_in"))
else:
    print("\n❌ FAILED")
    print("error:", payload.get("error"))
    print("error_description:", payload.get("error_description"))
