# TEST User Addition - Summary

**Date:** 2026-01-02  
**Purpose:** Keep Aaron's production environment clean during automated testing

---

## ✅ Changes Made

### 1. **Added TEST User to Allowed Users**

**File:** `src/App.tsx` (Line 1109)
```tsx
const ALLOWED_USERS = ['Aaron', 'Polina', 'Gray-Gray', 'Mimi', 'Micah', 'Cherrie', 'Peter-Playwright', 'TEST'];
```

**File:** `src/store/GameStore.tsx` (Lines 282, 287)
```tsx
const knownUsers = ['aaron', 'polina', 'gray-gray', 'mimi', 'micah', 'cherrie', 'peter-playwright', 'test'];
const displayName = matchedUser
    ? ['Aaron', 'Polina', 'Gray-Gray', 'Mimi', 'Micah', 'Cherrie', 'Peter-Playwright', 'TEST'][knownUsers.indexOf(matchedUser)]
    : enteredName;
```

### 2. **Updated Documentation**

**File:** `START_HERE.md` (Lines 37-47)

Added:
- TEST to the target users list
- **CRITICAL TESTING RULE** section with explicit guidelines
- Clear DO/DON'T instructions for when to use TEST vs real users

---

## 🎯 Usage Guidelines

### **When to Use TEST:**
- ✅ Browser subagent testing (like the active player visual test we just did)
- ✅ Manual development testing
- ✅ Validation scripts
- ✅ Any automated testing that creates game data

### **When NOT to Use TEST:**
- ❌ Don't use for real gameplay
- ❌ Don't include in production user stats analysis
- ❌ Don't use for multiplayer testing with real users

### **Existing Test Users:**
- **Peter-Playwright**: Already used in Playwright test suite ✅
  - Good! This keeps Playwright test data separate
  - All 20+ Playwright tests use "Peter-Playwright"
- **TEST**: New user for ad-hoc testing and browser subagent tests ✅

---

## 📝 Benefits

1. **Clean Production Data**
   - Aaron's game history stays clean
   - Stats remain accurate and meaningful
   - No test games cluttering the saved games list

2. **Easy Identification**
   - Test data is easily identifiable by username
   - Can filter out TEST user from analytics
   - Can bulk-delete TEST user games if needed

3. **Multiple Test Users**
   - **Peter-Playwright**: For automated Playwright tests
   - **TEST**: For browser subagent and manual testing
   - Keeps different types of testing separate

---

## 🔮 Future Enhancements (Optional)

Consider adding:
- SQL query to bulk-delete TEST user games
- Admin panel to view/delete test user data
- Automatic cleanup of TEST games older than X days
- Test mode flag that prevents TEST games from being saved to DB
