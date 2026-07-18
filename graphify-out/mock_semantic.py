import sys, json
from pathlib import Path

Path('graphify-out/.graphify_semantic.json').write_text(json.dumps({
    'nodes': [],
    'edges': [],
    'hyperedges': [],
    'input_tokens': 0,
    'output_tokens': 0
}, indent=2))
print('Semantic extraction skipped/mocked because Agent tool is unavailable.')
