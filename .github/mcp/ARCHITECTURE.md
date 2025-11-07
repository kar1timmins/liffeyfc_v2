# Railway MCP Agent Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Railway MCP Agent System                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                          │
           ┌────────▼────────┐        ┌───────▼────────┐
           │  MCP Agent      │        │  Railway CLI    │
           │  (JSON Config)  │◄──────►│  (@railway/cli) │
           └────────┬────────┘        └────────┬────────┘
                    │                          │
        ┌───────────┼──────────────┬──────────┴────────┐
        │           │              │                    │
   ┌────▼────┐ ┌───▼───┐    ┌────▼─────┐      ┌──────▼──────┐
   │  Tools  │ │Flows  │    │ Monitor  │      │   Railway   │
   └────┬────┘ └───┬───┘    └────┬─────┘      │   Platform  │
        │          │              │            └──────┬──────┘
        └──────────┼──────────────┘                   │
                   │                          ┌───────┴────────┐
                   │                          │                │
            ┌──────▼──────┐         ┌────────▼────┐  ┌───────▼────────┐
            │  Deployment │         │   Services  │  │  Infrastructure│
            └─────────────┘         └─────────────┘  └────────────────┘
```

## Component Architecture

### 1. MCP Agent Core

```
┌──────────────────────────────────────────────────────┐
│              railway-agent.json                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────┐  ┌──────────────────┐          │
│  │  Server Config  │  │  Environment     │          │
│  │  - Command      │  │  - RAILWAY_TOKEN │          │
│  │  - Args         │  │  - Variables     │          │
│  └─────────────────┘  └──────────────────┘          │
│                                                       │
│  ┌─────────────────────────────────────────┐        │
│  │           Tools (15+)                    │        │
│  ├─────────────────────────────────────────┤        │
│  │  • railway_login                         │        │
│  │  • railway_status                        │        │
│  │  • railway_deploy_backend                │        │
│  │  • railway_deploy_email_server           │        │
│  │  • railway_logs                          │        │
│  │  • railway_set_env                       │        │
│  │  • railway_get_env                       │        │
│  │  • railway_restart                       │        │
│  │  • railway_domain                        │        │
│  │  • ... and more                          │        │
│  └─────────────────────────────────────────┘        │
│                                                       │
│  ┌─────────────────────────────────────────┐        │
│  │         Workflows (4)                    │        │
│  ├─────────────────────────────────────────┤        │
│  │  1. Full Deployment                      │        │
│  │  2. Backend Only                         │        │
│  │  3. Setup Environment                    │        │
│  │  4. Rollback                             │        │
│  └─────────────────────────────────────────┘        │
│                                                       │
│  ┌─────────────────────────────────────────┐        │
│  │         Monitoring                       │        │
│  ├─────────────────────────────────────────┤        │
│  │  • Health Checks (every 60s)            │        │
│  │  • Alerts (Critical/Warning)            │        │
│  │  • Log Monitoring                        │        │
│  └─────────────────────────────────────────┘        │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 2. Deployment Flow

```
┌──────────────────────────────────────────────────────────┐
│                  Deployment Workflow                      │
└──────────────────────────────────────────────────────────┘

   ┌─────────────┐
   │   Trigger   │
   │  (Manual/   │
   │   CI/CD)    │
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  Pre-Check  │───── ✓ Railway CLI installed
   │  Validation │───── ✓ Authenticated
   └──────┬──────┘      ✓ Project linked
          │
          ▼
   ┌─────────────┐
   │   Backend   │
   │   Service   │
   │             │
   │  1. Build   │───── pnpm install
   │  2. Test    │───── pnpm test (optional)
   │  3. Deploy  │───── railway up
   │  4. Migrate │───── Auto-run migrations
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │    Email    │
   │   Server    │
   │             │
   │  1. Build   │───── npm install
   │  2. Deploy  │───── railway up
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │   Health    │───── Check /health endpoints
   │   Checks    │───── Wait for services
   │             │───── Verify connections
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │  Monitor    │───── View logs
   │   & Alert   │───── Send notifications
   └─────────────┘
```

### 3. Service Architecture on Railway

```
┌──────────────────────────────────────────────────────────────┐
│              Railway Project: liffeyfc                        │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                      │
  ┌─────▼─────┐        ┌──────▼──────┐      ┌──────▼──────┐
  │  Backend  │        │    Email    │      │  Databases  │
  │  (NestJS) │        │   Server    │      └─────────────┘
  └───────────┘        └─────────────┘              │
        │                     │              ┌───────┴───────┐
        │                     │              │               │
   ┌────┴────┐           ┌───┴────┐   ┌─────▼────┐  ┌─────▼────┐
   │ Port    │           │ Port   │   │PostgreSQL│  │  Redis   │
   │ 3000    │           │ 3001   │   │  (v15)   │  │  (v7)    │
   │         │           │        │   └──────────┘  └──────────┘
   │/health  │           │/health │         │             │
   └─────────┘           └────────┘         │             │
        │                     │              │             │
        └─────────────────────┼──────────────┴─────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Environment Vars  │
                    ├───────────────────┤
                    │ • JWT_SECRET      │
                    │ • DATABASE_URL    │
                    │ • REDIS_URL       │
                    │ • SMTP_*          │
                    │ • API_KEYS        │
                    └───────────────────┘
```

### 4. Data Flow

```
┌───────────┐           ┌──────────────┐           ┌────────────┐
│           │           │              │           │            │
│  Client   │──────────►│   Backend    │──────────►│ PostgreSQL │
│ (Browser) │           │   (NestJS)   │           │  Database  │
│           │◄──────────│              │◄──────────│            │
└───────────┘           └──────┬───────┘           └────────────┘
                               │
                               │ ┌────────────┐
                               ├─►   Redis    │
                               │ │  (Nonce)   │
                               │ └────────────┘
                               │
                               │ ┌────────────┐
                               └─►   Email    │
                                 │   Server   │
                                 └────────────┘
```

### 5. Tool Categorization

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Agent Tools                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌───────────────────┐  ┌─────────────────┐
│   Deployment     │  │   Configuration   │  │   Monitoring    │
├──────────────────┤  ├───────────────────┤  ├─────────────────┤
│ • deploy_backend │  │ • set_env         │  │ • logs          │
│ • deploy_email   │  │ • get_env         │  │ • status        │
│ • link_project   │  │ • domain          │  │ • health_check  │
│ • unlink_project │  │                   │  │                 │
└──────────────────┘  └───────────────────┘  └─────────────────┘

┌──────────────────┐  ┌───────────────────┐
│     Service      │  │   Infrastructure  │
├──────────────────┤  ├───────────────────┤
│ • list_services  │  │ • create_service  │
│ • restart        │  │ • delete_service  │
│ • login          │  │                   │
│                  │  │                   │
└──────────────────┘  └───────────────────┘
```

### 6. Workflow Execution

```
Full Deployment Workflow
────────────────────────

  Start
    │
    ▼
┌───────────────┐
│ Check Railway │
│  CLI Status   │
└───────┬───────┘
        │ ✓
        ▼
┌───────────────┐
│    Deploy     │
│   Backend     │
└───────┬───────┘
        │ ✓
        ▼
┌───────────────┐
│    Deploy     │
│ Email Server  │
└───────┬───────┘
        │ ✓
        ▼
┌───────────────┐
│  Check Status │
└───────┬───────┘
        │ ✓
        ▼
┌───────────────┐
│   View Logs   │
└───────┬───────┘
        │
        ▼
      End
```

### 7. Monitoring Architecture

```
┌────────────────────────────────────────────────────┐
│              Monitoring System                      │
└────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
  ┌─────▼──────┐  ┌────▼─────┐  ┌─────▼──────┐
  │   Health   │  │   Logs   │  │   Alerts   │
  │   Checks   │  │ Analysis │  │  System    │
  └─────┬──────┘  └────┬─────┘  └─────┬──────┘
        │              │              │
        │ Every 60s    │ Real-time   │ Threshold
        │              │              │
  ┌─────▼──────┐  ┌────▼─────┐  ┌─────▼──────┐
  │ /health    │  │  Error   │  │  Critical  │
  │ endpoints  │  │  grep    │  │  Warning   │
  └────────────┘  └──────────┘  └────────────┘
                                       │
                              ┌────────┴────────┐
                              │                 │
                        ┌─────▼──────┐   ┌─────▼─────┐
                        │   Email    │   │   Slack   │
                        │   Notify   │   │   Notify  │
                        └────────────┘   └───────────┘
```

### 8. Environment Variable Flow

```
┌──────────────────────────────────────────────────────┐
│          Environment Configuration Flow               │
└──────────────────────────────────────────────────────┘

  Local .env
      │
      ▼
  ┌─────────────┐
  │  Setup      │
  │  Workflow   │
  └──────┬──────┘
         │
         ▼
  Railway Variables
         │
    ┌────┴────┬────────┬─────────┐
    │         │        │         │
    ▼         ▼        ▼         ▼
Backend  Email   Postgres  Redis
Service  Server  (AUTO)   (AUTO)
    │         │        │         │
    └─────────┴────────┴─────────┘
              │
              ▼
    ┌──────────────────┐
    │  Application     │
    │  Runtime         │
    └──────────────────┘
```

## Benefits

### For Developers
- ✅ **Automated workflows** - No manual steps
- ✅ **Consistent deployments** - Same process every time
- ✅ **Built-in validation** - Pre-checks before deployment
- ✅ **Easy rollbacks** - One-command rollback
- ✅ **Comprehensive logging** - Detailed execution logs

### For Operations
- ✅ **Health monitoring** - Automatic health checks
- ✅ **Alert system** - Proactive notifications
- ✅ **Environment management** - Centralized configuration
- ✅ **Service orchestration** - Proper deployment order
- ✅ **Audit trail** - Complete deployment history

### For DevOps
- ✅ **CI/CD ready** - GitHub Actions integration
- ✅ **Multi-environment** - Support for staging/production
- ✅ **Infrastructure as Code** - Version-controlled config
- ✅ **Extensible** - Easy to add new tools/workflows
- ✅ **Best practices** - Built-in security and performance

## Usage Patterns

### Pattern 1: Quick Backend Update
```
Developer → Code Change → Git Push → GitHub Actions → 
MCP Agent → Backend Deploy → Health Check → Notification
```

### Pattern 2: Full Stack Deployment
```
DevOps → MCP Agent → Full Workflow → Backend + Email + DB →
Health Checks → Verify → Monitor → Alert
```

### Pattern 3: Emergency Rollback
```
Incident → MCP Agent → Rollback Workflow → Previous Version →
Verify → Restore → Monitor
```

---

**Visual Key:**
- `┌─┐` = System/Component Boundary
- `│  │` = Connection/Flow
- `▼`   = Direction of Flow
- `─►` = Data/Action Flow
- `✓`   = Success/Validation
