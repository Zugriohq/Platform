"""Inject the exit study into a TTI HTML build: python3 build.py <tti.html> <out.html>. The TTI build itself is not in the repository."""
import sys
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding="utf-8").read()
js = open(__file__.replace("build.py", "study.js"), encoding="utf-8").read()
assert s.count("</body>") == 1 and "</script>" not in js
open(out, "w", encoding="utf-8").write(s.replace("</body>", "<script>\n" + js + "\n</script>\n</body>"))
