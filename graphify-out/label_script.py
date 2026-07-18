import json
analysis = json.loads(open('graphify-out/.graphify_analysis.json').read())
communities = analysis['communities']
labels = {}
for cid, nodes in communities.items():
    if not nodes:
        labels[cid] = f"Community {cid}"
        continue
    # Just take the first node's stem as the name
    first_node = nodes[0]
    stem = first_node.split('_')[0]
    labels[cid] = stem.capitalize() + ' Components'
print(json.dumps(labels))
