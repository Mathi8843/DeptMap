import subprocess
import tempfile
import os
import json

eval_content = """
const express = require('express');
const app = express();
app.get('/run', (req, res) => {
    const code = req.query.code;
    eval(code);
    res.send("OK");
});
"""

def test():
    temp_file = tempfile.NamedTemporaryFile(suffix=".js", delete=False, mode="w", encoding="utf-8")
    temp_file.write(eval_content)
    temp_file.close()
    
    target_dir = temp_file.name
    semgrep_args = [
        "scan",
        "--config", "auto",
        "--json",
        "--no-git-ignore",
        "--timeout", "60",
    ]
    
    # WSL Path mapping
    wsl_path = target_dir.replace("\\", "/")
    if len(wsl_path) >= 2 and wsl_path[1] == ":":
        drive = wsl_path[0].lower()
        wsl_path = f"/mnt/{drive}{wsl_path[2:]}"
        
    cmd = ["wsl", "semgrep"] + semgrep_args + [wsl_path]
    result = subprocess.run(cmd, capture_output=True)
    stdout = result.stdout.decode("utf-8", errors="ignore")
    
    try:
        data = json.loads(stdout)
        results = data.get("results", [])
        print(f"Found {len(results)} findings:")
        for r in results:
            print(f"  Rule: {r.get('check_id')}")
    except Exception as e:
        print("Failed to parse json:", e)
        print(stdout[:500])
        
    os.unlink(temp_file.name)

if __name__ == "__main__":
    test()
