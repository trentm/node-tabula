
JSSTYLE_FILES := $(shell find lib test -name "*.js")
NODEOPT ?= $(HOME)/opt
JSFILES := bin/jirash $(shell find lib -name '*.js')

TAPE = ./node_modules/.bin/tape
ESLINT = ./node_modules/.bin/eslint
PRETTIER = ./node_modules/.bin/prettier
JSON ?= json


all $(ESLINT) $(PRETTIER) $(TAPE):
	npm install

.PHONY: distclean
distclean:
	rm -rf node_modules


.PHONY: test
test: | $(TAPE)
	$(TAPE) test/*.test.js

.PHONY: testall
testall: test10 test08 test11
.PHONY: test11
test11:
	@echo "# Test node 0.11.x (with node `$(NODEOPT)/node-0.11/bin/node --version`)"
	@$(NODEOPT)/node-0.11/bin/node --version
	PATH="$(NODEOPT)/node-0.11/bin:$(PATH)" make test
.PHONY: test10
test10:
	@echo "# Test node 0.10.x (with node `$(NODEOPT)/node-0.10/bin/node --version`)"
	@$(NODEOPT)/node-0.10/bin/node --version
	PATH="$(NODEOPT)/node-0.10/bin:$(PATH)" make test
.PHONY: test08
test08:
	@echo "# Test node 0.8.x (with node `$(NODEOPT)/node-0.8/bin/node --version`)"
	@$(NODEOPT)/node-0.8/bin/node --version
	PATH="$(NODEOPT)/node-0.8/bin:$(PATH)" make test


.PHONY: check-eslint
check-eslint: | $(ESLINT)
	$(ESLINT) $(JSFILES)

.PHONY: check-prettier
check-prettier: | $(PRETTIER)
	@echo "# Checking formatting. Re-run 'make fmt' if this fails."
	$(PRETTIER) --list-different $(JSFILES)

# Ensure CHANGES.md and package.json have the same version after a
# "## not yet released" section intended for unreleased changes.
.PHONY: check-version
check-version:
	@echo version is: $(shell cat package.json | $(JSON) version)
	[ `cat package.json | $(JSON) version` \
	    = `grep '^## ' CHANGES.md | head -2 | tail -1 | awk '{print $$2}'` ]

.PHONY: check
check:: check-version check-eslint check-prettier
	@echo "Check ok."


# Prettier formatting before eslint, because otherwise `make fmt` will stop on
# a line >80 chars that prettier could otherwise have fixed.
.PHONY: fmt
fmt:: fmt-prettier fmt-eslint

.PHONY: fmt-eslint
fmt-eslint: | $(ESLINT)
	$(ESLINT) --fix $(JSFILES)

.PHONY: fmt-prettier
fmt-prettier: | $(PRETTIER)
	$(PRETTIER) --write $(JSFILES)


# Confirm, then tag and publish the current version.
.PHONY: cutarelease
cutarelease: check
	[ -z "`git status --short`" ]  # If this fails, the working dir is dirty.
	@ver=$(shell $(JSON) -f package.json version) && \
	    name=$(shell $(JSON) -f package.json name) && \
	    publishedVer=$(shell npm view -j $(shell $(JSON) -f package.json name)@$(shell $(JSON) -f package.json version) version 2>/dev/null) && \
	    if [ -n "$$publishedVer" ]; then \
		echo "error: $$name@$$ver is already published to npm"; \
		exit 1; \
	    fi && \
	    echo "** Are you sure you want to tag and publish $$name@$$ver to npm?" && \
	    echo "** Enter to continue, Ctrl+C to abort." && \
	    read _cutarelease_confirm
	ver=$(shell cat package.json | $(JSON) version) && \
	    date=$(shell date -u "+%Y-%m-%d") && \
	    git tag -a "$$ver" -m "version $$ver ($$date)" && \
	    git push --tags origin && \
	    npm publish
