import os
for k, v in os.environ.items():
    if "pass" in k.lower() or "secret" in k.lower() or "key" in k.lower() or "db" in k.lower():
        print(f"{k}: {v[:10]}...")
