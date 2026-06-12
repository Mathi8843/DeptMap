import asyncio
import os
import sys
import tempfile
import shutil

# Add backend app directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services import semgrep as semgrep_service

def test_semgrep():
    print("Creating temporary vulnerable codebase...")
    temp_dir = tempfile.mkdtemp(prefix="test_vuln_code_")
    try:
        # Create a vulnerable JS file
        js_content = """
        const express = require('express');
        const app = express();
        app.get('/api/users/:id', async (req, res) => {
            const user = await db.users.find({ id: req.params.id });
            res.json(user);
        });
        """
        file_path = os.path.join(temp_dir, "app.js")
        with open(file_path, "w") as f:
            f.write(js_content)
        
        print(f"Created file: {file_path}")
        print("Running semgrep_service.run_semgrep on temp_dir...")
        
        # Run semgrep command
        raw_output = semgrep_service.run_semgrep(temp_dir)
        print("Semgrep execution succeeded!")
        print("Parsing findings...")
        findings = semgrep_service.parse_findings(raw_output, temp_dir)
        print(f"Found {len(findings)} findings:")
        for f in findings:
            print(f"  - [{f['severity']}] Rule: {f['semgrep_rule_id']} in {f['file_path']}")
        
    except Exception as e:
        print(f"\n❌ Semgrep execution failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    test_semgrep()
