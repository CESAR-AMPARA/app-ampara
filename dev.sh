#!/usr/bin/env bash

# dev.sh - App Ampara Monorepo Development Orchestrator
# Enforces quality gates, runs testing, linting, and handles local serving.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${PROJECT_ROOT}/.venv"
VENV_PIP="${VENV_DIR}/bin/pip"
VENV_PY="${VENV_DIR}/bin/python"
VENV_COV="${VENV_DIR}/bin/coverage"
VENV_LINT="${VENV_DIR}/bin/pylint"

show_help() {
    echo "App Ampara - Development Orchestrator"
    echo ""
    echo "Usage: ./dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  install        Create virtual environment and install dependencies."
    echo "  test           Run all backend tests and check code coverage."
    echo "  lint           Run pylint static analysis to verify code quality."
    echo "  serve          Start the local backend development Flask server."
    echo "  help           Display this help menu."
    echo ""
}

ensure_venv() {
    if [ ! -d "${VENV_DIR}" ]; then
        echo "Creating virtual environment at ${VENV_DIR}..."
        python3 -m venv "${VENV_DIR}"
    fi
}

do_install() {
    ensure_venv
    echo "Installing requirements..."
    "${VENV_PIP}" install -r "${PROJECT_ROOT}/requirements.txt" coverage pylint
    echo "Installation complete."
}

do_test() {
    ensure_venv
    if [ ! -f "${VENV_COV}" ]; then
        echo "Installing test dependencies..."
        "${VENV_PIP}" install coverage
    fi
    echo "Running unit tests with coverage..."
    cd "${PROJECT_ROOT}/backend"
    PYTHONPATH="${PROJECT_ROOT}/backend" "${VENV_COV}" run -m unittest discover -s test -t .
    echo ""
    echo "Coverage Report:"
    "${VENV_COV}" report -m
}

do_lint() {
    ensure_venv
    if [ ! -f "${VENV_LINT}" ]; then
        echo "Installing lint dependencies..."
        "${VENV_PIP}" install pylint
    fi
    echo "Running pylint analysis..."
    cd "${PROJECT_ROOT}/backend"
    PYTHONPATH="${PROJECT_ROOT}/backend" "${VENV_LINT}" src/ test/
    echo "Pylint checks passed (10/10)!"
}

do_serve() {
    ensure_venv
    echo "Starting App Ampara local development backend server..."
    export PYTHONPATH="${PROJECT_ROOT}/backend"
    export FLASK_APP="src.app"
    export FLASK_ENV="development"
    "${VENV_PY}" "${PROJECT_ROOT}/backend/src/app.py"
}

case "$1" in
    install)
        do_install
        ;;
    test)
        do_test
        ;;
    lint)
        do_lint
        ;;
    serve)
        do_serve
        ;;
    help|*)
        show_help
        ;;
esac
