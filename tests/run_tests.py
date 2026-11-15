#!/usr/bin/env python3
"""
Run every test in tests/ with the standard unittest runner.

Usage:  python tests/run_tests.py
Run python run_all.py first: test_site checks the page that run_all.py built.
"""

import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent


def main():
    suite = unittest.defaultTestLoader.discover(str(HERE), pattern="test_*.py", top_level_dir=str(HERE))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
