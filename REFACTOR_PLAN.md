# Refactor Plan: Match chain-stock-flow-main

## Goals
1. Remove localStorage authentication completely
2. Use ONLY Supabase sessions (like chain-stock-flow-main)
3. Match chain-stock-flow-main's visual style and colors
4. Update all API calls to use Supabase client

## Phase 1: Authentication System ✅ STARTED

### Remove localStorage
- [x] Update auth.js to NOT store tokens in localStorage
- [ ] Remove all localStorage.getItem('auth_token') calls
- [ ] Update dashboard auth check to use ONLY Supabase session

### Update Auth Flow
- [ ] Create global Supabase client module
- [ ] Add session state management
- [ ] Update all pages to check Supabase session

## Phase 2: Styling Update

### Colors (from chain-stock-flow-main)
```css
Primary: hsl(262, 83%, 58%)  /* Purple */
Background: hsl(0, 0%, 98%)   /* Light gray */
Foreground: hsl(240, 10%, 15%) /* Dark text */
Card: hsl(0, 0%, 100%)        /* White */
Border: hsl(240, 5.9%, 90%)   /* Light border */
```

### Updates Needed
- [ ] Update login page colors to purple theme
- [ ] Update dashboard sidebar to match chain-stock-flow-main
- [ ] Update buttons to purple primary color
- [ ] Update cards with subtle borders
- [ ] Add gradient backgrounds like chain-stock-flow-main

## Phase 3: API Integration

### Files to Update
- [ ] dashboard.js - Use Supabase client for queries
- [ ] billings.js - Use Supabase client
- [ ] profile.js - Use Supabase client
- [ ] device-settings.js - Use Supabase client
- [ ] chatbot-ai.js - Use Supabase client
- [ ] whatsapp-bot.js - Use Supabase client
- [ ] flow-builder.js - Use Supabase client
- [ ] flow-manager.js - Use Supabase client

### Pattern to Follow
```javascript
// OLD WAY (remove this)
const token = localStorage.getItem('auth_token');
fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
})

// NEW WAY (use this)
import { supabase } from './auth.js';
const { data, error } = await supabase
  .from('table_name')
  .select('*')
```

## Phase 4: Testing
- [ ] Test registration flow
- [ ] Test login flow
- [ ] Test dashboard loading
- [ ] Test all pages work without localStorage
- [ ] Test logout
- [ ] Test inactive user redirect

## Phase 5: Git & Deploy
- [ ] Initialize git repository
- [ ] Commit all changes
- [ ] Push to GitHub main branch

---

## Current Status
Started Phase 1 - Authentication system updates
