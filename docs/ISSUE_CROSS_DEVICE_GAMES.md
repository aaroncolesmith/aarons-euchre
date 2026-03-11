// Brief explanation to user
## Cross-Device Game Syncing Issue - Fix Summary

**Root Cause:**
The Landing Page only displays games from localStorage (browser-specific storage). 
Each device has its own localStorage, so games created on one device won't appear on another.

**Solution:**
I need to add cloud game fetching to the Landing Page component. This involves:
1. Adding state to track cloud-fetched games
2. Adding a useEffect to fetch games from Supabase on component mount
3. Merging cloud and local games before displaying them

**Implementation Plan:**
- Import the new cloudGames utility functions
- Add state for cloudGames and loading status  
- Add useEffect to fetch from Supabase when currentUser or _refreshKey changes
- Merge local and cloud games using the utility function
- Display merged game list

This will ensure all games from all devices appear on every device when you log in as Aaron.
