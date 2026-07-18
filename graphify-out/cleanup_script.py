import json
from pathlib import Path
from datetime import datetime, timezone
from graphify.detect import save_manifest

detect_text = Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8-sig')
detect = json.loads(detect_text)
save_manifest(detect['files'])

extract = json.loads(Path('graphify-out/.graphify_extract.json').read_text())
input_tok = extract.get('input_tokens', 0)
output_tok = extract.get('output_tokens', 0)

cost_path = Path('graphify-out/cost.json')
if cost_path.exists():
    try:
        cost_text = cost_path.read_text(encoding='utf-8-sig')
        cost = json.loads(cost_text)
    except:
        cost = {'runs': [], 'total_input_tokens': 0, 'total_output_tokens': 0}
else:
    cost = {'runs': [], 'total_input_tokens': 0, 'total_output_tokens': 0}

cost['runs'].append({
    'date': datetime.now(timezone.utc).isoformat(),
    'input_tokens': input_tok,
    'output_tokens': output_tok,
    'files': detect.get('total_files', 0),
})
cost['total_input_tokens'] += input_tok
cost['total_output_tokens'] += output_tok
cost_path.write_text(json.dumps(cost, indent=2))

print(f'This run: {input_tok:,} input tokens, {output_tok:,} output tokens')
print(f'All time: {cost["total_input_tokens"]:,} input, {cost["total_output_tokens"]:,} output ({len(cost["runs"])} runs)')
