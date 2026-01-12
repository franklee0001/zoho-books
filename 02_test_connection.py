import os
import requests
from dotenv import load_dotenv
from zoho_auth import get_access_token

load_dotenv()

def main():
    api_domain = os.getenv("ZOHO_API_DOMAIN", "https://www.zohoapis.com")
    org_id = os.getenv("ZOHO_ORG_ID")

    access_token = get_access_token()

    url = f"{api_domain}/books/v3/organizations"
    headers = {"Authorization": f"Zoho-oauthtoken {access_token}"}

    r = requests.get(url, headers=headers, timeout=30)
    print("Status:", r.status_code)
    data = r.json()
    print(data)

    # org_id가 목록에 있는지 간단 체크
    if org_id and "organizations" in data:
        found = any(str(o.get("organization_id")) == str(org_id) for o in data["organizations"])
        print("✅ ORG_ID found in API response:", found)

if __name__ == "__main__":
    main()
