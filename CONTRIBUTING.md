# Contributing to Push Verifier

Thanks for your interest in contributing!

## Development Setup

1. Clone the repo and copy the env template:
   ```bash
   git clone <repo-url>
   cd push-verifier
   cp .env.example backend/.env
   ```

2. Fill in your Okta configuration in `backend/.env`

3. Start the development environment:
   ```bash
   ./start.sh
   ```

## Code Style

- **Python**: We use [Ruff](https://docs.astral.sh/ruff/) for linting and formatting
- **TypeScript**: ESLint with the project's eslint config

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Ensure linting passes
5. Submit a pull request with a clear description

## Reporting Issues

Please include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Python version if relevant
