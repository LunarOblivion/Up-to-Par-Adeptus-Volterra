"""
Every Python file in the repository must parse as Python 3.9 (no match, no X | Y annotations, ...).

ast.parse(feature_version=(3, 9)) checks grammar only. Library calls added after 3.9
(for example zip(strict=True) or Path.write_text(newline=...)) are not caught here.
"""

import ast
import unittest

from helpers import ROOT


class Python39Syntax(unittest.TestCase):
    def test_all_files_parse_as_python_39(self):
        files = [p for p in ROOT.rglob("*.py") if ".git" not in p.parts]
        self.assertGreater(len(files), 5)
        for path in files:
            with self.subTest(file=str(path.relative_to(ROOT))):
                ast.parse(path.read_text(encoding="utf-8"), filename=str(path), feature_version=(3, 9))

    def test_no_newer_library_calls(self):
        """A few post-3.9 calls that the grammar check cannot see."""
        banned = ["strict=True", "write_text(newline", "removeprefix(", "removesuffix(", "datetime.UTC",
                  "from typing import Self", "tomllib", "ExceptionGroup", "except*"]
        for path in ROOT.rglob("*.py"):
            if ".git" in path.parts or path.name == "test_py39.py":
                continue
            text = path.read_text(encoding="utf-8")
            for word in banned:
                with self.subTest(file=path.name, word=word):
                    self.assertNotIn(word, text)


if __name__ == "__main__":
    unittest.main()
