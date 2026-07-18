import sys, json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text())
detection_text = Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8-sig')
detection = json.loads(detection_text)
analysis = json.loads(Path('graphify-out/.graphify_analysis.json').read_text())

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

labels_text = Path('graphify-out/.graphify_labels_auto.json').read_text(encoding='utf-16')
try:
    labels = json.loads(labels_text)
except json.JSONDecodeError:
    labels_text = Path('graphify-out/.graphify_labels_auto.json').read_text(encoding='utf-8-sig')
    labels = json.loads(labels_text)

labels = {int(k): v for k, v in labels.items()}

questions = suggest_questions(G, communities, labels)

report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, r'D:\strategist\PSA web', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}))
print('Report updated with community labels')
