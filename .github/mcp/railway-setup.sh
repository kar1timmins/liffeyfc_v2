#!/bin/bash

# Railway MCP Agent Setup Script
# Automated setup for Railway deployment with MCP integration

set -e

echo "🚂 Railway MCP Agent Setup for Liffey Founders Club"
echo "===================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}❌ Railway CLI is not installed${NC}"
        echo ""
        echo "Installing Railway CLI..."
        npm install -g @railway/cli
        echo -e "${GREEN}✅ Railway CLI installed${NC}"
    else
        echo -e "${GREEN}✅ Railway CLI is already installed${NC}"
    fi
}

# Check if user is logged in to Railway
check_railway_auth() {
    if railway whoami &> /dev/null; then
        echo -e "${GREEN}✅ Already authenticated with Railway${NC}"
        railway whoami
    else
        echo -e "${YELLOW}⚠️  Not authenticated with Railway${NC}"
        echo "Please login to Railway..."
        railway login
    fi
}

# Create or link Railway project
setup_railway_project() {
    echo ""
    echo "Setting up Railway project..."
    
    if [ -f ".railway.json" ]; then
        echo -e "${GREEN}✅ Railway project already linked${NC}"
    else
        echo ""
        echo "Do you want to:"
        echo "  1) Link to existing Railway project"
        echo "  2) Create new Railway project"
        read -p "Enter choice (1 or 2): " choice
        
        if [ "$choice" = "1" ]; then
            railway link
        else
            railway init
        fi
    fi
}

# Setup backend service
setup_backend_service() {
    echo ""
    echo "Setting up backend service..."
    
    cd backend
    
    # Check if railway.json exists
    if [ ! -f "railway.json" ]; then
        echo -e "${YELLOW}⚠️  railway.json not found in backend${NC}"
        echo "Creating railway.json..."
        cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --frozen-lockfile && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm run migration:run && node dist/main.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
EOF
        echo -e "${GREEN}✅ Created railway.json${NC}"
    else
        echo -e "${GREEN}✅ railway.json already exists${NC}"
    fi
    
    cd ..
}

# Setup email server service
setup_email_service() {
    echo ""
    echo "Setting up email server service..."
    
    cd email-server
    
    # Check if railway.json exists
    if [ ! -f "railway.json" ]; then
        echo -e "${YELLOW}⚠️  railway.json not found in email-server${NC}"
        echo "Creating railway.json..."
        cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
EOF
        echo -e "${GREEN}✅ Created railway.json${NC}"
    else
        echo -e "${GREEN}✅ railway.json already exists${NC}"
    fi
    
    cd ..
}

# Setup environment variables
setup_environment_variables() {
    echo ""
    echo "Setting up environment variables..."
    echo ""
    
    # Check if services exist
    echo "Checking available services..."
    railway service list > /dev/null 2>&1 || {
        echo -e "${YELLOW}⚠️  No services found in Railway project${NC}"
        echo ""
        echo "You need to create services first. Options:"
        echo "  1. Use Railway dashboard to create services"
        echo "  2. Deploy services first (railway up), then set variables"
        echo ""
        read -p "Skip environment variable setup for now? (y/n): " skip_env
        if [ "$skip_env" = "y" ] || [ "$skip_env" = "Y" ]; then
            echo -e "${YELLOW}⚠️  Skipping environment variable setup${NC}"
            return
        fi
    }
    
    read -p "Do you want to set up environment variables now? (y/n): " setup_env
    
    if [ "$setup_env" = "y" ] || [ "$setup_env" = "Y" ]; then
        echo ""
        echo "Available services in your Railway project:"
        railway service list
        echo ""
        
        read -p "Enter the backend service name (or press Enter to skip): " backend_service
        
        if [ -n "$backend_service" ]; then
            echo ""
            echo "Setting environment variables for '$backend_service' service..."
            
            read -p "Enter JWT_SECRET (or press Enter to use from .env): " jwt_secret
            if [ -z "$jwt_secret" ] && [ -f ".env" ]; then
                jwt_secret=$(grep "^JWT_SECRET=" .env | cut -d '=' -f2)
                echo "Using JWT_SECRET from .env file"
            fi
            
            if [ -n "$jwt_secret" ]; then
                railway variables --set "JWT_SECRET=$jwt_secret" --service "$backend_service"
            fi
            
            read -p "Enter RECAPTCHA_SECRET_KEY: " recaptcha_key
            if [ -n "$recaptcha_key" ]; then
                railway variables --set "RECAPTCHA_SECRET_KEY=$recaptcha_key" --service "$backend_service"
            fi
            
            read -p "Enter WEB3FORMS_ACCESS_KEY: " web3forms_key
            if [ -n "$web3forms_key" ]; then
                railway variables --set "WEB3FORMS_ACCESS_KEY=$web3forms_key" --service "$backend_service"
            fi
            
            railway variables --set "NODE_ENV=production" --service "$backend_service"
            railway variables --set "TYPEORM_SYNCHRONIZE=false" --service "$backend_service"
            
            echo -e "${GREEN}✅ Environment variables set for '$backend_service'${NC}"
        else
            echo -e "${YELLOW}⚠️  Skipping backend service configuration${NC}"
        fi
        
        echo ""
        read -p "Configure email server service? (y/n): " setup_email
        if [ "$setup_email" = "y" ] || [ "$setup_email" = "Y" ]; then
            read -p "Enter the email server service name: " email_service
            if [ -n "$email_service" ]; then
                echo "Setting up email server variables for '$email_service'..."
                read -p "Enter SMTP_HOST (default: smtp.zoho.com): " smtp_host
                smtp_host=${smtp_host:-smtp.zoho.com}
                
                read -p "Enter SMTP_PORT (default: 465): " smtp_port
                smtp_port=${smtp_port:-465}
                
                read -p "Enter SMTP_USER: " smtp_user
                read -p "Enter SMTP_PASSWORD: " smtp_pass
                read -p "Enter FROM_EMAIL: " from_email
                
                railway variables --set "SMTP_HOST=$smtp_host" --service "$email_service"
                railway variables --set "SMTP_PORT=$smtp_port" --service "$email_service"
                
                if [ -n "$smtp_user" ]; then
                    railway variables --set "SMTP_USER=$smtp_user" --service "$email_service"
                fi
                if [ -n "$smtp_pass" ]; then
                    railway variables --set "SMTP_PASSWORD=$smtp_pass" --service "$email_service"
                fi
                if [ -n "$from_email" ]; then
                    railway variables --set "FROM_EMAIL=$from_email" --service "$email_service"
                fi
                
                echo -e "${GREEN}✅ Email server variables set${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  Skipping environment variable setup${NC}"
        echo ""
        echo "Remember to set these variables before deploying:"
        echo ""
        echo "Backend service:"
        echo "  - JWT_SECRET"
        echo "  - RECAPTCHA_SECRET_KEY"
        echo "  - WEB3FORMS_ACCESS_KEY"
        echo "  - NODE_ENV=production"
        echo "  - TYPEORM_SYNCHRONIZE=false"
        echo ""
        echo "Database references (auto-set when adding databases):"
        echo "  - DATABASE_URL"
        echo "  - REDIS_URL"
        echo ""
        echo "Email server:"
        echo "  - SMTP_HOST"
        echo "  - SMTP_PORT"
        echo "  - SMTP_USER"
        echo "  - SMTP_PASSWORD"
        echo "  - FROM_EMAIL"
    fi
}

# Add PostgreSQL database
setup_database() {
    echo ""
    read -p "Do you want to add a PostgreSQL database? (y/n): " add_db
    
    if [ "$add_db" = "y" ] || [ "$add_db" = "Y" ]; then
        echo "Adding PostgreSQL database..."
        railway add --database postgres
        echo -e "${GREEN}✅ PostgreSQL database added${NC}"
        echo "Note: DATABASE_URL will be automatically set"
    else
        echo -e "${YELLOW}⚠️  Skipping database setup${NC}"
    fi
}

# Add Redis cache
setup_redis() {
    echo ""
    read -p "Do you want to add Redis? (y/n): " add_redis
    
    if [ "$add_redis" = "y" ] || [ "$add_redis" = "Y" ]; then
        echo "Adding Redis..."
        railway add --database redis
        echo -e "${GREEN}✅ Redis added${NC}"
        echo "Note: REDIS_URL will be automatically set"
    else
        echo -e "${YELLOW}⚠️  Skipping Redis setup${NC}"
    fi
}

# Create MCP agent configuration
setup_mcp_agent() {
    echo ""
    echo "MCP Agent configuration files are already in .github/mcp/"
    echo "  - railway-agent.json (MCP configuration)"
    echo "  - railway-agent.md (Documentation)"
    echo ""
}

# Main setup flow
main() {
    check_railway_cli
    echo ""
    check_railway_auth
    echo ""
    setup_railway_project
    echo ""
    setup_backend_service
    setup_email_service
    echo ""
    setup_database
    setup_redis
    echo ""
    setup_environment_variables
    echo ""
    setup_mcp_agent
    
    echo ""
    echo "================================================================"
    echo -e "${GREEN}✅ Railway MCP Agent setup complete!${NC}"
    echo "================================================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "  ${YELLOW}IMPORTANT: Deploy services BEFORE setting environment variables${NC}"
    echo ""
    echo "  1. Deploy backend service:"
    echo "     ${GREEN}cd backend && railway up${NC}"
    echo ""
    echo "  2. Deploy email server:"
    echo "     ${GREEN}cd email-server && railway up${NC}"
    echo ""
    echo "  3. Add databases (creates DATABASE_URL and REDIS_URL automatically):"
    echo "     ${GREEN}railway add --database postgres${NC}"
    echo "     ${GREEN}railway add --database redis${NC}"
    echo ""
    echo "  4. Set environment variables (after services are deployed):"
    echo "     ${GREEN}railway variables --set \"JWT_SECRET=your-secret\" --service <service-name>${NC}"
    echo "     ${GREEN}railway variables --set \"RECAPTCHA_SECRET_KEY=your-key\" --service <service-name>${NC}"
    echo "     ${GREEN}railway variables --set \"WEB3FORMS_ACCESS_KEY=your-key\" --service <service-name>${NC}"
    echo ""
    echo "  5. Check deployment status:"
    echo "     ${GREEN}railway status${NC}"
    echo ""
    echo "  6. View logs:"
    echo "     ${GREEN}railway logs --service <service-name>${NC}"
    echo ""
    echo "Useful commands:"
    echo "  - List services: ${GREEN}railway service list${NC}"
    echo "  - View variables: ${GREEN}railway variables${NC}"
    echo "  - Open dashboard: ${GREEN}railway open${NC}"
    echo ""
    echo "For more information, see:"
    echo "  - .github/mcp/railway-agent.md"
    echo "  - .github/mcp/RAILWAY_QUICK_REF.md"
    echo "  - .github/mcp/RAILWAY_CLI_V4_SYNTAX.md"
    echo "  - https://docs.railway.app"
    echo ""
}

# Run main setup
main
