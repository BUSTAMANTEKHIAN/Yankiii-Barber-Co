# Yankiii Barber Co. — Full-Stack Barbershop Booking System

> **Precision cuts. Clean fades. Your standard.**  
> A professional, full-stack appointment scheduling and management platform engineered for premium barbershops.

---

## 📌 Project Overview

**Yankiii Barber Co.** is an appointment-booking platform and shop management system built for high-end barbershops. Unlike basic CRUD tutorials or cookie-cutter templates, this project implements real-world barbershop business logic:
- **Intelligent Availability Calculation**: Dynamic candidate time slot generation taking into account variable service durations (30 min, 45 min, 60 min, 75 min), operating business hours, and individual barber weekly schedules.
- **Strict Double-Booking Prevention**: Atomic database locking (`SELECT ... FOR UPDATE`) and transaction verification ensuring two clients cannot book overlapping chair appointments.
- **Customer Portal**: Self-service appointment tracking, active bookings management, and safe cancellation rules.
- **Admin Management Suite**: Real-time KPI metrics (Revenue, Appointments, Customers), booking status moderation (Confirm/Complete/Cancel), service menu CRUD, barber staff rosters, and weekly operating hours configuration.
- **Resilient Fallback Design**: SVG/CSS image fallback system and client-side demo adapters that preserve complete UI visual polish even before local photos or databases are initialized.

---

## 🎨 Brand & Visual Identity

The project adheres strictly to the Yankiii Barber Co. natural masculine palette:
- `#4A6E3D` (Forest Green): Primary buttons, active tabs, highlights, links.
- `#A7C99B` (Sage Accent): Badges, hover states, subtle decorative borders.
- `#2D3A2A` (Deep Olive): Headings, dark UI sections, footers, admin navigation.
- `#E6F4E6` (Clean Light Mint): Section backgrounds, card containers, table headers.
- **Typography**: `Playfair Display` (editorial serif headings) paired with `DM Sans` (clean modern geometric sans-serif for UI, forms, tables, and buttons).

---

## 🚀 Technology Stack

### Frontend Architecture
- **HTML5 & Vanilla JavaScript (ES6+)**: Zero framework bloat, fast load times, semantic accessibility.
- **Modular CSS3**: Custom CSS variables, responsive design with support for 1440px, 1024px, 768px, 480px, 390px, and 360px.
- **Font Awesome 6.5**: Crisp vector iconography.
- **Image Fallback System**: Automatic SVG monogram placeholders for missing assets.

### Backend & API
- **Node.js (v20+) & Express.js**: RESTful API architecture.
- **JWT (JSON Web Tokens)**: Stateless authentication with role-based claims (`customer`, `admin`).
- **bcryptjs**: Salted password hashing (passwords are never stored in plaintext).
- **CORS & dotenv**: Environment isolation and cross-origin security.

### Database Architecture
- **MySQL (5.7 / 8.0 / 9.x)**: Normalized relational schema (`users`, `barbers`, `services`, `barber_schedules`, `business_hours`, `bookings`).
- **Foreign Key Constraints & Indexes**: Indexed queries on `(barber_id, booking_date)` and `(status)`.

---

## 📁 Project Structure

```text
Yankiii-Barber-Co/
├── assets/
│   ├── images/               # Drop your hero.jpg, barber-1..3.jpg, service-1..4.jpg here
│   └── logo/                 # Brand logos
├── css/
│   ├── style.css             # Design tokens, typography, header, footer, shared UI
│   ├── responsive.css        # Multi-device media queries (1440px down to 360px)
│   ├── booking.css           # Stepper wizard, slot pills, summary sidebar
│   ├── auth.css              # Login, registration, customer dashboard
│   └── admin.css             # Admin sidebar, metric cards, tables, modals
├── js/
│   ├── api.js                # Centralized API client with JWT header injection
│   ├── main.js               # Header navigation, mobile drawer, toast system, image fallbacks
│   ├── booking.js            # 4-step booking engine, availability checking, form prefilling
│   ├── services.js           # Dynamic services loader with fallback
│   ├── barbers.js            # Dynamic barber roster with fallback
│   ├── auth.js               # Registration and login handler
│   ├── dashboard.js          # Customer appointment manager and cancellation modal
│   └── admin.js              # Admin KPI dashboard, booking moderation, service/barber CRUD
├── database/
│   ├── schema.sql            # DDL for all 6 tables, foreign keys, and indexes
│   ├── seed.sql              # Default admin, services, barbers, schedules, and hours
│   └── init-db.js            # Automated Node runner to initialize MySQL database
├── server/
│   ├── app.js                # Express app entry point & static file server
│   ├── .env.example          # Environment variable template
│   ├── .env                  # Local server configuration
│   ├── config/
│   │   └── db.js             # MySQL connection pool
│   ├── middleware/
│   │   ├── authMiddleware.js # Bearer token verification
│   │   └── adminMiddleware.js# Admin role authorization
│   ├── controllers/
│   │   ├── authController.js # Register, login, profile queries
│   │   ├── serviceController.js # Service menu CRUD
│   │   ├── barberController.js  # Barber staff & schedule management
│   │   ├── bookingController.js # Availability calculation & atomic booking
│   │   └── adminController.js   # Metrics, customer directory, business hours
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── serviceRoutes.js
│   │   ├── barberRoutes.js
│   │   ├── bookingRoutes.js
│   │   └── adminRoutes.js
│   ├── utils/
│   │   └── bookingUtils.js   # Slot generator, overlap algorithm, reference builder
│   └── test-booking.js       # Automated logic & unit tests
├── index.html                # Homepage (Hero, Services, About, Barbers, Standards, Reviews)
├── services.html             # Full grooming menu & pricing
├── barbers.html              # Barber team profiles & specialties
├── about.html                # Brand philosophy & shop environment
├── contact.html              # Location, operating hours, validated contact form
├── booking.html              # 4-step customer booking wizard
├── confirmation.html         # Booking confirmation with reference code
├── login.html                # Customer / Admin sign in
├── register.html             # Customer registration
├── dashboard.html            # Customer appointment tracking & history
├── admin/
│   ├── index.html            # Admin redirect
│   ├── dashboard.html        # Admin KPI overview & recent bookings
│   ├── bookings.html         # Searchable booking table with status updates
│   ├── services.html         # Service CRUD modal manager
│   ├── barbers.html          # Barber CRUD & weekly schedule editor
│   ├── customers.html        # Customer directory
│   └── settings.html         # Weekly business hours configuration
├── package.json
└── README.md
```

---

## ⚡ Installation & Setup

### 1. Prerequisites
- **Node.js** (v18 or newer)
- **npm** (v9 or newer)
- **MySQL Server** (v5.7, 8.0, or 9.x)

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/yourusername/yankiii-barber-co.git
cd yankiii-barber-co
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=yankiii_barber
DB_PORT=3306
JWT_SECRET=your_secure_random_jwt_secret_key
```

### 4. Database Setup
Initialize the database, tables, and seed data automatically:
```bash
npm run db:init
```
*Alternatively, you can import `database/schema.sql` and `database/seed.sql` directly into MySQL Workbench or phpMyAdmin.*

### 5. Run Automated Logic Tests
Verify the booking overlap engine, variable duration math, and JWT authentication:
```bash
npm test
```

### 6. Start the Server
```bash
npm start
```
Open your browser and navigate to:
- **Website**: `http://localhost:3000`
- **Admin Portal**: `http://localhost:3000/admin/dashboard.html`

---

## 🔑 Demo Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| **Admin** | `admin@yankiiibarber.com` | `Admin123!` | Full Admin Portal & Settings |
| **Customer** | `customer@example.com` | `Customer123!` | Customer Dashboard & History |

*(Both login forms include instant "Fill Customer" and "Fill Admin" one-click helper buttons for quick evaluation).*

---

## 📡 REST API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a customer account
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET /api/auth/me` — Get authenticated user details
- `PUT /api/auth/profile` — Update account profile/password

### Services (`/api/services`)
- `GET /api/services` — Public catalog (active only) or Admin (all)
- `GET /api/services/:id` — Retrieve single service
- `POST /api/services` — Create service (Admin)
- `PUT /api/services/:id` — Update service (Admin)
- `DELETE /api/services/:id` — Soft-deactivate or delete service (Admin)

### Barbers & Schedules (`/api/barbers`)
- `GET /api/barbers` — Public roster or Admin list
- `GET /api/barbers/:id` — Barber profile with weekly schedules
- `POST /api/barbers` — Create barber (Admin)
- `PUT /api/barbers/:id` — Update barber (Admin)
- `GET /api/barbers/:id/schedule` — Get weekly working days/hours
- `PUT /api/barbers/:id/schedule` — Update weekly shift hours (Admin)

### Bookings (`/api/bookings`)
- `GET /api/bookings/availability?barber_id=X&date=YYYY-MM-DD&duration=45` — Compute real-time available time slots
- `POST /api/bookings` — Reserve chair (with atomic double-booking check)
- `GET /api/bookings/my` — Customer's own appointment history
- `GET /api/bookings` — Filterable bookings list (Admin)
- `PATCH /api/bookings/:id` — Update status (`confirmed`, `completed`, `cancelled`)

### Admin Management (`/api/admin`)
- `GET /api/admin/dashboard` — KPI metrics and recent bookings
- `GET /api/admin/customers` — Client directory with booking counts
- `GET /api/admin/settings/hours` — View shop opening/closing hours
- `PUT /api/admin/settings/hours` — Update weekly business hours

---

## 🛡️ Double-Booking Prevention Algorithm

1. **Client Selection**: Client chooses a service duration (e.g., 45 minutes for Signature Fade) and barber.
2. **Availability Check**:
   - Fetches shop operating hours and barber shift hours for the target day.
   - Evaluates candidate start intervals in 30-minute steps (`candidateStart`).
   - Computes `candidateEnd = candidateStart + serviceDuration`.
   - If `candidateEnd > shiftEnd`, the slot is omitted.
   - Evaluates against existing bookings: conflict occurs if `candidateStart < bookingEnd && candidateEnd > bookingStart`.
3. **Server-Side Transaction Check**:
   - During `POST /api/bookings`, pricing and duration are queried from the database (client-submitted pricing is ignored).
   - An atomic database query checks for collisions with `FOR UPDATE`.
   - If a collision is found, returns HTTP `409 Conflict`:
     ```json
     {
       "success": false,
       "message": "This appointment time is no longer available."
     }
     ```

---

## 🔮 Future Upgrades Roadmap

The system architecture is structured for seamless integration of:
1. **SMS & Email Notifications**: Automated reminders via Twilio or Resend 24 hours before cuts.
2. **Online Payment Gateways**: GCash, Maya, and Stripe integration.
3. **Barber Commission & Analytics**: Multi-branch support, individual barber tip/commission tracking, and monthly revenue exports.
4. **Google Calendar Sync**: Two-way sync for barbers' personal schedules.

---

## 📄 License & Credits

- Designed and Developed by **Khian**.
- Created as a showcase freelance web development portfolio project.
- © 2026 Yankiii Barber Co. All rights reserved.

