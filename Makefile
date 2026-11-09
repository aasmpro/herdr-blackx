.DEFAULT_GOAL := help

PYTHON ?= python3
NODE ?= node
HERDR_APP ?= herdr-app
HERDR_HOME ?= $(if $(HERDR_APP_HOME),$(HERDR_APP_HOME),$(HOME)/.config/herdr-app)
DIST_DIR ?= dist
ARCHIVE ?= $(DIST_DIR)/blackx.tar.gz
MACHINE_A ?= blackx-incus-a
MACHINE_B ?= blackx-incus-b

.PHONY: help dependencies build check test test-python test-js check-mods verify install update sync-style release archive test-remote status

help: ## Show available targets and configuration
	@awk 'BEGIN {FS = ":.*## "; print "herdr-blackx targets:"} /^[a-zA-Z_-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf '\nOverrides: PYTHON NODE HERDR_APP HERDR_HOME DIST_DIR ARCHIVE MACHINE_A MACHINE_B\n'

dependencies: ## Install missing runtime dependencies using the system package manager
	sh src/install-dependencies.sh

build: ## Generate the native release/blackx package
	$(PYTHON) tools/build.py

check: ## Detect stale or missing generated package files (no rebuild)
	$(PYTHON) tools/build.py --check

test: test-python test-js ## Run all local Python and JavaScript tests

test-python: ## Run Python unit and file-operation tests
	$(PYTHON) -m unittest discover -s tests -v

test-js: ## Run JavaScript behavior tests (requires Node.js)
	@set -e; for test in tests/*.cjs; do printf '\nRunning %s\n' "$$test"; $(NODE) "$$test"; done

check-mods: ## Validate every generated native mod (requires Herdr)
	@set -e; for mod in release/blackx/mods/blackx-*; do $(HERDR_APP) check "$$mod"; done

verify: ## Check package freshness, all local tests, and all native mods
	$(MAKE) check
	$(MAKE) test
	$(MAKE) check-mods

install: ## Install into HERDR_HOME; refuse existing names
	$(MAKE) dependencies
	$(MAKE) build
	$(PYTHON) tools/install.py --home "$(HERDR_HOME)"

update: ## Back up and update existing blackx files in HERDR_HOME
	$(MAKE) dependencies
	$(MAKE) build
	$(PYTHON) tools/install.py --home "$(HERDR_HOME)" --update

sync-style: ## Update blackx and merge palette/font settings, with backups
	$(MAKE) dependencies
	$(MAKE) build
	$(PYTHON) tools/install.py --home "$(HERDR_HOME)" --update --sync-style-settings

release: ## Rebuild, validate, and archive the native package; does not publish
	$(MAKE) build
	$(MAKE) verify
	$(MAKE) archive

archive: check ## Create ARCHIVE from the current generated package
	@mkdir -p "$(dir $(ARCHIVE))"
	tar -czf "$(ARCHIVE)" --exclude='*.d.ts' --exclude='jsconfig.json' --exclude='.DS_Store' -C release blackx
	@printf 'Release archive: %s\n' "$(ARCHIVE)"

test-remote: ## Exercise real hc endpoints; retains remote fixtures for inspection
	$(PYTHON) tests/remote_files.py "$(MACHINE_A)" "$(MACHINE_B)"

status: ## Inspect the selected Herdr instance
	HERDR_APP_HOME="$(HERDR_HOME)" $(HERDR_APP) status
