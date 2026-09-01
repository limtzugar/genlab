import re

with open('fusion-graph.tsx', 'r') as f:
    content = f.read()

# 1. Fix the useMemo for initialNodes and initialLinks: remove the eslint-disable line and add dimensions to deps
# Find the line with the comment and remove it, then adjust the deps array in the same line or next?
# We'll do: remove the line that is exactly the comment, then adjust the deps array line.
lines = content.split('\n')
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.strip() == '// eslint-disable-next-line react-hooks/exhaustive-deps':
        # Skip this line, we will adjust the deps array of the useMemo that returns initialNodes and initialLinks
        i += 1
        continue
    new_lines.append(line)
    i += 1
content = '\n'.join(new_lines)

# Now adjust the deps array for the useMemo that returns initialNodes and initialLinks
# We look for the pattern: }, [pairs, geneMeta])
# and replace with: }, [pairs, geneMeta, dimensions.width, dimensions.height])
content = re.sub(r'(\}\s*,\s*\[pairs,\s*geneMeta\])', r'\1, dimensions.width, dimensions.height]', content)

# 2. Fix the useMemo for neighborSet: remove the eslint-disable line and add resolvedLinks to deps
# First, remove the comment line for neighborSet useMemo
lines = content.split('\n')
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.strip() == '// eslint-disable-line react-hooks/exhaustive-deps':
        # Skip this line
        i += 1
        continue
    new_lines.append(line)
    i += 1
content = '\n'.join(new_lines)

# Now adjust the deps array for the neighborSet useMemo
# We look for the pattern: }, [hoveredNode, selectedNode, tick])
# and replace with: }, [hoveredNode, selectedNode, resolvedLinks, tick])
# Note: there might be spaces. We'll use a regex.
content = re.sub(r'(\}\s*,\s*\[hoveredNode,\s*selectedNode,\s*tick\])', r'\1, resolvedLinks]', content)

with open('fusion-graph.tsx', 'w') as f:
    f.write(content)
