import subprocess
import json
import urllib.request
import os

repo = "qxk2005/readerq"
tags_out = subprocess.check_output(["git", "tag", "--sort=-v:refname"]).decode("utf-8").splitlines()

# Get releases
req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases?per_page=100")
# We don't have a direct GITHUB_TOKEN here easily. Wait, we can use `gh auth token` if gh is logged in, or we can just ask the user for a token?
# Let's try to check if `gh` is authenticated.
