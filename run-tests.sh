#!/bin/bash

# 🎮 Aaron's Euchre - Playwright Test Runner
# This script demonstrates how to run the Playwright tests

echo "🎮 Aaron's Euchre - Playwright Test Suite"
echo "=========================================="
echo ""

# Function to display menu
show_menu() {
    echo "Choose a test mode:"
    echo ""
    echo "  1) Headless mode (no browser window)"
    echo "  2) Headed mode (see the browser)"
    echo "  3) UI mode (interactive)"
    echo "  4) Debug mode (step through tests)"
    echo "  5) View last test report"
    echo "  6) Run specific test"
    echo "  7) Exit"
    echo ""
}

# Function to run specific test
run_specific_test() {
    echo ""
    echo "Available tests:"
    echo "  1) Single player with bots"
    echo "  2) Two players multiplayer"
    echo "  3) Load saved game"
    echo "  4) Error handling"
    echo ""
    read -p "Select test (1-4): " test_choice
    
    case $test_choice in
        1)
            echo "🚀 Running single player test..."
            npm run test -- --grep "Single player creates table"
            ;;
        2)
            echo "🚀 Running multiplayer test..."
            npm run test -- --grep "Two players join same table"
            ;;
        3)
            echo "🚀 Running saved game test..."
            npm run test -- --grep "Load existing game"
            ;;
        4)
            echo "🚀 Running error handling test..."
            npm run test -- --grep "Error handling"
            ;;
        *)
            echo "❌ Invalid selection"
            ;;
    esac
}

# Main loop
while true; do
    show_menu
    read -p "Enter your choice (1-7): " choice
    echo ""
    
    case $choice in
        1)
            echo "🚀 Running tests in headless mode..."
            echo "📝 Logs and screenshots will be saved"
            echo ""
            npm run test
            ;;
        2)
            echo "🚀 Running tests in headed mode..."
            echo "👀 You will see the browser window"
            echo ""
            npm run test:headed
            ;;
        3)
            echo "🚀 Opening Playwright UI..."
            echo "🎯 Interactive test runner"
            echo ""
            npm run test:ui
            ;;
        4)
            echo "🚀 Running tests in debug mode..."
            echo "🐛 Step through tests with debugger"
            echo ""
            npm run test:debug
            ;;
        5)
            echo "📊 Opening test report..."
            npm run test:report
            ;;
        6)
            run_specific_test
            ;;
        7)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please select 1-7."
            ;;
    esac
    
    echo ""
    echo "=========================================="
    echo ""
done
