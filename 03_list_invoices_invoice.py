import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNTS_URL = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com").rstrip("/")
API_DOMAIN   = os.getenv("ZOHO_API_DOMAIN", "https://www.zohoapis.com").rstrip("/")
CLIENT_ID    = os.getenv("ZOHO_CLIENT_ID")
CLIENT_SECRET= os.getenv("ZOHO_CLIENT_SECRET")
REFRESH_TOKEN= os.getenv("ZOHO_REFRESH_TOKEN")
ORG_ID       = os.getenv("ZOHO_ORG_ID")

def get_access_token() -> str:
    if not all([CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN]):
        raise RuntimeError("Missing env: ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN")

    url = f"{ACCOUNTS_URL}/oauth/v2/token"
    params = {
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    r = requests.post(url, params=params, timeout=30)
    data = r.json()
    if r.status_code != 200 or "access_token" not in data:
        raise RuntimeError(f"Failed to refresh token: {data}")
    return data["access_token"]

def main():
    if not ORG_ID:
        raise RuntimeError("Missing env: ZOHO_ORG_ID")

    access_token = get_access_token()

    url = f"{API_DOMAIN}/invoice/v3/invoices"
    headers = {
        "Authorization": f"Zoho-oauthtoken {access_token}",
        "X-com-zoho-invoice-organizationid": ORG_ID,  # ✅ 핵심
    }
    params = {"per_page": 5}  # organization_id는 params로 보내지 말고 헤더로

    r = requests.get(url, headers=headers, params=params, timeout=30)
    print(r.status_code)
    print(r.text)

if __name__ == "__main__":
    main()
