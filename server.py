#!/usr/bin/env python3
# ============================================================
#  DAKBoard 로컬 서버 (정적 파일 + 수동 업데이트 엔드포인트)
#  - 일반 파일 서빙 (python -m http.server 와 동일)
#  - POST /api/update : git pull 실행 → {"updated": true/false}
#    설정창의 새로고침 버튼이 이 엔드포인트를 호출합니다.
#  실행: python3 server.py [포트]   (기본 8000)
# ============================================================
import http.server, socketserver, subprocess, os, json, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
APPDIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=APPDIR, **k)

    def end_headers(self):
        # version.json/캐시 무효화
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        try:
            n = int(self.headers.get('Content-Length', 0))
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return {}

    def do_POST(self):
        path = self.path.rstrip('/')
        if path == '/api/update':
            updated = False; log = ''
            try:
                subprocess.run(['git', 'fetch', '--quiet', 'origin'], cwd=APPDIR, timeout=60)
                local = subprocess.check_output(['git', 'rev-parse', '@'], cwd=APPDIR).strip()
                remote = subprocess.check_output(['git', 'rev-parse', '@{u}'], cwd=APPDIR).strip()
                if local != remote:
                    r = subprocess.run(['git', 'pull', '--ff-only'], cwd=APPDIR,
                                       capture_output=True, text=True, timeout=120)
                    log = (r.stdout + r.stderr)[-500:]
                    updated = (r.returncode == 0)
                else:
                    log = 'already up to date'
            except Exception as e:
                log = 'error: ' + str(e)
            self._json({'updated': updated, 'log': log})

        elif path == '/api/screen':
            # {"act":"on"|"off"}  → 화면 즉시 켜기/끄기
            act = (self._read_body().get('act') or 'on')
            act = 'off' if act == 'off' else 'on'
            try:
                subprocess.run(['bash', os.path.join(APPDIR, 'screen.sh'), act], timeout=20)
                self._json({'ok': True, 'act': act})
            except Exception as e:
                self._json({'ok': False, 'error': str(e)})

        elif path == '/api/schedule':
            # {"enabled":bool, "on":"07:00", "off":"23:00"}  → cron 등록/해제
            b = self._read_body()
            try:
                if b.get('enabled'):
                    subprocess.run(['bash', os.path.join(APPDIR, 'schedule.sh'),
                                    str(b.get('on', '07:00')), str(b.get('off', '23:00'))], timeout=20)
                else:
                    subprocess.run(['bash', os.path.join(APPDIR, 'schedule.sh'), 'off'], timeout=20)
                self._json({'ok': True})
            except Exception as e:
                self._json({'ok': False, 'error': str(e)})

        else:
            self.send_response(404); self.end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
        print('DAKBoard server on :%d (dir=%s)' % (PORT, APPDIR))
        httpd.serve_forever()
