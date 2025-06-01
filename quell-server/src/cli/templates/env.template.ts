export const envTemplate = `# Environment variables for Quell GraphQL caching configuration
# See the documentation for more detail: https://github.com/open-source-labs/Quell

# Redis connection configuration
# For local Redis: redis://localhost:6379
# For Redis Cloud: redis://default:password@redis-12345.c1.us-east-1.aws.cloud.redislabs.com:12345
REDIS_HOST="localhost"
REDIS_PORT="6379"
# REDIS_PASSWORD=""  # Uncomment and set if your Redis instance requires authentication

# Cache configuration
# Time in seconds before cached entries expire (default: 1209600 = 14 days)
CACHE_EXPIRATION="1209600"

# Cost limiting parameters (optional)
# MAX_COST="5000"      # Maximum cost allowed before rejecting a query
# MAX_DEPTH="10"       # Maximum query depth allowed
# IP_RATE="3"          # Requests allowed per second per IP

# Server configuration (optional)
# PORT="4000"          # GraphQL server port
# NODE_ENV="development"

# Example Redis connection strings for popular providers:
# Redis Cloud: REDIS_URL="redis://default:your-password@redis-12345.c1.us-east-1.aws.cloud.redislabs.com:12345"
# Upstash: REDIS_URL="redis://default:your-password@fly-redis.upstash.io:6379"
# Railway: REDIS_URL="redis://default:your-password@containers-us-west-123.railway.app:6379"
# Heroku Redis: REDIS_URL="redis://h:password@ec2-12-345-678-90.compute-1.amazonaws.com:12345"
`;