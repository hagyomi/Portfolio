"""Package static files, prefixing local URLs for GitHub project Pages."""
import argparse
import re
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--base-path', default='')
args = parser.parse_args()
base = '/' + args.base_path.strip('/') if args.base_path.strip('/') else ''
root = Path(__file__).resolve().parent.parent
output = root / '_site'
output.mkdir(exist_ok=True)
directories = ('assets', 'dist', 'favicon', 'atlason', 'more', 'pagination', 'works')
files = [*root.glob('*.html'), *root.glob('portfolio-*.css'),
         *root.glob('portfolio-*.js'), root / 'portfolio-projects.json']
for name in directories:
    shutil.copytree(root / name, output / name, dirs_exist_ok=True)
for source in files:
    shutil.copy2(source, output / source.name)
# Only rewrite quoted root URLs and CSS url() values, leaving protocols intact.
pattern = re.compile(r'''(["'`]|url\(\s*)/(?!/)(?=[A-Za-z0-9_#?]|["'`])''')
if base:
    for file in output.rglob('*'):
        if file.suffix in ('.html', '.css', '.js', '.json'):
            text = file.read_text(encoding='utf-8')
            file.write_text(pattern.sub(lambda m: m[1] + base + '/', text), encoding='utf-8')
(output / '.nojekyll').touch()
print(f'GitHub Pages files: {output} (base: {base or "/"})')
