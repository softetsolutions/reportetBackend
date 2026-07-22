set -e
echo "🚀 Starting deploy..."
echo "📥 Pulling latest code..."
git pull origin main
echo "📦 Installing dependencies..."
npm install
echo "🔄 Restarting backend..."
pm2 restart reportet-backend --update-env
echo "✅ Deploy complete!"