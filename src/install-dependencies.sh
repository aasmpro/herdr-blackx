#!/bin/sh
# Shared by the portable package and repository installer. No Python bootstrap needed.
set -eu
mode=install
endpoint=false
for arg in "$@"; do
  case "$arg" in
    --check) mode=check ;;
    --endpoint) endpoint=true ;;
    *) echo "Usage: sh install-dependencies.sh [--check] [--endpoint]" >&2; exit 2 ;;
  esac
done
platform=$(uname -s)
case "$platform" in Darwin|Linux) ;; *) echo "Automatic dependency setup supports macOS and Linux; install Python 3, Git, Poppler and native shell/Trash tools manually on $platform." >&2; exit 1 ;; esac
missing=''
need() { command -v "$1" >/dev/null 2>&1 || missing="$missing $1"; }
need python3
need git
if [ "$endpoint" = false ]; then need pdfinfo; need pdftoppm; fi
if [ "$platform" = Linux ]; then need gio; if [ "$endpoint" = false ]; then need xdg-open; fi; fi
if [ -z "$missing" ]; then echo 'blackx dependencies are ready.'; exit 0; fi
if [ "$mode" = check ]; then echo "Missing blackx dependencies:$missing" >&2; exit 1; fi
packages=''
add_package() { case " $packages " in *" $1 "*) ;; *) packages="$packages $1" ;; esac; }
if [ "$platform" = Darwin ]; then
  command -v brew >/dev/null 2>&1 || { echo 'Install Homebrew from https://brew.sh, then rerun dependency setup.' >&2; exit 1; }
  manager=brew
elif command -v apt-get >/dev/null 2>&1; then manager=apt
elif command -v dnf >/dev/null 2>&1; then manager=dnf
elif command -v pacman >/dev/null 2>&1; then manager=pacman
elif command -v zypper >/dev/null 2>&1; then manager=zypper
else echo "No supported package manager found. Install:$missing" >&2; exit 1
fi
for tool in $missing; do
  case "$tool" in
    python3) case "$manager" in brew|pacman) add_package python ;; *) add_package python3 ;; esac ;;
    git) add_package git ;;
    pdfinfo|pdftoppm) case "$manager" in brew|pacman) add_package poppler ;; zypper) add_package poppler-tools ;; *) add_package poppler-utils ;; esac ;;
    gio) case "$manager" in apt) add_package libglib2.0-bin ;; dnf|pacman) add_package glib2 ;; zypper) add_package glib2-tools ;; esac ;;
    xdg-open) add_package xdg-utils ;;
  esac
done
as_root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo "$@"; fi; }
echo "Installing missing blackx dependencies with $manager:$packages"
case "$manager" in
  brew) HOMEBREW_NO_INSTALL_CLEANUP=1 brew install $packages ;;
  apt) as_root apt-get update; as_root apt-get install -y $packages ;;
  dnf) as_root dnf install -y $packages ;;
  pacman) as_root pacman -S --needed --noconfirm $packages ;;
  zypper) as_root zypper --non-interactive install $packages ;;
esac
for tool in $missing; do command -v "$tool" >/dev/null 2>&1 || { echo "Dependency setup failed: $tool is still unavailable on PATH." >&2; exit 1; }; done
echo 'blackx dependencies are ready.'
