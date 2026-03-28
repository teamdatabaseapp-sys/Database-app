# Staff Calendar Management System - Technical Design

## Executive Summary

Enterprise-grade staff scheduling system with:
- Visual weekly calendar grid
- Multi-staff shift management
- Store-specific scheduling
- Calendar sharing via email/SMS/native share
- Full integration with existing blackout/special days logic

---

## 1. DATABASE SCHEMA

### New Table: `staff_calendar_shifts`

This table stores **scheduled shifts** for specific weeks. Unlike `staff_weekly_schedule` (which stores recurring default hours), this stores actual scheduled shifts for a specific week.

```sql
CREATE TABLE public.staff_calendar_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,

  -- Week identification (Monday of the week, normalized to UTC midnight)
  week_start_date DATE NOT NULL,

  -- Day within the week (0=Monday, 1=Tuesday, ..., 6=Sunday)
  -- Using ISO week standard where Monday=0
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Shift times (TIME type, format: 'HH:MM:SS')
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,

  -- Optional: break period within shift
  break_start TIME,
  break_end TIME,

  -- Metadata
  notes TEXT,
  color TEXT, -- Override staff color for this shift

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  CONSTRAINT valid_shift_times CHECK (shift_end > shift_start),
  CONSTRAINT valid_break_times CHECK (
    (break_start IS NULL AND break_end IS NULL) OR
    (break_start IS NOT NULL AND break_end IS NOT NULL AND break_end > break_start)
  ),
  CONSTRAINT unique_staff_shift UNIQUE (staff_id, store_id, week_start_date, day_of_week)
);

-- Indexes for performance
CREATE INDEX idx_staff_calendar_shifts_business ON public.staff_calendar_shifts(business_id);
CREATE INDEX idx_staff_calendar_shifts_store ON public.staff_calendar_shifts(store_id);
CREATE INDEX idx_staff_calendar_shifts_staff ON public.staff_calendar_shifts(staff_id);
CREATE INDEX idx_staff_calendar_shifts_week ON public.staff_calendar_shifts(week_start_date);
CREATE INDEX idx_staff_calendar_shifts_lookup ON public.staff_calendar_shifts(store_id, week_start_date);
```

### Design Decisions:

| Decision | Rationale |
|----------|-----------|
| `week_start_date DATE` | Easy week identification, efficient queries |
| `day_of_week 0-6 (Mon-Sun)` | ISO week standard, consistent with business logic |
| Separate from `staff_weekly_schedule` | Weekly schedule = defaults, this = actual scheduled shifts |
| Store-specific | Multi-store support, different schedules per location |
| UNIQUE constraint | Prevents duplicate shifts for same staff/day/week |
| Soft break times | Optional lunch/break tracking |

### Relationship to Existing Tables:

```
staff_calendar_shifts (NEW)
    ├── Inherits defaults from: staff_weekly_schedule
    ├── Overridden by: staff_special_days (date-specific)
    ├── Blocked by: staff_blackout_ranges (time off)
    └── Constrained by: business_hours (store operating hours)
```

### Migration for Staff Email (Required for Sharing):

```sql
-- Ensure staff.email column exists and add validation
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add check constraint for email format (optional but recommended)
-- Not enforcing NOT NULL to maintain backwards compatibility
```

---

## 2. API ROUTES

### Base Path: `/api/staff-calendar`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shifts` | Get shifts for store/week |
| POST | `/shifts` | Create/update shifts (batch) |
| DELETE | `/shifts/:id` | Delete single shift |
| POST | `/shifts/copy-week` | Copy shifts from one week to another |
| POST | `/shifts/apply-defaults` | Apply weekly schedule as shifts |
| GET | `/summary` | Get weekly summary for sharing |
| POST | `/share` | Send schedule via email/SMS |

### Detailed Route Specifications:

#### GET `/api/staff-calendar/shifts`
```typescript
// Query params
{
  store_id: string;       // Required
  week_start_date: string; // ISO date (YYYY-MM-DD), Monday of week
  staff_ids?: string[];   // Optional filter
}

// Response
{
  shifts: StaffCalendarShift[];
  staff: StaffMember[];
  store: Store;
  weekStartDate: string;
}
```

#### POST `/api/staff-calendar/shifts`
```typescript
// Request body - batch upsert
{
  store_id: string;
  week_start_date: string;
  shifts: Array<{
    staff_id: string;
    day_of_week: number;
    shift_start: string; // HH:MM
    shift_end: string;   // HH:MM
    break_start?: string;
    break_end?: string;
    notes?: string;
  }>;
}

// Response
{
  success: boolean;
  shifts: StaffCalendarShift[];
  created: number;
  updated: number;
}
```

#### POST `/api/staff-calendar/share`
```typescript
// Request body
{
  store_id: string;
  week_start_date: string;
  recipients: Array<{
    type: 'email' | 'sms';
    value: string;
    staff_id?: string; // Optional: only send their schedule
  }>;
  include_all_staff: boolean;
  message?: string;
}

// Response
{
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}
```

---

## 3. FRONTEND COMPONENT STRUCTURE

```
mobile/src/components/
├── StaffCalendar/
│   ├── index.tsx                    # Main container & navigation
│   ├── StaffCalendarScreen.tsx      # Primary screen with all features
│   │
│   ├── Header/
│   │   ├── StaffAvatarSelector.tsx  # Circular avatars with selection
│   │   ├── WeekNavigator.tsx        # Week picker with prev/next
│   │   └── ViewToggle.tsx           # Calendar/List view toggle
│   │
│   ├── Calendar/
│   │   ├── CalendarGrid.tsx         # Main calendar grid component
│   │   ├── TimeColumn.tsx           # Left-side time labels
│   │   ├── DayColumn.tsx            # Single day column
│   │   ├── ShiftBlock.tsx           # Draggable shift block
│   │   ├── ShiftEditor.tsx          # Modal for editing shifts
│   │   └── DragOverlay.tsx          # Visual feedback during drag
│   │
│   ├── ListView/
│   │   ├── StaffListView.tsx        # Alternative list view
│   │   ├── DaySummary.tsx           # Day-by-day summary
│   │   └── StaffRow.tsx             # Staff schedule row
│   │
│   ├── Share/
│   │   ├── ShareModal.tsx           # Main share modal
│   │   ├── RecipientSelector.tsx    # Multi-select staff emails
│   │   ├── SharePreview.tsx         # Preview of share content
│   │   └── ShareMethods.tsx         # Email/SMS/Native buttons
│   │
│   └── hooks/
│       ├── useStaffCalendar.ts      # React Query hooks
│       ├── useWeekNavigation.ts     # Week state management
│       └── useDragDrop.ts           # Gesture handling
│
├── services/
│   └── staffCalendarService.ts      # Supabase client calls
│
└── hooks/
    └── useStaffCalendar.ts          # Exported hooks
```

### Component Hierarchy:

```
StaffCalendarScreen
├── Header
│   ├── StoreSelector (existing)
│   ├── WeekNavigator
│   │   ├── ChevronLeft (prev week)
│   │   ├── WeekLabel ("Feb 17-23, 2026")
│   │   └── ChevronRight (next week)
│   └── ViewToggle
│       ├── CalendarIcon
│       └── ListIcon
│
├── StaffAvatarSelector
│   └── [Staff avatars with names - horizontal scroll]
│       ├── Avatar (circular, color-coded)
│       └── Name (below avatar)
│
├── CalendarGrid (Primary View)
│   ├── TimeColumn
│   │   └── [Hour labels: 6am, 7am, ..., 10pm]
│   │
│   └── DayColumns
│       ├── DayColumn (Mon)
│       │   ├── DayHeader ("Mon 17")
│       │   └── ShiftBlocks
│       │       └── ShiftBlock (draggable, editable)
│       ├── DayColumn (Tue)
│       └── ... (Wed-Sun)
│
├── StaffListView (Alternative View)
│   └── StaffRows
│       └── StaffRow
│           ├── Avatar
│           ├── Name
│           └── DayShifts (compact)
│
├── ShiftEditor (Modal)
│   ├── StaffSelector
│   ├── DateSelector
│   ├── TimeRangePicker
│   │   ├── StartTime
│   │   └── EndTime
│   ├── BreakTimePicker (optional)
│   └── NotesInput
│
└── ShareModal
    ├── RecipientSelector
    │   └── StaffCheckboxes (with emails)
    ├── SharePreview
    └── ShareActions
        ├── EmailButton
        ├── SMSButton
        └── NativeShareButton
```

---

## 4. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTIONS                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    StaffCalendarScreen.tsx                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ State: selectedWeek, selectedStore, viewMode, selectedStaff │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ useStaffCalendar│     │ useStaffForStore│     │ useBusinessHours│
│     Shifts      │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      React Query Cache                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │  shifts      │  │  staff       │  │  businessHours         │   │
│  │  (per week)  │  │  (per store) │  │  (store constraints)   │   │
│  └──────────────┘  └──────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    staffCalendarService.ts                          │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ getShiftsForWeek() │ upsertShifts() │ deleteShift()        │    │
│  │ copyWeekShifts()   │ applyDefaults() │ getShareSummary()   │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               staff_calendar_shifts                          │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │   │
│  │  │ SELECT  │ │ UPSERT  │ │ DELETE  │ │ RLS: business_id │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

SHARING FLOW:
┌─────────────────────────────────────────────────────────────────────┐
│ ShareModal → formatScheduleSummary() → Backend API                  │
│     │                                       │                        │
│     ▼                                       ▼                        │
│  ┌──────────────────┐              ┌──────────────────┐             │
│  │ Native Share     │              │ Email/SMS API    │             │
│  │ (Share.share())  │              │ (send via backend)│             │
│  └──────────────────┘              └──────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘

INTEGRATION WITH EXISTING SYSTEMS:
┌─────────────────────────────────────────────────────────────────────┐
│                    Scheduling Priority Cascade                       │
│                                                                      │
│  1. staff_blackout_ranges    ←── BLOCKS (vacation, sick)            │
│  2. staff_special_days       ←── OVERRIDES (date-specific)          │
│  3. staff_calendar_shifts    ←── SCHEDULED (this system, NEW)       │
│  4. staff_weekly_schedule    ←── DEFAULTS (recurring template)      │
│  5. business_hours           ←── CONSTRAINTS (store operating)      │
│                                                                      │
│  When generating available slots, system checks in this order.      │
│  staff_calendar_shifts provides the actual working schedule.        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. SCALABILITY CONFIRMATION

### Multi-Store Support
- Every shift record includes `store_id`
- Store selector in UI filters staff and shifts
- RLS policies enforce business-level isolation

### Multi-Staff Support
- Calendar grid displays all staff columns
- Horizontal scroll for 5+ staff members
- Filter by staff using avatar selector

### Performance Optimizations
- Indexed queries by `(store_id, week_start_date)`
- React Query caching per week
- Virtualized list for 50+ staff members
- Lazy load shifts outside visible week

### Data Integrity
- UNIQUE constraint prevents duplicate shifts
- CHECK constraints validate time ranges
- CASCADE delete maintains referential integrity
- Audit columns track changes

### Integration Points
- Respects `staff_blackout_ranges` (blocks shifts during blackout)
- Respects `staff_special_days` (overrides for specific dates)
- Falls back to `staff_weekly_schedule` when no shift exists
- Constrained by `business_hours` (no shifts outside operating hours)

---

## 6. PREMIUM UI SPECIFICATIONS

### Color Palette
```typescript
const CALENDAR_COLORS = {
  grid: {
    background: '#FAFAFA',
    lines: '#E5E7EB',
    currentDay: '#EFF6FF',
    weekend: '#F9FAFB',
  },
  shift: {
    default: staff.color,
    hover: adjustOpacity(staff.color, 0.8),
    selected: adjustOpacity(staff.color, 0.6),
    conflict: '#FEE2E2',
  },
  time: {
    past: '#9CA3AF',
    current: '#3B82F6',
    future: '#374151',
  },
};
```

### Animations
- Shift block: `react-native-reanimated` spring animations
- Drag feedback: Scale + shadow increase
- Week transition: Horizontal slide
- Modal: Bottom sheet with gesture dismiss

### Typography
```typescript
const TYPOGRAPHY = {
  header: 'SF Pro Display Semibold, 18px',
  dayLabel: 'SF Pro Text Medium, 14px',
  timeLabel: 'SF Pro Text Regular, 12px',
  shiftText: 'SF Pro Text Semibold, 11px',
  staffName: 'SF Pro Text Medium, 12px',
};
```

---

## 7. IMPLEMENTATION PHASES

### Phase 1: Foundation
- [ ] Create `staff_calendar_shifts` table (SQL migration)
- [ ] Create `staffCalendarService.ts`
- [ ] Create React Query hooks

### Phase 2: Calendar View
- [ ] Build `CalendarGrid` component
- [ ] Build `ShiftBlock` with tap-to-edit
- [ ] Build `ShiftEditor` modal

### Phase 3: Staff Selector
- [ ] Build `StaffAvatarSelector`
- [ ] Build `WeekNavigator`
- [ ] Build `ViewToggle`

### Phase 4: List View
- [ ] Build `StaffListView`
- [ ] Build `DaySummary`

### Phase 5: Sharing
- [ ] Build `ShareModal`
- [ ] Implement email formatting
- [ ] Implement native share

### Phase 6: Polish
- [ ] Add animations
- [ ] Add haptic feedback
- [ ] Performance optimization
- [ ] Error handling

---

## 8. RISK MITIGATION

| Risk | Mitigation |
|------|------------|
| Overlapping shifts | UNIQUE constraint + client-side validation |
| Time zone confusion | Store all times in UTC, display in local |
| Large staff counts | Virtualization + pagination |
| Offline support | React Query + optimistic updates |
| Email deliverability | Use established email service (Resend/SendGrid) |

---

## 9. SUCCESS METRICS

- **Load time**: < 500ms for week view
- **Interaction latency**: < 100ms for shift manipulation
- **Data sync**: Real-time via Supabase subscriptions
- **Share delivery**: > 99% success rate

---

**Status**: DESIGN COMPLETE - Ready for Implementation
