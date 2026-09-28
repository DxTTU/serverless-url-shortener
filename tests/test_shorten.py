import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

# boto3 needs a region at import time; no real AWS calls are made in these tests.
os.environ.setdefault("AWS_DEFAULT_REGION", "ap-south-1")

from shorten import _generate_code, _is_valid_url, CODE_LENGTH  # noqa: E402


class TestUrlValidation(unittest.TestCase):
    def test_valid_urls(self):
        self.assertTrue(_is_valid_url("https://example.com"))
        self.assertTrue(_is_valid_url("http://example.com/a/b?c=d"))

    def test_invalid_urls(self):
        self.assertFalse(_is_valid_url(""))
        self.assertFalse(_is_valid_url("not a url"))
        self.assertFalse(_is_valid_url("ftp://example.com"))
        self.assertFalse(_is_valid_url("example.com"))


class TestCodeGeneration(unittest.TestCase):
    def test_length(self):
        for _ in range(100):
            self.assertEqual(len(_generate_code()), CODE_LENGTH)

    def test_charset(self):
        allowed = set(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        )
        for _ in range(100):
            self.assertTrue(set(_generate_code()) <= allowed)

    def test_uniqueness(self):
        codes = {_generate_code() for _ in range(1000)}
        self.assertGreater(len(codes), 990)  # collisions ~astronomically unlikely


if __name__ == "__main__":
    unittest.main()
