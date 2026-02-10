#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
# Animation Rollout Test Plan - Feb 7 2026
## What was implemented:
- App-wide CSS animations applied to all major components (top to bottom)
- Components updated: BattlePass, Dashboard, Layout, ClaimsList, ClaimDetails, Contracts, EveAI, InspectionsNew, Login
- Animation types: fade-in-up, stagger, glow-breathe, float, spin-slow, scale-pulse, shimmer, zoom-in, interactive-card
- Transparent badge icons with glow/spin effects on Battle Pass tiers
- Sidebar logo and nav animations added
- Page headers with text-glow-orange/blue effects

## Test credentials:
- Email: test@eden.com
- Password: password

## What to test:
1. Login page loads with animated background and glowing logo
2. Dashboard loads with staggered stat cards, animated Battle Pass widget, mission log items
3. Battle Pass page shows animated tier badges with glow effects
4. Claims list (Garden) loads with stagger animation on claim items
5. Claim Details page header has fade-in animation
6. Contracts page has staggered stat cards and animated header
7. Eve AI page header has glowing Agent Eve icon
8. Sidebar nav has glowing logo, animated active state icons
9. No broken pages or console errors
10. All navigation links work correctly

# Mobile + Harvest D2D + Names Test - Feb 7 2026
## Changes:
1. Mobile formatting fixes across all pages (Landing, Dashboard, Battle Pass, Claims, Contracts)
2. Landing page nav/hero/features/pricing all responsive with sm: breakpoints
3. Harvest D2D now uses full-featured Harvest.jsx (satellite map, pins, territories, contacts, offline sync, leaderboard, competitions, badges)
4. Harvest themed with tactical dark theme (zinc-900 backgrounds, orange accents)
5. Route swap: /canvassing → Harvest.jsx (full D2D), /canvassing/leaderboard → HarvestPage.jsx
6. Name consistency verified across sidebar and page headers

## Test credentials:
- Email: test@eden.com
- Password: password

# Functional Testing - Feb 7 2026
## Fixed:
1. Backend ClaimBase model - made client_email, date_of_loss, policy_number optional
2. NewClaim.jsx - rewritten with tactical dark theme, only essential fields required  
3. Create Claim flow now works end-to-end (form → API → redirect to claim detail)

## Known working flows:
- Login/auth
- Dashboard stats loading
- Navigation (all sidebar links + stat card clicks + quick actions)
- Create new claim (form submission + redirect to detail)
- Edit Mission modal (opens, shows form, dark theme)
- Eve AI chat (sends message, shows typing indicator)
- Contract create modal (opens form)
- Harvest D2D map (pins visible, tabs work)
- Battle Pass (loads tiers, shows progress)

## Test credentials:
- Email: test@eden.com / password
