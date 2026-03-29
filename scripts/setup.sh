#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       TestAgent — First-Time Setup       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
  exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
echo "✅ Node.js $(node -v)"

# Step 1: Install dependencies
echo ""
echo "📦 Step 1/6: Installing server dependencies..."
npm install

echo ""
echo "📦 Step 2/6: Installing client dependencies..."
cd client && npm install && cd ..

# Step 2: Setup environment
echo ""
echo "⚙️  Step 3/6: Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Created .env from .env.example"
  echo "   💡 Edit .env to add your ANTHROPIC_API_KEY (optional, for AI features)"
else
  echo "   .env already exists, skipping"
fi

# Step 3: Setup database
echo ""
echo "🗄️  Step 4/6: Setting up database..."
mkdir -p prisma/data
npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push
npx prisma generate
echo "   Database ready"

# Step 4: Install Playwright browsers
echo ""
echo "🌐 Step 5/6: Installing Playwright browsers (Chromium)..."
npx playwright install chromium
echo "   Chromium installed"

# Step 5: Build client
echo ""
echo "🔨 Step 6/6: Building React client..."
npm run build:client
echo "   Client built"

# Done
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            Setup Complete! 🎉            ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  Start the server:                       ║"
echo "║    npm start                              ║"
echo "║                                          ║"
echo "║  Open in browser:                        ║"
echo "║    http://localhost:4000                  ║"
echo "║                                          ║"
echo "║  Default login:                          ║"
echo "║    Email: admin@testagent.local           ║"
echo "║    Password: admin123                     ║"
echo "║                                          ║"
echo "║  (Optional) Enable AI features:           ║"
echo "║    App Settings → paste API key → Save   ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
