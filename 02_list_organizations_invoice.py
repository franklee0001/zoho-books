import os
import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNTS_URL = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com").rstrip("/")
CLIENT_ID = os.getenv("ZOHO_CLIENT_ID")
CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("ZOHO_REFRESH_TOKEN")
API_DOMAIN = os.getenv("ZOHO_API_DOMAIN", "https://www.zohoapis.com").rstrip("/")

def get_access_token() -> str:
    url = f"{ACCOUNTS_URL}/oauth/v2/token"
    params = {
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
    }
    r = requests.post(url, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    if "access_token" not in data:
        raise RuntimeError(f"Failed to refresh token: {data}")
    return data["access_token"]

def list_organizations(access_token: str):
    url = f"{API_DOMAIN}/invoice/v3/organizations"
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()

if __name__ == "__main__":
    token = get_access_token()
    resp = list_organizations(token)
    print(resp)

    orgs = resp.get("organizations", [])
    if not orgs:
        print("❌ organizations가 비었습니다. (보통 스코프/도메인/제품(Books vs Invoice) 불일치)")
    else:
        print("\n✅ organizations:")
        for o in orgs:
            print(f"- {o.get('name')}  | organization_id={o.get('organization_id')}")
