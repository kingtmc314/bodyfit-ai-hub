import re

with open('server/routers.ts', 'r') as f:
    content = f.read()

# Add OWNER_USER_ID constant after imports
owner_const = '\n// Fixed owner user ID - no login required\nconst OWNER_USER_ID = 2;\n'

# Insert after the last import line
content = re.sub(
    r'(import Papa from "papaparse";)',
    r'\1' + owner_const,
    content
)

# Replace all protectedProcedure with publicProcedure
content = content.replace('protectedProcedure', 'publicProcedure')

# Replace all ctx.user.id with OWNER_USER_ID
content = content.replace('ctx.user.id', 'OWNER_USER_ID')

# Remove unused protectedProcedure from import
content = content.replace(
    'import { publicProcedure, protectedProcedure, router }',
    'import { publicProcedure, router }'
)

with open('server/routers.ts', 'w') as f:
    f.write(content)

print('Done! All protectedProcedure → publicProcedure, ctx.user.id → OWNER_USER_ID')
