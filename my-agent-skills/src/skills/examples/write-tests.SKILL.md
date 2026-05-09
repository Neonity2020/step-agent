# Write Tests

---
name: Write Tests
description: Generate comprehensive unit tests and integration tests for code
tags: testing, unit-test, integration-test, spec
version: 1.0.0
---

## Trigger

### Keywords
- test
- tests
- testing
- unit test
- integration test
- spec
- specification
- write test
- add test
- coverage

### Patterns
- /\btest\b/i
- /\bspec\b/i
- /coverage/i

## Usage

Use this skill when asked to write or generate tests.

## Steps

1. Identify the files and functions to test
2. Determine appropriate test framework (Jest, Vitest, pytest, etc.)
3. Write unit tests covering:
   - Happy path
   - Edge cases
   - Error cases
4. Write integration tests if applicable
5. Verify tests pass

## Tools

- read
- write
- edit
- bash

## Constraints

- Follow the existing test conventions in the project
- Use descriptive test names
- Aim for meaningful assertions
- Keep tests isolated and independent
