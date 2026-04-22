# Password Reset Setup Guide

## What's New

The app now has a complete password reset flow:

- **Forgot Password Page**: `/forgot-password` - Users enter their email to request a reset link
- **Reset Password Page**: `/reset-password` - Users set a new password when clicking the email link
- **Login Page**: Added "Forgot your password?" link

## How It Works

1. User clicks "Forgot your password?" on the login page
2. User enters their email and clicks "Send Reset Link"
3. Supabase sends a password reset email with a link
4. User clicks the link in the email (redirects to `/reset-password?access_token=...&type=recovery`)
5. User sets a new password and confirms it
6. Password is updated and user is redirected to login

## Supabase Configuration (REQUIRED)

For password reset emails to work, you must configure redirect URLs in your Supabase project:

### Step 1: Get Your App URL

- **Local Development**: `http://localhost:5173` (assuming your dev server runs on port 5173)
- **Deployed App**: Your actual domain (e.g., `https://myapp.com`)

### Step 2: Configure Supabase Authentication URLs

1. Go to your Supabase Project Dashboard
2. Click **Authentication** in the left sidebar
3. Click **URL Configuration**
4. Set the following:
   - **Site URL**: `http://localhost:5173` (or your deployed domain)
   - **Redirect URLs**: Add the following URLs (one per line):
     - `http://localhost:5173/reset-password`
     - `http://localhost:5173/auth`
     - If deployed: add your production URLs

### Step 3: Enable Email Provider (if not already enabled)

1. In Authentication settings, click **Email**
2. Ensure "Enable Email Provider" is toggled ON
3. Supabase sends emails from its default address (you can configure custom SMTP later if needed)

## Testing the Flow

### Reset Password for a Specific User

#### Option 1: Using Supabase Dashboard (Quick)

1. Go to **Authentication** → **Users**
2. Find the user (e.g., `reyes.brianjohn.papa@gmail.com`)
3. Click the three-dot menu → **Reset password**
4. Set a new password directly

#### Option 2: Using the App (Full Test)

1. Start the app: `npm.cmd run dev`
2. Go to `http://localhost:5173/forgot-password`
3. Enter the user's email
4. Check the email inbox for the reset link
5. Click the link (it should redirect to `/reset-password` with a token)
6. Set a new password
7. Log in with the new password

## Troubleshooting

### "Invalid or expired reset link" Error

- The token may have expired (reset links expire in 1 hour)
- Request a new reset link
- Make sure you're using the correct Supabase project URL in `.env.local`

### Email Not Received

- Check spam/junk folder
- Verify email provider is enabled in Supabase Authentication
- Check that **Site URL** and **Redirect URLs** are configured in Supabase

### Redirect to Wrong URL

- Verify **Site URL** in Supabase matches your app URL
- For local dev, use `http://localhost:5173` (not `http://127.0.0.1:5173`)
- Restart the dev server after updating `.env.local`

### Password Reset Works Locally But Not on Production

- Update **Site URL** and **Redirect URLs** in Supabase to use your production domain
- Example: `https://myapp.com` and `https://myapp.com/reset-password`

## Notes

- Password reset links expire in 1 hour
- Minimum password length is 8 characters
- Passwords must match in the confirm field
- After successful reset, user is automatically redirected to login page
