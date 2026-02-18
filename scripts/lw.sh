#!/bin/sh
set -eu

BASE_URL="${LW_BASE_URL:-https://example.com/releases/lw}"
VERSION="${LW_VERSION:-latest}"

have_cmd() { command -v "$1" >/dev/null 2>&1; }

fetch() {
  url="$1"
  out="$2"
  if have_cmd curl; then
    curl -fsSL "$url" -o "$out"
  elif have_cmd wget; then
    wget -qO "$out" "$url"
  else
    echo "error: curl or wget is required" >&2
    exit 1
  fi
}

sha256_file() {
  file="$1"
  if have_cmd sha256sum; then
    sha256sum "$file" | awk '{print $1}'
  elif have_cmd shasum; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif have_cmd openssl; then
    openssl dgst -sha256 "$file" | awk '{print $2}'
  else
    echo "error: sha256sum/shasum/openssl is required" >&2
    exit 1
  fi
}

normalize_os() {
  os_raw="$(uname -s 2>/dev/null || echo unknown)"
  case "$(printf '%s' "$os_raw" | tr '[:upper:]' '[:lower:]')" in
    linux*) echo "linux" ;;
    darwin*) echo "darwin" ;;
    msys*|mingw*|cygwin*) echo "windows" ;;
    *) echo "unsupported os: $os_raw" >&2; exit 1 ;;
  esac
}

normalize_arch() {
  arch_raw="$(uname -m 2>/dev/null || echo unknown)"
  case "$arch_raw" in
    x86_64|amd64) echo "amd64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) echo "unsupported arch: $arch_raw" >&2; exit 1 ;;
  esac
}

cache_dir() {
  os="$1"
  arch="$2"
  if [ "$os" = "windows" ] && [ -n "${LOCALAPPDATA:-}" ]; then
    printf '%s\red-lycoris\lw\%s\%s\%s' "$LOCALAPPDATA" "$VERSION" "$os" "$arch"
  else
    printf '%s/.cache/red-lycoris/lw/%s/%s/%s' "${HOME:-.}" "$VERSION" "$os" "$arch"
  fi
}

extract_binary() {
  archive="$1"
  os="$2"
  dest="$3"
  mkdir -p "$dest"
  if [ "$os" = "windows" ]; then
    if have_cmd unzip; then
      unzip -oq "$archive" -d "$dest"
    else
      echo "error: unzip is required for windows archive" >&2
      exit 1
    fi
  else
    tar -xzf "$archive" -C "$dest"
  fi
}

main() {
  os="$(normalize_os)"
  arch="$(normalize_arch)"
  ext="tar.gz"
  [ "$os" = "windows" ] && ext="zip"

  archive_name="lw_${VERSION}_${os}_${arch}.${ext}"
  sums_name="sha256sums.txt"

  cdir="$(cache_dir "$os" "$arch")"
  bin="$cdir/lw"
  [ "$os" = "windows" ] && bin="$cdir/lw.exe"

  if [ ! -x "$bin" ]; then
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT INT TERM

    archive_path="$tmpdir/$archive_name"
    sums_path="$tmpdir/$sums_name"

    fetch "$BASE_URL/$VERSION/$archive_name" "$archive_path"
    fetch "$BASE_URL/$VERSION/$sums_name" "$sums_path"

    expected="$(awk -v f="$archive_name" '$2==f {print $1}' "$sums_path")"
    [ -n "$expected" ] || { echo "error: checksum for $archive_name not found" >&2; exit 1; }
    actual="$(sha256_file "$archive_path")"
    [ "$actual" = "$expected" ] || { echo "error: checksum mismatch" >&2; exit 1; }

    extract_binary "$archive_path" "$os" "$cdir"
    chmod +x "$bin" || true
  fi

  exec "$bin" "$@"
}

main "$@"
