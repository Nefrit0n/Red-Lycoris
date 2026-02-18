#!/usr/bin/env python3
import hashlib
import os
import platform
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path


def normalize_os() -> str:
    s = platform.system().lower()
    if s.startswith("linux"):
        return "linux"
    if s.startswith("darwin"):
        return "darwin"
    if s.startswith(("windows", "msys", "cygwin")):
        return "windows"
    raise SystemExit(f"unsupported os: {s}")


def normalize_arch() -> str:
    m = platform.machine().lower()
    if m in ("x86_64", "amd64"):
        return "amd64"
    if m in ("arm64", "aarch64"):
        return "arm64"
    raise SystemExit(f"unsupported arch: {m}")


def cache_dir(version: str, os_name: str, arch: str) -> Path:
    if os_name == "windows" and os.getenv("LOCALAPPDATA"):
        base = Path(os.environ["LOCALAPPDATA"]) / "red-lycoris"
    else:
        base = Path.home() / ".cache" / "red-lycoris"
    return base / "lw" / version / os_name / arch


def download(url: str, dest: Path) -> None:
    with urllib.request.urlopen(url) as resp, dest.open("wb") as out:
        shutil.copyfileobj(resp, out)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_checksum(sums_path: Path, filename: str) -> str:
    for line in sums_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[-1].lstrip("*") == filename:
            return parts[0]
    raise SystemExit(f"checksum for {filename} not found")


def extract(archive: Path, os_name: str, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    if os_name == "windows":
        with zipfile.ZipFile(archive, "r") as zf:
            zf.extractall(dst)
    else:
        with tarfile.open(archive, "r:gz") as tf:
            tf.extractall(dst)


def ensure_executable(path: Path) -> None:
    mode = path.stat().st_mode
    path.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def main() -> int:
    base_url = os.getenv("LW_BASE_URL", "https://example.com/releases/lw")
    version = os.getenv("LW_VERSION", "latest")
    os_name = normalize_os()
    arch = normalize_arch()

    ext = "zip" if os_name == "windows" else "tar.gz"
    archive_name = f"lw_{version}_{os_name}_{arch}.{ext}"
    sums_name = "sha256sums.txt"

    cdir = cache_dir(version, os_name, arch)
    binary = cdir / ("lw.exe" if os_name == "windows" else "lw")

    if not binary.exists():
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            archive_path = tmp / archive_name
            sums_path = tmp / sums_name
            download(f"{base_url}/{version}/{archive_name}", archive_path)
            download(f"{base_url}/{version}/{sums_name}", sums_path)
            expected = parse_checksum(sums_path, archive_name)
            actual = sha256(archive_path)
            if expected != actual:
                raise SystemExit("checksum mismatch")
            extract(archive_path, os_name, cdir)

    if os_name != "windows":
        ensure_executable(binary)

    proc = subprocess.run([str(binary), *sys.argv[1:]], check=False)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
