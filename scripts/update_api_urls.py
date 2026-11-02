import re

path_auth = r'frontend/js/auth.js'
with open(path_auth, 'r', encoding='utf-8') as f:
    auth_code = f.read()

# Replace API_BASE
auth_code = re.sub(
    r'const API_BASE = ["\']http://localhost:8000/api/v1["\'];',
    r'const API_BASE = window.__ENV__?.API_BASE_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:8000/api/v1" : "/api/v1");',
    auth_code
)
with open(path_auth, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(auth_code)
print('auth.js updated!')

path_app = r'frontend/js/app.js'
with open(path_app, 'r', encoding='utf-8') as f:
    app_code = f.read()

app_code = re.sub(
    r"API_BASE_URL: ['\"]http://localhost:8000/api/v1['\"],",
    r"API_BASE_URL: window.__ENV__?.API_BASE_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000/api/v1' : '/api/v1'),",
    app_code
)
with open(path_app, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(app_code)
print('app.js updated!')

