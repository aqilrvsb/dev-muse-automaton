#!/usr/bin/env python3
"""
Script to replace all localStorage.getItem('auth_token') with Supabase session token
"""

import os
import re

# Files to process
JS_DIR = "frontend/assets/js"
files_to_fix = [
    "billings.js",
    "chatbot-ai.js",
    "device-settings.js",
    "flow-builder.js",
    "flow-manager.js",
    "packages.js",
    "profile.js",
    "set-stage.js",
    "whatsapp-bot.js"
]

def fix_file(filepath):
    """Fix localStorage auth_token usage in a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Pattern 1: const token = localStorage.getItem('auth_token');
    #            if (!token) { window.location.href = '/'; return; }
    pattern1 = r"const token = localStorage\.getItem\('auth_token'\);\s+if \(!token\) \{\s+window\.location\.href = '/';\s+return;\s+\}"

    replacement1 = """// Get Supabase session token
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
        window.location.href = '/index.html';
        return;
    }
    const token = session.access_token;"""

    content = re.sub(pattern1, replacement1, content)

    # Pattern 2: Just const token = localStorage.getItem('auth_token');
    # Replace with getting session token
    pattern2 = r"const token = localStorage\.getItem\('auth_token'\);"
    replacement2 = """const { data: { session } } = await window.supabase.auth.getSession();
    const token = session?.access_token;"""

    content = re.sub(pattern2, replacement2, content)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Fixed {filepath}")
        return True
    else:
        print(f"- No changes needed in {filepath}")
        return False

def main():
    fixed_count = 0
    for filename in files_to_fix:
        filepath = os.path.join(JS_DIR, filename)
        if os.path.exists(filepath):
            if fix_file(filepath):
                fixed_count += 1
        else:
            print(f"✗ File not found: {filepath}")

    print(f"\nFixed {fixed_count} files")

if __name__ == "__main__":
    main()
