import subprocess
import tempfile
import os
import platform

vulnerable_sql_content = """
const express = require('express');
const db = require('./db');
const app = express();
app.get('/search', async (req, res) => {
    const query = req.query.q;
    const result = await db.query('SELECT * FROM items WHERE name = ' + query);
    res.json(result);
});
"""

def test():
    temp_file = tempfile.NamedTemporaryFile(suffix=".js", delete=False, mode="w", encoding="utf-8")
    temp_file.write(vulnerable_sql_content)
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
    print("Running command:", " ".join(cmd))
    
    result = subprocess.run(cmd, capture_output=True)
    stdout = result.stdout.decode("utf-8", errors="ignore")
    stderr = result.stderr.decode("utf-8", errors="ignore")
    
    print("\n--- STDOUT ---")
    print(stdout[:1000])
    print("\n--- STDERR ---")
    print(stderr[:1000])
    
    os.unlink(temp_file.name)

if __name__ == "__main__":
    test()
