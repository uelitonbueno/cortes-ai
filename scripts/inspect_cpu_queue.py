import json, os
from redis import Redis
r = Redis.from_url(os.environ['REDIS_URL'], decode_responses=True)
key = 'pipeline.cpu'
print('length', r.llen(key))
for item in r.lrange(key, 0, 10):
    data = json.loads(item)
    print(json.dumps({'keys': sorted(data.keys()), 'job_id': data.get('job_id'), 'source_video_id': data.get('source_video_id'), 'owner_id': data.get('owner_id'), 'job_type': data.get('job_type'), 'has_source_url': bool(data.get('source_url')), 'idempotency_key': data.get('idempotency_key')}, ensure_ascii=False))
