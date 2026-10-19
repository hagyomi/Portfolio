"""Run with: python serve.py (Ctrl+C to stop)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import functools
import argparse
import threading
import webbrowser

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Serve the local portfolio.')
    parser.add_argument('--open', action='store_true', help='Open the local site in a browser.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(root))
    server = ThreadingHTTPServer(('127.0.0.1', 4173), handler)
    print('Local: http://127.0.0.1:4173', flush=True)
    if args.open:
        threading.Timer(0.3, lambda: webbrowser.open('http://127.0.0.1:4173')).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
