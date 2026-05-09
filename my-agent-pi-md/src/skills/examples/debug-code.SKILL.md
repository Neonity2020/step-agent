# Debug Code

---
name: Debug Code
description: Systematically debug and fix code issues, errors, and bugs
tags: debug, fix, error, bug, troubleshoot
version: 1.0.0
---

## Trigger

### Keywords
- debug
- fix
- bug
- error
- issue
- problem
- crash
- not working
- broken
- troubleshoot

### Patterns
- /\bfix\b/i
- /\berror\b/i
- /\bbug\b/i
- /not working/i

## Usage

Use this skill when asked to debug code or fix issues.

## Steps

1. Gather information:
   - What is the expected behavior?
   - What is the actual behavior?
   - What error messages are shown?
   - When did this start happening?
2. Reproduce the issue
3. Identify the root cause using:
   - Reading error messages
   - Adding debug output
   - Using debugger
   - Checking logs
4. Implement the fix
5. Verify the fix works
6. Check for similar issues elsewhere

## Tools

- read
- bash
- grep
- edit

## Constraints

- Fix the root cause, not just the symptoms
- Don't break existing functionality
- Add regression tests if possible
- Document any workarounds
